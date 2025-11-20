import { HAPPY_JOURNEY } from '../support/happy-journey-constants'
import {
  createCatalog,
  updateCatalogStatus,
  createProductSpec,
  updateProductSpecStatus,
  createOffering,
  updateOffering,
  createCheckoutBilling,
  createResourceSpec,
  createServiceSpec,
  updateResourceSpecStatus,
  updateServiceSpecStatus
} from '../support/form-helpers'

describe('Happy Journey E2E', {
  viewportHeight: 1080,
  viewportWidth: 1920,
}, () => {

  beforeEach(() => {
    cy.request({url: 'http://host.docker.internal:4201/clear', method: 'POST'}).then(
      (response) => {
        expect(response.status).to.eq(200)
      }
    )
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

  it('should complete the full happy journey: catalog → product spec → offering (all launched)', () => {
    const catalogName = HAPPY_JOURNEY.catalog.name
    const productSpecName = HAPPY_JOURNEY.productSpec.name
    const offeringName = HAPPY_JOURNEY.offering.name

    cy.intercept('POST', '**/ordering/productOrder').as('createOrder')
    cy.intercept('GET', '**/ordering/productOrder*').as('getOrders')
    cy.intercept('POST', '**/account/billingAccount').as('saveBilling')
    cy.intercept('GET', '**/account/billingAccount*').as('getBilling')

    // ============================================
    // Step 1: Create Catalog
    // ============================================
    createCatalog({
      name: catalogName,
      description: HAPPY_JOURNEY.catalog.description
    })

    // ============================================
    // Step 2: Update Catalog to Launched
    // ============================================
    updateCatalogStatus({ name: catalogName, status: 'launched'})

    // ============================================
    // Step 3: Create product, resource, service specification; Link resource/service spec to product spec
    // ============================================

    createServiceSpec(HAPPY_JOURNEY.serviceSpec)
    updateServiceSpecStatus({name: HAPPY_JOURNEY.serviceSpec.name, status: 'launched'})

    createResourceSpec(HAPPY_JOURNEY.resourceSpec)
    updateResourceSpecStatus({name: HAPPY_JOURNEY.resourceSpec.name, status: 'launched'})

    createProductSpec({
      name: productSpecName,
      brand: HAPPY_JOURNEY.productSpec.brand,
      productNumber: HAPPY_JOURNEY.productSpec.productNumber,
      serviceSpecName: HAPPY_JOURNEY.serviceSpec.name,
      resourceSpecName: HAPPY_JOURNEY.resourceSpec.name
    })

    // ============================================
    // Step 4: Update Product Spec to Launched
    // ============================================
    updateProductSpecStatus({ name: productSpecName , status: 'launched'})

    // ============================================
    // Step 5: Create Offering
    // ============================================
    createOffering({
      name: offeringName,
      description: HAPPY_JOURNEY.offering.description,
      productSpecName: productSpecName,
      catalogName: catalogName,
      detailedDescription: HAPPY_JOURNEY.offering.detailedDescription,
      mode: "paid",
      pricePlan: {name: HAPPY_JOURNEY.pricePlan.name, description: "descr"},
      priceComponent: {name: HAPPY_JOURNEY.priceComponent.name, description: "descr", price: HAPPY_JOURNEY.priceComponent.price, type: HAPPY_JOURNEY.priceComponent.type},
      procurement: "automatic"
    })

    // ============================================
    // Step 6: Update Offering to Launched
    // ============================================
    updateOffering({ name: offeringName, status: 'launched' })

    // ============================================
    // Final verification: All entities exist in tables
    // ============================================

    // Verify Catalog exists in table
    cy.visit('/my-offerings')
    cy.getBySel('catalogSection').click()
    cy.getBySel('catalogTable').should('be.visible')
    cy.getBySel('catalogTable').contains(catalogName).should('be.visible')

    // Verify Product Spec exists in table
    cy.getBySel('prdSpecSection').click()
    cy.getBySel('prodSpecTable').should('be.visible')
    cy.getBySel('prodSpecTable').contains(productSpecName).should('be.visible')

    // Verify Offering exists in table
    cy.getBySel('offerSection').click()
    cy.getBySel('offers').should('be.visible')
    cy.getBySel('offers').contains(offeringName).should('be.visible').parent().contains('Launched')

    // ============================================
    // Step 7: Set SELLER's country and Change session to BUYER ORG
    // ============================================
    cy.visit('/profile')
    cy.getBySel('orgCountry').select('ES')
    cy.getBySel('orgUpdate').click()

    cy.changeSessionTo('BUYER ORG')
    cy.visit('/profile')
    cy.getBySel('orgCountry').select('ES')
    cy.getBySel('orgUpdate').click()

    // ============================================
    // Step 8: Add offer to cart
    // ============================================
    cy.visit('/dashboard')
    // cy.contains(offeringName).find('[data-cy="addToCart"]').first().click()
    cy.getBySel('offFeatured').contains(catalogName).parent().find('[data-cy="viewService"]').click()
    cy.getBySel('baeCard').within(() => { cy.getBySel('addToCart').first().click() })
    cy.getBySel('pricePlanDrawer').contains(HAPPY_JOURNEY.pricePlan.name).click()
    cy.getBySel('acceptTermsCheckbox').click() // make sure terms and conditions are legible
    cy.getBySel('pricePlanDrawer').within(() => {
      cy.getBySel('addToCart').click()
    })

    cy.getBySel('shoppingCart').click()
    cy.getBySel('cartPurchase').click()

    // ============================================
    // Step 9: create billing address
    // ============================================

    cy.wait(2000)
    createCheckoutBilling({
      title: "billing 1",
      country: "ES",
      city: "Madrid",
      state: "Madrid",
      zip: "28000",
      street: "Gran Via 10",
      email: "buyer@test.com",
      phoneNumber: "600123456"
    })

    cy.wait('@saveBilling')
    cy.wait('@getBilling')
    // Wait for the billing address to be processed and selected
    cy.wait(2000)
    cy.getBySel('checkout').should('be.visible').should('not.be.disabled').click()
    cy.wait('@createOrder', { timeout: 60000 })
    cy.wait('@getOrders')
    cy.visit('http://localhost:4201/checkin')

    // ============================================
    // Step 10: Verify Customer Bill was created
    // ============================================

    cy.getBySel('ordersTable', { timeout: 60000 }).should('be.visible')
    cy.getBySel('ordersTable').contains('completed')
    cy.getBySel('invoices').click()
    cy.getBySel('invoiceRow').should('have.length', 1).within(()=>{
      cy.contains('settled').should('be.visible')
      cy.get('button').should('have.length.greaterThan', 0).first().click()
    })
    cy.getBySel('invoiceDetail').contains('INITIAL PAYMENT')

    // ============================================
    // Step 11: Verify Product Inventory
    // ============================================

    cy.visit('/product-inventory')
    cy.getBySel('productInventory').contains('[data-cy="productInventory"]', offeringName).contains('active')

    // ============================================
    // Step 12: Verify service Inventory
    // ============================================
    cy.getBySel('inventoryServices').click()

    // Verify service spec appears
    cy.wait(2000)
    cy.contains(HAPPY_JOURNEY.serviceSpec.name).should('be.visible')

    // ============================================
    // Step 13: Verify resources Inventory
    // ============================================
    cy.getBySel('inventoryResources').click()

    // Verify resource spec appears
    cy.wait(2000)
    cy.contains(HAPPY_JOURNEY.resourceSpec.name).should('be.visible')

  })
})
