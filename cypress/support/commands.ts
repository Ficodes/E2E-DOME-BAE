import { ADMIN_USER } from './constants'

// Real login through IDM
Cypress.Commands.add('loginAsAdmin', () => {
  cy.visit('/')

  // Click login button
  cy.getBySel('login').click()

  // Handle login in IDM (Keyrock) - it redirects to idm.docker:3000
  cy.origin('http://idm.docker:3000', { args: { email: ADMIN_USER.email, password: ADMIN_USER.password } }, ({ email, password }) => {
    // Wait for login form
    cy.get('input[name="email"]', { timeout: 10000 }).should('be.visible')
    cy.get('input[name="email"]').type(email)
    cy.get('input[name="password"]').type(password)
    cy.get('button[type="submit"]').click()

    // Check if Authorize button appears and click it if it does
    cy.wait(500)
    cy.location('origin').then((origin) => {
      if (origin === 'http://idm.docker:3000') {
        cy.get('body').then($body => {
          if ($body.text().includes('Authorize')) {
            cy.contains('button', 'Authorize').click()
          }
        })
      }
    })
  })

  // Wait for redirect back to frontend
  cy.url().should('include', 'localhost:4200', { timeout: 10000 })

  // Verify logged in
  cy.getBySel('loggedAcc').should('exist')
})

// Close feedback modal if it appears
Cypress.Commands.add('closeFeedbackModalIfVisible', () => {
  // Wait a bit for modal to potentially appear
  cy.wait(3000)

  // Try to find and close the modal with multiple retries
  cy.get('body').then($body => {
    const modalText = $body.text()
    if (modalText.includes('Based on your recent experience') ||
        modalText.includes('how likely are you to recommend')) {
      // Modal exists, try to close it
      cy.get('button[data-modal-hide="details-modal"]')
        .should('be.visible')
        .click({ force: true })
        .then(() => {
          // Wait a bit for modal to close
          cy.wait(500)
        })
    }
  })
})

// Change session to a specific organization
Cypress.Commands.add('changeSessionTo', (organizationName: string) => {
  // Open user dropdown
  cy.getBySel('loggedAcc').click()

  // Click on "Change session" button
  cy.getBySel('changeSession').should('be.visible').click()

  // Wait for organizations dropdown to appear and select organization by name
  cy.getBySel('orgsDropdown').should('be.visible').contains('button', organizationName).click()

  // Wait for session change to complete
  cy.wait(1000)
})
