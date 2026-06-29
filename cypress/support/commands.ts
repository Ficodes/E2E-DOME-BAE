import { ADMIN_USER } from './constants'

// Real login through IDM
Cypress.Commands.add('loginAsAdmin', () => {
  cy.session('admin', () => {
    cy.visit('/')

    cy.getBySel('login').click()

    cy.origin('http://idm.docker:3000', { args: { email: ADMIN_USER.email, password: ADMIN_USER.password } }, ({ email, password }) => {
      cy.get('input[name="email"]', { timeout: 10000 }).should('be.visible')
      cy.get('input[name="email"]').type(email)
      cy.get('input[name="password"]').type(password)
      cy.get('button[type="submit"]').click()

      cy.wait(500)
      cy.location('origin').then((origin) => {
        if (origin === 'http://idm.docker:3000') {
          cy.get('body').then($body => {
            if ($body.text().includes('Authorize')) {
              cy.contains('button', 'Authorize').click()
            } else if ($body.text().includes('Autorizar')) {
              cy.contains('button', 'Autorizar').click()
            }
          })
        }
      })
    })

    cy.url().should('include', 'localhost:4200', { timeout: 10000 })
    cy.getBySel('loggedAcc').should('exist')
  }, {
    validate: () => {
      cy.visit('/dashboard')
      cy.getBySel('loggedAcc').should('exist')
    }
  })

  cy.visit('/dashboard')
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

const BILLING_SERVER_URL = 'http://localhost:4201'

// Payment gateway endpoints are namespaced under /stripe for the Stripe client;
// the DPAS client uses the unprefixed endpoints.
const PAYMENT_PREFIX = Cypress.env('PAYMENT_METHOD') === 'dpas' ? '' : '/stripe'

// Reset the mock billing-server's payment gateway state (Stripe by default)
Cypress.Commands.add('clearBilling', () => {
  cy.request({ url: `${BILLING_SERVER_URL}${PAYMENT_PREFIX}/clear`, method: 'POST' }).then((response) => {
    expect(response.status).to.eq(200)
  })
})

// Complete the pending checkout, redirecting back to the order's success url
Cypress.Commands.add('completePayment', () => {
  cy.visit(`${BILLING_SERVER_URL}${PAYMENT_PREFIX}/checkin`)
})

// Cancel the pending checkout, redirecting back to the order's cancel url
Cypress.Commands.add('cancelPayment', () => {
  cy.visit(`${BILLING_SERVER_URL}${PAYMENT_PREFIX}/bad-checkin`)
})

// Mark the next checkout as left pending instead of completed
Cypress.Commands.add('setPaymentPending', () => {
  cy.request({ url: `${BILLING_SERVER_URL}${PAYMENT_PREFIX}/set-pending`, method: 'GET' }).then((response) => {
    expect(response.status).to.eq(200)
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

// Open the add-to-cart drawer from the new search card flow.
Cypress.Commands.add('openAddToCartDrawerFromSearch', (offeringName: string) => {
  cy.contains('[data-cy="baeCard"]', offeringName).should('be.visible').click()
  cy.url().should('include', '/search/')
  cy.contains('h1', offeringName).should('be.visible')
  cy.getBySel('openAddToCartDrawer').filter(':visible').should('not.be.disabled').click()
})
