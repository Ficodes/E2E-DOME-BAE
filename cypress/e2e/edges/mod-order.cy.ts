import { HAPPY_JOURNEY } from '../../support/happy-journey-constants'
import {
  createProductSpec,
  updateProductSpecStatus,
  createOffering,
  updateOffering,
  createCheckoutBilling,
  clickLoadMoreUntilGone,
} from '../../support/form-helpers'

/**
 * Test: Product Modification Order (mod-order)
 *
 * Creates a product spec with 3 characteristic types (string, number, range),
 * an offering with 3 price components linked to those characteristics,
 * purchases as buyer, verifies INITIAL PAYMENT, then modifies the product
 * from inventory and verifies INITIAL MODIFICATION PAYMENT.
 */
describe('Product Modification Order E2E', {
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

  it('should purchase an offering with char-linked prices, then modify and verify INITIAL MODIFICATION PAYMENT', () => {
    const catalogName = HAPPY_JOURNEY.catalog.name
    const productSpecName = `ModOrder ProdSpec ${Date.now()}`
    const offeringName = `ModOrder Offering ${Date.now()}`

    cy.intercept('POST', '**/ordering/productOrder').as('createOrder')
    cy.intercept('GET', '**/ordering/productOrder*').as('getOrders')
    cy.intercept('GET', '**/account/billingAccount*').as('getBilling')
    cy.intercept('GET', '**/shoppingCart/item/').as('cartItem')

    // ============================================
    // SELLER SIDE: Create Product Spec with 3 characteristics
    // ============================================
    createProductSpec({
      name: productSpecName,
      brand: 'ModOrder Brand',
      productNumber: `MO-${Date.now()}`,
      characteristics: [
        {
          name: 'Plan Type',
          description: 'Type of plan',
          type: 'string',
          values: ['Basic', 'Premium']
        },
        {
          name: 'Storage',
          description: 'Storage capacity',
          type: 'number',
          values: [
            { value: 100, unit: 'GB' },
            { value: 500, unit: 'GB' }
          ]
        },
        {
          name: 'Users',
          description: 'Number of users',
          type: 'range',
          values: { from: 1, to: 10, unit: 'users' }
        }
      ]
    })

    clickLoadMoreUntilGone()
    updateProductSpecStatus({ name: productSpecName, status: 'launched' })

    // ============================================
    // SELLER SIDE: Create Offering with 3 char-linked price components
    // ============================================
    createOffering({
      name: offeringName,
      description: 'Offering for mod-order test',
      productSpecName: productSpecName,
      catalogName: catalogName,
      detailedDescription: 'Offering with characteristics linked to price components',
      mode: 'paid',
      pricePlan: { name: 'ModOrder Plan', description: 'Plan with char-linked prices' },
      priceComponents: [
        {
          name: 'Plan Fee',
          description: 'Fee based on plan type',
          price: 10,
          type: 'recurring',
          recurringPeriod: 'month',
          charLink: { characteristicName: 'Plan Type', value: 'Basic' }
        },
        {
          name: 'Storage Fee',
          description: 'Fee based on storage',
          price: 50,
          type: 'one time',
          charLink: { characteristicName: 'Storage', value: '100' }
        },
        {
          name: 'User Fee',
          description: 'Fee based on users',
          price: 5,
          type: 'one time',
          charLink: { characteristicName: 'Users' }
        }
      ],
      procurement: 'automatic'
    })

    updateOffering({ name: offeringName, status: 'launched' })

    // Verify offering exists
    cy.getBySel('offerSection').click()
    clickLoadMoreUntilGone()
    cy.getBySel('offers').contains(offeringName).should('be.visible').parent().contains('Launched')

    // ============================================
    // Set countries to ES for tax calculation
    // ============================================
    cy.visit('/profile')
    cy.getBySel('orgCountry').select('ES')
    cy.getBySel('orgUpdate').click()

    // ============================================
    // BUYER SIDE: Purchase the offering
    // ============================================
    cy.changeSessionTo('BUYER ORG')
    cy.visit('/profile')
    cy.getBySel('orgCountry').select('ES')
    cy.getBySel('orgUpdate').click()

    cy.visit('/search')
    cy.wait('@cartItem')

    clickLoadMoreUntilGone()

    cy.contains('[data-cy="baeCard"]', offeringName).within(() => {
      cy.getBySel('addToCart').first().click()
    })

    // Select price plan and set characteristics in drawer
    cy.contains('[data-cy="toCartDrawer"]', `Adding ${offeringName} to cart`).within(() => {
      cy.contains('ModOrder Plan').click()

      // Wait for characteristics to render
      cy.getBySel('offerChar').should('have.length.greaterThan', 0)

      // Set the range slider (Users) to 5
      cy.get('input[type="range"]').invoke('val', 5).trigger('input').trigger('change')

      // Capture preview prices
      cy.getBySel('previewPrices').should('have.length.greaterThan', 0)

      cy.getBySel('acceptTermsCheckbox').click()
      cy.getBySel('addToCart').click()
    })

    // Go to cart and purchase
    cy.getBySel('shoppingCart').click()
    cy.getBySel('cartPurchase').click()

    // ============================================
    // Create billing address if needed
    // ============================================
    cy.wait(2000)

    cy.get('body').then($body => {
      if ($body.find('[data-cy="billingTitle"]').length > 0) {
        createCheckoutBilling({
          title: 'ModOrder Billing',
          country: 'ES',
          city: 'Madrid',
          state: 'Madrid',
          zip: '28000',
          street: 'Gran Via 10',
          email: 'buyer@test.com',
          phoneNumber: '600123456'
        })
        cy.intercept('POST', '**/account/billingAccount').as('saveBilling')
        cy.wait(2000)
      }
    })

    cy.wait('@getBilling')
    cy.wait(2000)
    cy.getBySel('checkout').should('be.visible').should('not.be.disabled').click()
    cy.wait('@createOrder')
    cy.wait('@getOrders')

    // Confirm payment
    cy.intercept('**/charging/api/orderManagement/orders/confirm/').as('checkin')
    cy.visit('http://localhost:4201/checkin')
    cy.wait('@checkin')

    // ============================================
    // Verify initial purchase: order completed + invoice
    // ============================================
    cy.getBySel('ordersTable').should('be.visible')
    cy.getBySel('ordersTable').contains('completed')

    cy.getBySel('invoices').click()

    cy.getBySel('invoiceRow').should('have.length.greaterThan', 0).last().within(() => {
      cy.contains('settled').should('be.visible')
      cy.get('button').should('have.length.greaterThan', 0).first().click()
    })

    cy.getBySel('invoiceDetail').should('contain', 'INITIAL PAYMENT')
    cy.getBySel('invoiceDetail').within(() => {
      cy.getBySel('acbr').should('have.length', 2)
      // Storage Fee: 50 * 1.21 = 60.5 EUR | User Fee: 5 * 5 slider * 1.21 = 30.25 EUR
      cy.getBySel('acbrType').should('contain', 'one time')
      cy.getBySel('acbrPrice').then($prices => {
        const prices = [...$prices].map(el => el.textContent?.trim())
        expect(prices).to.include('60.5EUR')
        expect(prices).to.include('30.25EUR')
      })
    })

    // ============================================
    // Verify product in inventory as active
    // ============================================
    cy.visit('/product-inventory')
    clickLoadMoreUntilGone()
    cy.getBySel('productInventory').contains('[data-cy="productInventory"]', offeringName).contains('active')

    // ============================================
    // MODIFICATION: Open modify drawer from inventory
    // ============================================
    cy.getBySel('productInventory').contains('[data-cy="productInventory"]', offeringName)
      .find('[data-cy="modifyInvProduct"]').click()

    // The modify drawer opens with existing characteristics as read-only
    cy.contains('[data-cy="toCartDrawer"]', `Modifying ${offeringName}`).should('be.visible').within(() => {
      // Select the same price plan
      cy.contains('ModOrder Plan').click()

      // Wait for characteristics to render
      cy.getBySel('offerChar').should('have.length.greaterThan', 0)

      // Change the range slider (Users) from 5 to 10
      cy.get('input[type="range"]').invoke('val', 10).trigger('input').trigger('change')

      cy.getBySel('acceptTermsCheckbox').click()

      // Click "Modify Characteristics"
      cy.getBySel('addToCart').click()
    })

    // ============================================
    // Billing address modal for modification
    // ============================================
    // The modal appears with existing billing addresses
    cy.wait('@getBilling')
    cy.wait(2000)

    // Click on the first billing address to select it
    cy.get('.backdrop-blur-sm').should('be.visible').within(() => {
      cy.get('app-billing-address').first().click()
      // Click confirm modify button
      cy.get('button').contains(/confirm|Confirm/i).click()
    })

    // ============================================
    // Verify modification: checkin + order + invoice
    // ============================================
    cy.intercept('**/charging/api/orderManagement/orders/confirm/').as('checkinModify')
    cy.visit('http://localhost:4201/checkin')
    cy.wait('@checkinModify')

    cy.visit('/product-orders')
    cy.getBySel('ordersTable').should('be.visible')
    cy.getBySel('ordersTable').contains('completed')

    cy.getBySel('invoices').click()
    clickLoadMoreUntilGone()

    cy.getBySel('invoiceRow').should('have.length.greaterThan', 0).last().within(() => {
      cy.contains('settled').should('be.visible')
      cy.get('button').should('have.length.greaterThan', 0).first().click()
    })

    cy.getBySel('invoiceDetail').should('contain', 'INITIAL MODIFICATION PAYMENT')
    cy.getBySel('invoiceDetail').within(() => {
      cy.getBySel('acbr').should('have.length.greaterThan', 0)
      // User Fee after modify: 5 * 10 slider * 1.21 = 60.5 EUR
      cy.getBySel('acbrType').should('contain', 'one time')
      cy.getBySel('acbrPrice').should('contain', '60.5EUR')
    })
  })
})
