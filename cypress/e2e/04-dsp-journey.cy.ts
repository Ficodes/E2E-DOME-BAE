import { DSP_JOURNEY } from '../support/dsp-constants'
import {
  createDspProductSpec,
  updateDspProductSpecStatus,
  createDspOffering,
  updateOffering
} from '../support/form-helpers'
import { HAPPY_JOURNEY } from '../support/happy-journey-constants'

describe('DSP Journey E2E', {
  viewportHeight: 1080,
  viewportWidth: 1920,
}, () => {

  beforeEach(() => {
    cy.request({ url: 'http://localhost:4201/clear', method: 'POST' }).then((response) => {
      expect(response.status).to.eq(200)
    })
    cy.loginAsAdmin()
    cy.on('uncaught:exception', (err) => {
      console.error('Uncaught exception:', err.message)
      if (err.message.includes("Unexpected token '<'")) {
        return false
      }
    })
  })

  it('should create a DSP-compatible product spec and offering with contract definition', () => {
    const catalogName = HAPPY_JOURNEY.catalog.name
    const productSpecName = DSP_JOURNEY.productSpec.name
    const offeringName = DSP_JOURNEY.offering.name


    // ============================================
    // Step 1: Create DSP-compatible Product Spec
    // Enables DSP toggle and fills dsp_config step:
    //   - Endpoint (name, URL, description) → Add
    //   - Upstream Address
    //   - Target Specification (JSON)
    //   - Service Configuration (JSON)
    //   - Credentials Configuration (JSON)
    //   - Policy Configuration (JSON)
    // ============================================
    createDspProductSpec({
      name: productSpecName,
      brand: DSP_JOURNEY.productSpec.brand,
      productNumber: DSP_JOURNEY.productSpec.productNumber,
      dspConfig: DSP_JOURNEY.dspConfig
    })

    updateDspProductSpecStatus({ name: productSpecName, status: 'launched' })

    // ============================================
    // Step 2: Create DSP Offering with Contract Definition
    // Selects DSP product spec → contract definition step auto-appears:
    //   - Activate DSP compatible toggle
    //   - Fill Access Policy (JSON)
    //   - Fill Contract Policy (JSON)
    // ============================================
    createDspOffering({
      name: offeringName,
      description: DSP_JOURNEY.offering.description,
      productSpecName: productSpecName,
      catalogName: catalogName,
      detailedDescription: DSP_JOURNEY.offering.detailedDescription,
      procurement: 'automatic',
      pricePlan: { name: DSP_JOURNEY.pricePlan.name, description: 'DSP price plan' },
      priceComponent: {
        name: DSP_JOURNEY.priceComponent.name,
        description: 'DSP price component',
        price: DSP_JOURNEY.priceComponent.price,
        type: DSP_JOURNEY.priceComponent.type
      },
      contractDefinition: DSP_JOURNEY.contractDefinition
    })

    // ============================================
    // Step 3: Launch Offering
    // ============================================
    updateOffering({ name: offeringName, status: 'launched' })

    // ============================================
    // Step 4: Verify all entities exist and are launched
    // ============================================
    cy.visit('/my-offerings')
    cy.getBySel('catalogSection').click()
    cy.getBySel('catalogTable').contains(catalogName).should('be.visible')

    cy.getBySel('prdSpecSection').click()
    cy.getBySel('prodSpecTable').contains(productSpecName).should('be.visible')

    cy.getBySel('offerSection').click()
    cy.getBySel('offers').contains(offeringName).should('be.visible').parent().contains('Launched')

    // ============================================
    // Step 5: Verify DSP offering appears in search
    // ============================================
    cy.visit('/search')
    cy.getBySel('baeCard').should('be.visible')
    cy.contains(offeringName).should('be.visible')
  })
})
