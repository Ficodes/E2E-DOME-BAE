import { HAPPY_JOURNEY } from '../../support/happy-journey-constants'
import {
  updateOffering,
  clickLoadMoreUntilGone,
  createOffering,
  waitForInitialPaginatedList,
} from '../../support/form-helpers'

/**
 * Test Edge Case: Multiple Price Components in Single Offering
 *
 * This test verifies that when an offering contains multiple price components
 * of different types (e.g., recurring + recurring-prepaid), only ONE Customer Bill
 * is created with multiple ACBRs (Applied Customer Billing Rates).
 *
 * Test Cases:
 * 1. Offering with recurring + recurring-prepaid
 * 2. Offerin with one-time + recurring prepaid
 * 3. Offering with only usage
 */
describe('Multi-Price Component Billing Edge Cases', {
  viewportHeight: 1080,
  viewportWidth: 1920,
}, () => {

  beforeEach(() => {
    cy.clearBilling()
    cy.loginAsAdmin()
    cy.on('uncaught:exception', (err) => {
      console.error('Uncaught exception:', err.message)
      if (err.message.includes("Unexpected token '<'")) {
        return false
      }
    })
  })

  it('should create 1 Customer Bill with 1 ACBR for offering with recurring + recurring-prepaid', () => {
    // Use the same catalog and product spec from happy journey
    const catalogName = HAPPY_JOURNEY.catalog.name
    const productSpecName = HAPPY_JOURNEY.productSpec.name
    const offeringName = `Multi-Price Recurring ${Date.now()}`

    cy.intercept('POST', '**/ordering/productOrder').as('createOrder')
    cy.intercept('GET', '**/ordering/productOrder*').as('getOrders')
    cy.intercept('GET', '**/account/billingAccount*').as('getBilling')
    cy.intercept('GET', '**/shoppingCart/item/').as('cartItem')
    cy.intercept('GET', '**/paymentInfo').as('getPaymentInfo')

    // ============================================
    // Step 1: Create Offering with Recurring + Recurring-Prepaid
    // ============================================
    createOffering({
      name: offeringName,
      description: 'Offering with recurring and recurring-prepaid components',
      productSpecName,
      catalogName,
      detailedDescription: 'Test offering with multiple price types',
      mode: 'paid',
      pricePlan: {
        name: 'Multi-Price Plan',
        description: 'Plan with recurring and recurring-prepaid',
      },
      priceComponents: [
        {
          name: 'Monthly Recurring',
          description: 'Monthly recurring charge',
          price: 10,
          type: 'recurring',
          recurringPeriod: 'month',
        },
        {
          name: 'Yearly Prepaid',
          description: 'Yearly prepaid charge',
          price: 100,
          type: 'recurring-prepaid',
          recurringPeriod: 'year',
        },
      ],
      procurement: 'automatic',
    })

    // ============================================
    // Step 2: Publish offering
    // ============================================
    clickLoadMoreUntilGone(10, '[data-cy="offerRow"]')
    updateOffering({ name: offeringName, status: 'launched' })

    // ============================================
    // Step 3: Change session to BUYER ORG
    // ============================================
    cy.changeSessionTo('BUYER ORG')

    // ============================================
    // Step 4: Add offering to cart and purchase
    // ============================================
    // cy.visit('/dashboard')
    //cy.getBySel('offFeatured').contains(catalogName).parent().find('[data-cy="viewService"]').click()
    waitForInitialPaginatedList('**/catalog/productOffering?*', () => {
      cy.visit('/search')
    })
    cy.wait('@cartItem')

    // Load all offerings in case there are many from previous tests
    clickLoadMoreUntilGone(10, '[data-cy="baeCard"]')

    cy.openAddToCartDrawerFromSearch(offeringName)

    // Select price plan in drawer
    cy.contains('[data-cy="toCartDrawer"]', `Adding ${offeringName} to cart`).within(() => {
      cy.contains('Multi-Price Plan').click()
      cy.getBySel('acceptTermsCheckbox').click()
      cy.getBySel('addToCart').click()
    })

    // Go to cart and purchase
    cy.getBySel('shoppingCart').click()
    cy.getBySel('cartPurchase').click()

    // ============================================
    // Step 5: Wait for billing address and checkout
    // ============================================
    cy.wait('@getBilling')
    cy.wait(2000)
    cy.deferPaymentRedirect()
    cy.getBySel('checkout').should('be.visible').should('not.be.disabled').click()
    cy.wait('@createOrder')
    cy.waitForOrdersBeforePayment()

    // Complete payment simulation
    cy.intercept('**/charging/api/orderManagement/orders/confirm/').as('checkin')
    cy.completePayment({ recurring: true })
    cy.wait('@checkin')
    cy.waitForOrdersAfterPayment()

    // ============================================
    // Step 6: Verify Customer Bill and ACBRs
    // ============================================
    cy.getBySel('ordersTable').should('be.visible')
    cy.getBySel('ordersTable').contains('completed')

    // Navigate to invoices
    cy.getBySel('invoices').click()

    // Verify the most recent invoice (last row) is settled
    cy.getBySel('invoiceRow').should('have.length.greaterThan', 0).last().within(() => {
      cy.contains('settled').should('be.visible')
      cy.contains('121EUR').should('be.visible')
      cy.get('button').should('have.length.greaterThan', 0).first().click()
    })

    // Verify 1 ACBR exists within the Customer Bill
    // Only recurring-prepaid generates INITIAL PAYMENT (recurring is paid a posteriori)
    cy.getBySel('invoiceDetail').should('contain', 'INITIAL PAYMENT')
    cy.getBySel('invoiceDetail').within(() => {
      cy.getBySel('acbr').should('have.length', 1)
    })
  })

  it('should create 1 Customer Bill with 2 ACBRs for offering with one-time + recurring-prepaid', () => {
    const catalogName = HAPPY_JOURNEY.catalog.name
    const productSpecName = HAPPY_JOURNEY.productSpec.name
    const offeringName = `One-Time Prepaid ${Date.now()}`

    cy.intercept('POST', '**/ordering/productOrder').as('createOrder')
    cy.intercept('GET', '**/ordering/productOrder*').as('getOrders')
    cy.intercept('GET', '**/account/billingAccount*').as('getBilling')
    cy.intercept('GET', '**/shoppingCart/item/').as('cartItem')
    cy.intercept('GET', '**/paymentInfo').as('getPaymentInfo')

    // Create Offering with ONE-TIME + RECURRING-PREPAID
    createOffering({
      name: offeringName,
      description: 'Offering with one-time and recurring-prepaid',
      productSpecName,
      catalogName,
      detailedDescription: 'Test offering with one-time and recurring-prepaid',
      mode: 'paid',
      pricePlan: {
        name: 'One-Time Prepaid Plan',
        description: 'Plan with one-time and recurring-prepaid',
      },
      priceComponents: [
        {
          name: 'Initial Setup Fee',
          description: 'One-time setup charge',
          price: 50,
          type: 'one time',
        },
        {
          name: 'Yearly Subscription',
          description: 'Yearly prepaid subscription',
          price: 200,
          type: 'recurring-prepaid',
          recurringPeriod: 'year',
        },
      ],
      procurement: 'automatic',
    })

    clickLoadMoreUntilGone(10, '[data-cy="offerRow"]')
    updateOffering({ name: offeringName, status: 'launched' })

    // Switch to BUYER and purchase
    cy.changeSessionTo('BUYER ORG')

    // cy.visit('/dashboard')
    //cy.getBySel('offFeatured').contains(catalogName).parent().find('[data-cy="viewService"]').click()
    waitForInitialPaginatedList('**/catalog/productOffering?*', () => {
      cy.visit('/search')
    })
    cy.wait('@cartItem')

    clickLoadMoreUntilGone(10, '[data-cy="baeCard"]')

    cy.openAddToCartDrawerFromSearch(offeringName)

    cy.contains('[data-cy="toCartDrawer"]', `Adding ${offeringName} to cart`).within(() => {
      cy.contains('One-Time Prepaid Plan').click()
      cy.getBySel('acceptTermsCheckbox').click()
      cy.getBySel('addToCart').click()
    })

    cy.getBySel('shoppingCart').click()
    cy.getBySel('cartPurchase').click()

    cy.wait('@getBilling')
    cy.wait(2000)
    cy.deferPaymentRedirect()
    cy.getBySel('checkout').should('be.visible').should('not.be.disabled').click()
    cy.wait('@createOrder')
    cy.waitForOrdersBeforePayment()

    cy.intercept('**/charging/api/orderManagement/orders/confirm/').as('checkin')
    cy.completePayment({ recurring: true })
    cy.wait('@checkin')
    cy.waitForOrdersAfterPayment()

    cy.getBySel('ordersTable').should('be.visible')
    cy.getBySel('ordersTable').contains('completed')

    cy.getBySel('invoices').click()

    cy.getBySel('invoiceRow').should('have.length.greaterThan', 0).last().within(() => {
      cy.contains('settled').should('be.visible')
      // 50.00 + 21% = 60.50 + 200.00 + 21% = 242.00 = 302.50 EUR
      cy.contains('302.5EUR').should('be.visible')
      cy.get('button').should('have.length.greaterThan', 0).first().click()
    })

    cy.getBySel('invoiceDetail').within(() => {
      cy.getBySel('acbr').should('have.length', 2)
    })
  })

  it('should not create any Customer Bill for offering with usage', () => {
    const catalogName = HAPPY_JOURNEY.catalog.name
    const productSpecName = HAPPY_JOURNEY.productSpec.name
    const offeringName = `ONLY USAGE ${Date.now()}`

    cy.intercept('POST', '**/ordering/productOrder').as('createOrder')
    cy.intercept('GET', '**/ordering/productOrder*').as('getOrders')
    cy.intercept('GET', '**/account/billingAccount*').as('getBilling')
    cy.intercept('GET', '**/shoppingCart/item/').as('cartItem')

    // Create Offering with Usage
    createOffering({
      name: offeringName,
      description: HAPPY_JOURNEY.offering.description,
      productSpecName: productSpecName,
      catalogName: catalogName,
      detailedDescription: "Used to test Usage Payment offering",
      mode: "paid",
      pricePlan: {name: "Usage Plan", description: "descr"},
      priceComponent: {name: "Usage Component", description: "descr", price: HAPPY_JOURNEY.priceComponent.price, type: "usage",
         usageInput: [HAPPY_JOURNEY.metric.name, HAPPY_JOURNEY.metric.metrics[0].name]},
      procurement: "automatic"
    })

    updateOffering({ name: offeringName, status: 'launched' })

    // Switch to BUYER and purchase
    cy.changeSessionTo('BUYER ORG')

    // Count the number of invoices BEFORE purchase
    cy.visit('/product-orders')
    waitForInitialPaginatedList('**/billing/customerBill?*', () => {
      cy.getBySel('invoices').click()
    })
    clickLoadMoreUntilGone(10, '[data-cy="invoiceRow"]')
    cy.get('body').then($body => {
      const initialCount = $body.find('[data-cy="invoiceRow"]').length
      cy.log(`Initial invoice count: ${initialCount}`)
      cy.wrap(initialCount).as('initialInvoiceCount')
    })

    // cy.visit('/dashboard')
    //cy.getBySel('offFeatured').contains(catalogName).parent().find('[data-cy="viewService"]').click()
    waitForInitialPaginatedList('**/catalog/productOffering?*', () => {
      cy.visit('/search')
    })
    cy.wait('@cartItem')

    clickLoadMoreUntilGone(10, '[data-cy="baeCard"]')

    cy.openAddToCartDrawerFromSearch(offeringName)

    cy.contains('[data-cy="toCartDrawer"]', `Adding ${offeringName} to cart`).within(() => {
      cy.contains('Usage Plan').click()
      cy.getBySel('acceptTermsCheckbox').click()
      cy.getBySel('offerMetric').within(()=>{
        cy.get('input').type('1')
      })
      cy.getBySel('addToCart').click()
    })

    cy.getBySel('shoppingCart').click()
    cy.getBySel('cartPurchase').click()

    cy.wait('@getBilling')
    cy.wait(2000)
    cy.deferPaymentRedirect()
    cy.getBySel('checkout').should('be.visible').should('not.be.disabled').click()
    cy.wait('@createOrder')
    cy.waitForOrdersBeforePayment()

    cy.intercept('**/charging/api/orderManagement/orders/confirm/').as('checkin')
    cy.completePayment({ recurring: true })
    cy.wait('@checkin')
    cy.waitForOrdersAfterPayment()

    cy.getBySel('ordersTable').should('be.visible')
    cy.getBySel('ordersTable').contains('completed')

    // Verify that NO new invoice was created (usage-only offerings don't generate immediate invoices)
    waitForInitialPaginatedList('**/billing/customerBill?*', () => {
      cy.getBySel('invoices').click()
    })
    clickLoadMoreUntilGone(10, '[data-cy="invoiceRow"]')
    cy.get('@initialInvoiceCount').then((initialCount) => {
      cy.get('body').then($body => {
        const currentCount = $body.find('[data-cy="invoiceRow"]').length
        expect(currentCount).to.equal(initialCount)
      })
    })
  })

})
