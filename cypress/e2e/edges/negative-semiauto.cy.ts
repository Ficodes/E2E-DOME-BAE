import { HAPPY_JOURNEY } from '../../support/happy-journey-constants'
import {
  createOffering,
  updateOffering,
  clickLoadMoreUntilGone,
} from '../../support/form-helpers'

describe('Try to complete semi-auto offering without paying',  {
  viewportHeight: 1080,
  viewportWidth: 1920,
}, () => {

    beforeEach(() => {
      cy.loginAsAdmin()
      cy.on('uncaught:exception', (err) => {
        // Log all errors to help debug
        console.error('Uncaught exception:', err.message)
        // Ignore cross-origin errors from proxy.docker
        if (err.message.includes("Unexpected token '<'")) {
          return false
        }
      })

      it('should give error', () => {
          // Use the same catalog and product spec from happy journey
          const catalogName = HAPPY_JOURNEY.catalog.name
          const productSpecName = HAPPY_JOURNEY.productSpec.name
          const offeringName = `Auto Payment Manual Proc ${Date.now()}`
      
          cy.intercept('POST', '**/ordering/productOrder').as('createOrder')
          cy.intercept('GET', '**/ordering/productOrder*').as('getOrders')
          cy.intercept('GET', '**/account/billingAccount*').as('getBilling')
      
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
          // Step 1: Create Offering with automatic payment and manual procurement
          // ============================================
          createOffering({
            name: offeringName,
            description: 'Automatic payment with manual procurement test',
            productSpecName: productSpecName,
            catalogName: catalogName,
            detailedDescription: 'This offering has automatic payment but requires manual procurement approval',
            mode: "paid",
            pricePlan: {
              name: "Auto Pay Manual Proc Plan",
              description: "Price plan with automatic payment"
            },
            priceComponent: {
              name: "Auto Pay Component",
              description: "One-time fee with automatic payment",
              price: 15.75,
              type: "one time"
            },
            procurement: "payment-automatic"
          })
      
          // ============================================
          // Step 2: Update Offering to Launched
          // ============================================
          updateOffering({ name: offeringName, status: 'launched' })
      
          // ============================================
          // Verify Offering exists in table with Launched status
          // ============================================
          cy.getBySel('offerSection').click()
          cy.getBySel('offers').should('be.visible')
          clickLoadMoreUntilGone()
      
          cy.getBySel('offers').contains(offeringName).should('be.visible').parent().contains('Launched')
      
          // ============================================
          // Step 3: Change session to BUYER ORG
          // ============================================
          cy.changeSessionTo('BUYER ORG')
      
          // ============================================
          // Step 4: Add offer to cart and checkout
          // ============================================
          cy.visit('/dashboard')
          cy.getBySel('offFeatured').contains(catalogName).parent().find('[data-cy="viewService"]').click()
      
          clickLoadMoreUntilGone()
          // Find and click on the offering card
          cy.contains('[data-cy="baeCard"]', offeringName).within(() => {
            cy.getBySel('addToCart').first().click()
          })
      
          // Select the drawer that contains the offering name
          cy.contains('[data-cy="toCartDrawer"]', `Adding ${offeringName} to cart`).within(() => {
            cy.contains('Auto Pay Manual Proc Plan').click()
            cy.contains('I accept the terms and conditions').click()
            cy.getBySel('addToCart').click()
          })
      
          cy.getBySel('shoppingCart').click()
          cy.getBySel('cartPurchase').click()
      
          // ============================================
          // Step 5: Complete checkout (automatic payment)
          // ============================================
          cy.wait(2000)
          cy.wait('@getBilling')
          cy.wait(2000)
          cy.getBySel('checkout').should('be.visible').should('not.be.disabled').click()
          cy.wait('@createOrder', { timeout: 60000 })
          cy.wait('@getOrders')
      
          // ============================================
          // Step 6: Verify order is in inProgress state (payment done, waiting for manual procurement)
          // ============================================
          cy.visit('http://localhost:4200/product-orders')
          cy.getBySel('ordersTable', { timeout: 60000 }).should('be.visible')
      
          // For manual procurement, get the most recent order (first row in tbody)
          // and verify it's in 'inProgress' state (manual procurement waiting for approval)
          cy.getBySel('ordersTable').find('tbody tr').first().within(() => {
            cy.contains('inProgress').should('be.visible')
          })
      
          // ============================================
          // Step 7: Switch back to SELLER ORG to process the manual procurement
          // ============================================
          cy.changeSessionTo('SELLER ORG')
      
          // Navigate to product orders as provider
          cy.visit('/product-orders')
          cy.getBySel('asProviderTab').click()
          cy.getBySel('ordersTable', { timeout: 60000 }).should('be.visible')
      
          // Find the most recent order (first row) and complete it
          cy.getBySel('ordersTable').find('tbody tr').first().within(() => {
            cy.getBySel('viewOrderDetails').click()
          })
          // Complete the order
          cy.getBySel('completeOrder').click()
          cy.getBySel('confirmActionBtn').click()
          cy.wait(2000)
      
          // ============================================
          // Step 8: Verify order is now completed as BUYER
          // ============================================
          cy.changeSessionTo('BUYER ORG')
          cy.visit('http://localhost:4200/product-orders')
          cy.getBySel('ordersTable', { timeout: 60000 }).should('be.visible')
      
          // Verify the most recent order (first row) is now completed
          cy.getBySel('ordersTable').find('tbody tr').first().within(() => {
            cy.contains('completed').should('be.visible')
          })
      
          // Verify invoice is settled
          cy.getBySel('invoices').click()
          cy.getBySel('invoiceRow').should('have.length.greaterThan', 0).first().within(() => {
            cy.contains('settled').should('be.visible')
            cy.get('button').should('have.length.greaterThan', 0).first().click()
          })
          cy.getBySel('invoiceDetail').contains('INITIAL PAYMENT')
      
          // Verify product is in inventory with active status
          cy.visit('/product-inventory')
      
          clickLoadMoreUntilGone()
      
          cy.getBySel('productInventory').contains('[data-cy="productInventory"]', offeringName).contains('active')
        })

    })
})