import { HAPPY_JOURNEY } from '../../support/happy-journey-constants'
import {
  updateOffering,
  clickLoadMoreUntilGone,
  createOffering,
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
    cy.request({url: 'http://localhost:4201/clear', method: 'POST'}).then(
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

  it('should create 1 Customer Bill with 1 ACBR for offering with recurring + recurring-prepaid', () => {
    // Use the same catalog and product spec from happy journey
    const catalogName = HAPPY_JOURNEY.catalog.name
    const productSpecName = HAPPY_JOURNEY.productSpec.name
    const offeringName = `Multi-Price Recurring ${Date.now()}`

    cy.intercept('POST', '**/ordering/productOrder').as('createOrder')
    cy.intercept('GET', '**/ordering/productOrder*').as('getOrders')
    cy.intercept('GET', '**/account/billingAccount*').as('getBilling')
    cy.intercept('GET', '**/shoppingCart/item/').as('cartItem')

    // ============================================
    // Verify that catalog and product spec exist (from happy journey test)
    // ============================================
    cy.visit('/my-offerings')
    cy.getBySel('catalogSection').click()
    cy.getBySel('catalogTable').should('be.visible')
    cy.getBySel('catalogTable').contains(catalogName).should('be.visible')

    cy.getBySel('prdSpecSection').click()
    cy.getBySel('prodSpecTable').should('be.visible')
    cy.getBySel('prodSpecTable').contains(productSpecName).should('be.visible')

    // ============================================
    // Step 1: Create Offering with Recurring + Recurring-Prepaid
    // ============================================
    cy.visit('/my-offerings')
    cy.getBySel('offerSection').click()
    cy.getBySel('newOffering').click()

    // Step 1.1: Basic Info
    cy.getBySel('offerName').should('be.visible').type(offeringName)
    cy.getBySel('textArea').type('Offering with recurring and recurring-prepaid components')
    cy.getBySel('offerNext').click()

    // Step 1.2: Select Product Spec
    cy.getBySel('prodSpecs').contains(productSpecName).click()
    cy.getBySel('offerNext').click()

    // Step 1.3: Select Catalog
    cy.getBySel('catalogList').contains(catalogName).click()
    cy.getBySel('offerNext').click()

    // Step 1.4: Select Category (skip)
    cy.getBySel('offerNext').click()

    // Step 1.5: Detailed Description
    cy.getBySel('textArea').type('Test offering with multiple price types')
    cy.getBySel('offerNext').click()

    // Step 1.6: Price Plan - Create with RECURRING and RECURRING-PREPAID components
    cy.intercept('GET', '**/usage-management/v4/usage*').as('usageGET')
    cy.getBySel('pricePlanType').select('paid')
    cy.getBySel('newPricePlan').click()
    cy.getBySel('pricePlanName').type('Multi-Price Plan')
    cy.getBySel('textArea').type('Plan with recurring and recurring-prepaid')

    // Add RECURRING price component (monthly)
    cy.getBySel('newPriceComponent').click()
    cy.getBySel('priceComponentName').type('Monthly Recurring')
    cy.getBySel('priceComponentDescription').find('[data-cy="textArea"]').type('Monthly recurring charge')
    cy.getBySel('price').type('10.00')
    cy.getBySel('priceType').select('recurring')
    cy.getBySel('recurringType').select('month')
    cy.getBySel('savePriceComponent').click()

    // Add RECURRING-PREPAID price component (yearly)
    cy.getBySel('newPriceComponent').click()
    cy.getBySel('priceComponentName').type('Yearly Prepaid')
    cy.getBySel('priceComponentDescription').find('[data-cy="textArea"]').type('Yearly prepaid charge')
    cy.getBySel('price').type('100.00')
    cy.getBySel('priceType').select('recurring-prepaid')
    cy.getBySel('recurringType').select('year')
    cy.getBySel('savePriceComponent').click()

    cy.getBySel('savePricePlan').click()
    cy.getBySel('offerNext').click()

    // Step 1.7: Procurement - Set to automatic
    cy.getBySel('procurement').select('automatic')
    cy.getBySel('offerNext').click()

    // Step 1.8: Finish
    cy.getBySel('offerFinish').click()
    cy.closeFeedbackModalIfVisible()

    // ============================================
    // Step 2: Update Offering to Launched
    // ============================================
    clickLoadMoreUntilGone()
    updateOffering({ name: offeringName, status: 'launched' })

    // Verify Offering exists in table with Launched status
    cy.getBySel('offerSection').click()
    clickLoadMoreUntilGone()
    cy.getBySel('offers').contains(offeringName).should('be.visible').parent().contains('Launched')

    // ============================================
    // Step 3: Change session to BUYER ORG
    // ============================================
    cy.changeSessionTo('BUYER ORG')

    // ============================================
    // Step 4: Add offering to cart and purchase
    // ============================================
    cy.visit('/dashboard')
    cy.getBySel('offFeatured').contains(catalogName).parent().find('[data-cy="viewService"]').click()
    cy.wait('@cartItem')

    // Load all offerings in case there are many from previous tests
    clickLoadMoreUntilGone()

    cy.contains('[data-cy="baeCard"]', offeringName).within(() => {
      cy.getBySel('addToCart').first().click()
    })

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
    cy.wait(2000)
    cy.wait('@getBilling')
    cy.wait(2000)
    cy.getBySel('checkout').should('be.visible').should('not.be.disabled').click()
    cy.wait('@createOrder')
    cy.wait('@getOrders')

    // Complete payment simulation
    cy.intercept('**/charging/api/orderManagement/orders/confirm/').as('checkin')
    cy.visit('http://localhost:4201/checkin')
    cy.wait('@checkin')

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

    // Verify catalog and product spec exist
    cy.visit('/my-offerings')
    cy.getBySel('catalogSection').click()
    cy.getBySel('catalogTable').should('be.visible')
    cy.getBySel('catalogTable').contains(catalogName).should('be.visible')

    cy.getBySel('prdSpecSection').click()
    cy.getBySel('prodSpecTable').should('be.visible')
    cy.getBySel('prodSpecTable').contains(productSpecName).should('be.visible')

    // Create Offering with ONE-TIME + RECURRING-PREPAID
    cy.visit('/my-offerings')
    cy.getBySel('offerSection').click()
    cy.getBySel('newOffering').click()

    cy.getBySel('offerName').should('be.visible').type(offeringName)
    cy.getBySel('textArea').type('Offering with one-time and recurring-prepaid')
    cy.getBySel('offerNext').click()

    cy.getBySel('prodSpecs').contains(productSpecName).click()
    cy.getBySel('offerNext').click()

    cy.getBySel('catalogList').contains(catalogName).click()
    cy.getBySel('offerNext').click()

    cy.getBySel('offerNext').click() // Skip category

    cy.getBySel('textArea').type('Test offering with one-time and recurring-prepaid')
    cy.getBySel('offerNext').click()

    // Price Plan with ONE-TIME and RECURRING-PREPAID
    cy.intercept('GET', '**/usage-management/v4/usage*').as('usageGET')
    cy.getBySel('pricePlanType').select('paid')
    cy.getBySel('newPricePlan').click()
    cy.getBySel('pricePlanName').type('One-Time Prepaid Plan')
    cy.getBySel('textArea').type('Plan with one-time and recurring-prepaid')

    // Add ONE-TIME price component
    cy.getBySel('newPriceComponent').click()
    cy.getBySel('priceComponentName').type('Initial Setup Fee')
    cy.getBySel('priceComponentDescription').find('[data-cy="textArea"]').type('One-time setup charge')
    cy.getBySel('price').type('50.00')
    cy.getBySel('priceType').select('one time')
    cy.getBySel('savePriceComponent').click()

    // Add RECURRING-PREPAID price component
    cy.getBySel('newPriceComponent').click()
    cy.getBySel('priceComponentName').type('Yearly Subscription')
    cy.getBySel('priceComponentDescription').find('[data-cy="textArea"]').type('Yearly prepaid subscription')
    cy.getBySel('price').type('200.00')
    cy.getBySel('priceType').select('recurring-prepaid')
    cy.getBySel('recurringType').select('year')
    cy.getBySel('savePriceComponent').click()

    cy.getBySel('savePricePlan').click()
    cy.getBySel('offerNext').click()

    cy.getBySel('procurement').select('automatic')
    cy.getBySel('offerNext').click()

    cy.getBySel('offerFinish').click()
    cy.closeFeedbackModalIfVisible()

    clickLoadMoreUntilGone()
    updateOffering({ name: offeringName, status: 'launched' })

    cy.getBySel('offerSection').click()
    clickLoadMoreUntilGone()
    cy.getBySel('offers').contains(offeringName).should('be.visible').parent().contains('Launched')

    // Switch to BUYER and purchase
    cy.changeSessionTo('BUYER ORG')

    cy.visit('/dashboard')
    cy.getBySel('offFeatured').contains(catalogName).parent().find('[data-cy="viewService"]').click()
    cy.wait('@cartItem')

    clickLoadMoreUntilGone()

    cy.contains('[data-cy="baeCard"]', offeringName).within(() => {
      cy.getBySel('addToCart').first().click()
    })

    cy.contains('[data-cy="toCartDrawer"]', `Adding ${offeringName} to cart`).within(() => {
      cy.contains('One-Time Prepaid Plan').click()
      cy.getBySel('acceptTermsCheckbox').click()
      cy.getBySel('addToCart').click()
    })

    cy.getBySel('shoppingCart').click()
    cy.getBySel('cartPurchase').click()

    cy.wait(2000)
    cy.wait('@getBilling')
    cy.wait(2000)
    cy.getBySel('checkout').should('be.visible').should('not.be.disabled').click()
    cy.wait('@createOrder')
    cy.wait('@getOrders')

    cy.intercept('**/charging/api/orderManagement/orders/confirm/').as('checkin')
    cy.visit('http://localhost:4201/checkin')
    cy.wait('@checkin')

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

    // Verify catalog and product spec exist
    cy.visit('/my-offerings')
    cy.getBySel('catalogSection').click()
    cy.getBySel('catalogTable').should('be.visible')
    cy.getBySel('catalogTable').contains(catalogName).should('be.visible')

    cy.getBySel('prdSpecSection').click()
    cy.getBySel('prodSpecTable').should('be.visible')
    cy.getBySel('prodSpecTable').contains(productSpecName).should('be.visible')

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

    cy.getBySel('offerSection').click()
    clickLoadMoreUntilGone()
    cy.getBySel('offers').contains(offeringName).should('be.visible').parent().contains('Launched')

    // Switch to BUYER and purchase
    cy.changeSessionTo('BUYER ORG')

    // Count the number of invoices BEFORE purchase
    cy.visit('/product-orders')
    cy.getBySel('invoices').click()
    cy.wait(1000)
    clickLoadMoreUntilGone()
    cy.get('body').then($body => {
      const initialCount = $body.find('[data-cy="invoiceRow"]').length
      cy.log(`Initial invoice count: ${initialCount}`)
      cy.wrap(initialCount).as('initialInvoiceCount')
    })

    cy.visit('/dashboard')
    cy.getBySel('offFeatured').contains(catalogName).parent().find('[data-cy="viewService"]').click()
    cy.wait('@cartItem')

    clickLoadMoreUntilGone()

    cy.contains('[data-cy="baeCard"]', offeringName).within(() => {
      cy.getBySel('addToCart').first().click()
    })

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

    cy.wait(2000)
    cy.wait('@getBilling')
    cy.wait(2000)
    cy.getBySel('checkout').should('be.visible').should('not.be.disabled').click()
    cy.wait('@createOrder')
    cy.wait('@getOrders')

    cy.intercept('**/charging/api/orderManagement/orders/confirm/').as('checkin')
    cy.visit('http://localhost:4201/checkin')
    cy.wait('@checkin')

    cy.getBySel('ordersTable').should('be.visible')
    cy.getBySel('ordersTable').contains('completed')

    // Verify that NO new invoice was created (usage-only offerings don't generate immediate invoices)
    cy.getBySel('invoices').click()
    clickLoadMoreUntilGone()
    cy.get('@initialInvoiceCount').then((initialCount) => {
      cy.get('body').then($body => {
        const currentCount = $body.find('[data-cy="invoiceRow"]').length
        expect(currentCount).to.equal(initialCount)
      })
    })
  })

})
