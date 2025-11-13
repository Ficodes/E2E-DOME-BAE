import { HAPPY_JOURNEY } from '../../support/happy-journey-constants';

import {
  createServiceSpec,
  createResourceSpec,
  createOffering,
  updateOffering,
  clickLoadMoreUntilGone,
  createProductSpec,
  updateProductSpecStatus,
  updateResourceSpecStatus,
  updateServiceSpecStatus
} from '../../support/form-helpers'

describe('Service and Resource Specification E2E Test', {
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
  })

  it('should create service and resource specs, create offering with all specs, purchase and verify inventory', () => {
    const dateNow = Date.now()
    const serviceSpec = {
      name: `E2E Service Spec ${dateNow}`,
      description: 'Test service specification with characteristics',
      characteristics: [
        {
          name: 'API Protocol',
          description: 'Supported API protocols',
          type: 'string' as const,
          values: ['REST', 'GraphQL', 'gRPC']
        },
        {
          name: 'Max Requests',
          description: 'Maximum requests per minute',
          type: 'number' as const,
          values: [
            { value: 1000, unit: 'req/min' },
            { value: 5000, unit: 'req/min' },
            { value: 10000, unit: 'req/min' }
          ]
        }
      ]
    }

    const resourceSpec = {
      name: `E2E Resource Spec ${dateNow}`,
      description: 'Test resource specification with characteristics',
      characteristics: [
        {
          name: 'Storage Type',
          description: 'Type of storage',
          type: 'string' as const,
          values: ['SSD', 'HDD', 'NVMe']
        },
        {
          name: 'Storage Capacity',
          description: 'Storage capacity range',
          type: 'range' as const,
          values: { from: 100, to: 5000, unit: 'GB' }
        }
      ]
    }

    const productSpec = {
      name: `E2E Product Spec ${dateNow}`,
      brand: HAPPY_JOURNEY.productSpec.brand,
      productNumber: HAPPY_JOURNEY.productSpec.productNumber,
      serviceSpecName: serviceSpec.name,
      resourceSpecName: resourceSpec.name
    }

    const offeringName = `E2E Complete Offering ${dateNow}`

    cy.intercept('POST', '**/ordering/productOrder').as('createOrder')
    cy.intercept('GET', '**/ordering/productOrder*').as('getOrders')
    cy.intercept('GET', '**/account/billingAccount*').as('getBilling')
    cy.intercept('GET', '**/usage-management/v4/usage*').as('usageGET')

    cy.visit('/')
    // ============================================
    // Step 1: Create Service Specification
    // ============================================
    createServiceSpec(serviceSpec)
    updateServiceSpecStatus({name: serviceSpec.name, status: 'launched'})

    // ============================================
    // Step 2: Create Resource Specification
    // ============================================
    createResourceSpec(resourceSpec)
    updateResourceSpecStatus({name: resourceSpec.name, status: 'launched'})

    // ============================================
    // Step 3: Create Offering and Product spec that includes Service and Resource specs
    // ============================================

    createProductSpec(productSpec)
    updateProductSpecStatus({ name: productSpec.name , status: 'launched'})

    createOffering({
      name: offeringName,
      version: '0.1',
      description: 'Offering with Product, Service and Resource specs',
      productSpecName: productSpec.name,
      catalogName: HAPPY_JOURNEY.catalog.name,
      detailedDescription: 'Complete offering including product, service and resource specifications',
      mode: 'paid',
      pricePlan: {
        name: 'Premium Plan',
        description: 'Premium pricing plan with prepaid recurring'
      },
      priceComponent: {
        name: 'Monthly Fee',
        description: 'Monthly recurring fee prepaid',
        price: 29.99,
        type: 'recurring-prepaid',
        recurringPeriod: 'month'
      },
      procurement: 'automatic'
    })

    // ============================================
    // Step 4: Update Offering to Launched
    // ============================================
    updateOffering({
      name: offeringName,
      status: 'launched'
    })

    // ============================================
    // Verify Offering exists in table with Launched status
    // ============================================
    cy.getBySel('offerSection').click()
    cy.getBySel('offers').should('be.visible')
    clickLoadMoreUntilGone()
    cy.getBySel('offers').contains(offeringName).should('be.visible').parent().contains('Launched')

    // ============================================
    // Step 5: Change session to BUYER ORG
    // ============================================
    cy.changeSessionTo('BUYER ORG')

    // ============================================
    // Step 6: Purchase the Offering
    // ============================================
    cy.visit('/')
    cy.getBySel('browseServices').click()

    // Load all offerings
    clickLoadMoreUntilGone()

    // Find and click on the offering card
    cy.contains('[data-cy="baeCard"]', offeringName).within(() => {
      cy.getBySel('addToCart').first().click()
    })

    // Select the drawer that contains the offering name
    cy.contains('[data-cy="toCartDrawer"]', `Adding ${offeringName} to cart`).within(() => {
      cy.contains('Premium Plan').click()
      cy.contains('I accept the terms and conditions').click()
      cy.getBySel('addToCart').click()
    })

    // Go to shopping cart
    cy.getBySel('shoppingCart').click()

    // Proceed to checkout
    cy.getBySel('cartPurchase').click()

    // Wait for checkout page
    cy.wait('@getBilling')

    // Complete checkout
    cy.getBySel('checkout').should('be.enabled').click()

    // Wait for order to complete (automatic procurement)
    cy.wait('@createOrder', { timeout: 60000 })
    cy.wait('@getOrders')
    cy.visit('http://localhost:4201/checkin')
    // ============================================
    // Step 7: Verify Customer Bill was created
    // ============================================
    cy.getBySel('ordersTable', { timeout: 60000 }).should('be.visible')
    cy.getBySel('ordersTable').contains('completed')
    cy.getBySel('invoices').click()
    cy.getBySel('invoiceRow').last().within(()=>{
      cy.contains('settled').should('be.visible')
      cy.get('button').should('have.length.greaterThan', 0).click()
    })
    cy.getBySel('invoiceDetail').contains('INITIAL PAYMENT')

    // ============================================
    // Step 8: Verify Product Inventory
    // ============================================
    cy.visit('/product-inventory')

    // Products should be visible by default
    cy.getBySel('inventoryProducts').should('be.visible')

    // Verify product from the offering appears
    cy.wait(2000)
    cy.contains(offeringName).should('be.visible')

    // ============================================
    // Step 9: Verify service Inventory
    // ============================================
    cy.getBySel('inventoryServices').click()

    // Verify service spec appears
    cy.wait(2000)
    cy.contains(serviceSpec.name).should('be.visible')

    // ============================================
    // Step 10: Verify resources Inventory
    // ============================================
    cy.getBySel('inventoryResources').click()

    // Verify resource spec appears
    cy.wait(2000)
    cy.contains(resourceSpec.name).should('be.visible')
  })
})

it('buy offering with service and resource', function() {});
