import { HAPPY_JOURNEY } from '../support/happy-journey-constants'

/**
 * Deploy Validation Test
 * This test validates that the deployed DOME marketplace is publicly accessible.
 * IMPORTANT: This test runs WITHOUT login to verify public visibility.
 */
describe('Deploy Validation (Public Access)', {
  viewportHeight: 1080,
  viewportWidth: 1920,
}, () => {

  beforeEach(() => {
    // Handle any uncaught exceptions gracefully
    cy.on('uncaught:exception', (err) => {
      console.error('Uncaught exception:', err.message)
      if (err.message.includes("Unexpected token '<'")) {
        return false
      }
    })
  })

  it('should display categories and offerings in dashboard without login', () => {

    cy.visit('/dashboard')

    cy.getBySel('categoryItem') // at least 1 item

    cy.intercept('GET', '**catalog/category?*').as('categoryList')
    cy.getBySel('browse').click()
    cy.getBySel('browseServices').click()
    cy.wait('@categoryList')

    cy.getBySel('baeCard')
    cy.getBySel('categoryItemService')

  })

})
