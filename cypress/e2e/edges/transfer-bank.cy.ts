import { HAPPY_JOURNEY } from '../../support/happy-journey-constants'
import {
  updateOffering,
  clickLoadMoreUntilGone,
} from '../../support/form-helpers'

/**
 * Test Edge Case: Manual Customer Bill Settlement via API
 *
 * Creates an offering, buys it as buyer, intercepts the order id,
 * then settles the customer bill directly via API (bypassing billing-server)
 * and verifies the order completes and product appears in inventory.
 */
describe('Manual Bill Settle Edge Case', {
  viewportHeight: 1080,
  viewportWidth: 1920,
}, () => {

  beforeEach(() => {
    cy.request({ url: 'http://localhost:4201/clear', method: 'POST' }).then(
      (response) => {
        expect(response.status).to.eq(200)
      }
    )
    cy.loginAsAdmin()
    cy.on('uncaught:exception', (err) => {
      console.error('Uncaught exception:', err.message)
      if (err.message.includes("Unexpected token '<'")) {
        return false
      }
    })
  })

  it('should settle customer bill via API and verify order completed and product in inventory', () => {
    const catalogName = HAPPY_JOURNEY.catalog.name
    const productSpecName = HAPPY_JOURNEY.productSpec.name
    const offeringName = `Bank Transfer ${Date.now()}`
    const pricePlanName = 'Manual Settle Plan'

    cy.intercept('POST', '**/ordering/productOrder').as('createOrder')
    cy.intercept('GET', '**/ordering/productOrder*').as('getOrders')
    cy.intercept('GET', '**/account/billingAccount*').as('getBilling')
    cy.intercept('GET', '**/shoppingCart/item/').as('cartItem')

    // ============================================
    // Step 1: Verify catalog and product spec exist (from happy journey)
    // ============================================
    cy.visit('/my-offerings')
    cy.getBySel('catalogSection').click()
    cy.getBySel('catalogTable').should('be.visible')
    cy.getBySel('catalogTable').contains(catalogName).should('be.visible')

    cy.getBySel('prdSpecSection').click()
    cy.getBySel('prodSpecTable').should('be.visible')
    cy.getBySel('prodSpecTable').contains(productSpecName).should('be.visible')

    // ============================================
    // Step 2: Create Offering with one-time price component
    // ============================================
    cy.visit('/my-offerings')
    cy.getBySel('offerSection').click()
    cy.getBySel('newOffering').click()

    cy.getBySel('offerName').should('be.visible').type(offeringName)
    cy.getBySel('textArea').type('Offering for manual bill settlement test')
    cy.getBySel('offerNext').click()

    cy.getBySel('prodSpecs').contains(productSpecName).click()
    cy.getBySel('offerNext').click()

    cy.getBySel('catalogList').contains(catalogName).click()
    cy.getBySel('offerNext').click()

    cy.getBySel('offerNext').click() // Skip category

    cy.getBySel('textArea').type('Test offering for manual bill settlement via API')
    cy.getBySel('offerNext').click()

    // One-time price component
    cy.getBySel('pricePlanType').select('paid')
    cy.getBySel('newPricePlan').click()
    cy.getBySel('pricePlanName').type(pricePlanName)
    cy.getBySel('textArea').type('One-time payment plan')

    cy.getBySel('newPriceComponent').click()
    cy.getBySel('priceComponentName').type('One-Time Fee')
    cy.getBySel('priceComponentDescription').find('[data-cy="textArea"]').type('One-time charge')
    cy.getBySel('price').type('50.00')
    cy.getBySel('priceType').select('one time')
    cy.getBySel('savePriceComponent').click()

    cy.getBySel('savePricePlan').click()
    cy.getBySel('offerNext').click()

    cy.getBySel('procurement').select('automatic')
    cy.getBySel('offerNext').click()

    cy.getBySel('offerFinish').click()
    cy.closeFeedbackModalIfVisible()

    // ============================================
    // Step 3: Launch offering
    // ============================================
    clickLoadMoreUntilGone()
    updateOffering({ name: offeringName, status: 'launched' })

    cy.getBySel('offerSection').click()
    clickLoadMoreUntilGone()
    cy.getBySel('offers').contains(offeringName).should('be.visible').parent().contains('Launched')

    // ============================================
    // Step 4: Switch to BUYER ORG
    // ============================================
    cy.changeSessionTo('BUYER ORG')

    // ============================================
    // Step 5: Count existing invoices before purchase
    // ============================================
    cy.visit('/product-orders')
    cy.getBySel('invoices').click()
    cy.wait(1000)
    clickLoadMoreUntilGone()
    cy.get('body').then($body => {
      const initialCount = $body.find('[data-cy="invoiceRow"]').length
      cy.log(`Initial invoice count: ${initialCount}`)
      cy.wrap(initialCount).as('initialInvoiceCount')
    })

    // ============================================
    // Step 6: Set billing-server to PENDING mode (simulates late/pending transfer)
    // ============================================
    cy.request({ url: 'http://localhost:4201/set-pending', method: 'GET' }).then((response) => {
      expect(response.status).to.eq(200)
    })

    // ============================================
    // Step 7: Add offering to cart and purchase
    // ============================================
    cy.visit('/search')
    cy.wait('@cartItem')
    clickLoadMoreUntilGone()

    cy.contains('[data-cy="baeCard"]', offeringName).within(() => {
      cy.getBySel('addToCart').first().click()
    })

    cy.contains('[data-cy="toCartDrawer"]', `Adding ${offeringName} to cart`).within(() => {
      cy.contains(pricePlanName).click()
      cy.getBySel('acceptTermsCheckbox').click()
      cy.getBySel('addToCart').click()
    })

    cy.getBySel('shoppingCart').click()
    cy.getBySel('cartPurchase').click()

    cy.wait(2000)
    cy.wait('@getBilling')
    cy.wait(2000)
    cy.getBySel('checkout').should('be.visible').should('not.be.disabled').click()

    // Intercept order creation to capture the order id
    cy.wait('@createOrder').then((interception) => {
      const orderId = interception.response?.body?.id
      cy.log(`Order ID: ${orderId}`)
      cy.wrap(orderId).as('orderId')
    })
    cy.wait('@getOrders')

    // ============================================
    // Step 8: Checkin - charging receives PENDING JWT, customerBill stays in 'sent'
    // ============================================
    cy.intercept('**/charging/api/orderManagement/orders/confirm/').as('checkin')
    cy.visit('http://localhost:4201/checkin')
    cy.wait('@checkin')

    // ============================================
    // Step 9: Get customer bill via API and settle it (simulating late bank transfer)
    // ============================================
    cy.request({
      method: 'GET',
      url: 'http://localhost:8645/customerBill?state=sent',
    }).then((response) => {
      expect(response.status).to.eq(200)
      const bills = response.body
      if (bills.length !== 1) {
        throw new Error(`Expected exactly 1 customer bill in 'sent' state, but found ${bills.length}`)
      }
      const billId = bills[0].id
      cy.log(`Customer Bill ID: ${billId}`)

      cy.request({
        method: 'PATCH',
        url: `http://localhost:8645/customerBill/${billId}`,
        body: { state: 'settled' },
      }).then((patchResponse) => {
        expect(patchResponse.status).to.eq(200)
        cy.log('Customer bill settled successfully')
      })
    })

    // ============================================
    // Step 10: Wait 5s for system to process, then verify order is completed
    // ============================================
    cy.wait(5000)

    cy.visit('/product-orders')
    cy.getBySel('ordersTable').should('be.visible')

    // Find the first (most recent) order row, verify it shows completed, then open details
    cy.getBySel('ordersTable').find('[data-cy="viewOrderDetails"]').first().closest('tr, [class*="row"], li, div').within(() => {
      cy.contains('completed').should('be.visible')
    })
    cy.getBySel('ordersTable').find('[data-cy="viewOrderDetails"]').first().click()

    // Verify the order ID, global state and order item completed in details
    cy.get('@orderId').then((orderId) => {
      cy.contains(`Order Id ${orderId}`).should('be.visible')
    })
    cy.getBySel('globalState').contains('completed').should('be.visible')
    cy.getBySel('orderItems').should('have.length', 1).within(() => {
      cy.contains('completed').should('be.visible')
    })

    // ============================================
    // Step 11: Verify customer bill count increased by 1 and last bill is settled
    // ============================================
    cy.visit('/product-orders')
    cy.getBySel('invoices').click()
    clickLoadMoreUntilGone()

    cy.get('@initialInvoiceCount').then((initialCount: any) => {
      cy.getBySel('invoiceRow').should('have.length', initialCount + 1)
    })

    cy.getBySel('invoiceRow').last().within(() => {
      cy.contains('settled').should('be.visible')
    })

    // ============================================
    // Step 12: Verify product appears in inventory and capture product ID
    // ============================================
    cy.visit('/product-inventory')
    cy.getBySel('productInventory').contains('[data-cy="productInventory"]', offeringName).contains('active')
    cy.contains('[data-cy="productInventory"]', offeringName).contains(offeringName).click()

    cy.url().then((url) => {
      const productId = url.split('/product-inventory/')[1]
      cy.log(`Product ID: ${productId}`)

      // ============================================
      // Step 13: Go to invoices and verify the invoice detail contains the product ID
      // ============================================
      cy.visit('/product-orders')
      cy.getBySel('invoices').click()
      clickLoadMoreUntilGone()

      cy.getBySel('invoiceRow').last().within(() => {
        cy.getBySel('invoiceDetails').click()
      })

      cy.contains(`${productId}`).should('be.visible')
    })
  })
})
