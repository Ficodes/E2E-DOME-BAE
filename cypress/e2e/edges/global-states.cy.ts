
import { HAPPY_JOURNEY } from '../../support/happy-journey-constants'
import {
  createOffering,
  updateOffering,
  clickLoadMoreUntilGone,
} from '../../support/form-helpers'
describe('Check order global states',  {
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
    it('should give the correct global state', () =>{
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

      
    })
})
