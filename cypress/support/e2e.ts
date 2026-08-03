// Import commands
import './commands'

afterEach(() => {
  if (Cypress.env('PAYMENT_METHOD') === 'redsys') {
    cy.visit('/')
  }
})

// Extend Cypress namespace with custom commands
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to select elements by data-cy attribute
       * @param selector - The data-cy attribute value
       * @param options - Optional Cypress options
       * @example cy.getBySel('login')
       */
      getBySel(selector: string, options?: Partial<Cypress.Loggable & Cypress.Timeoutable & Cypress.Withinable & Cypress.Shadow>): Chainable<JQuery<HTMLElement>>

      /**
       * Login as admin user through IDM
       * @example cy.loginAsAdmin()
       */
      loginAsAdmin(): Chainable<void>

      /**
       * Close feedback modal if it appears
       * @example cy.closeFeedbackModalIfVisible()
       */
      closeFeedbackModalIfVisible(): Chainable<void>

      /**
       * Change session to a specific organization
       * @param organizationName - Name of the organization
       * @example cy.changeSessionTo('SELLER ORG')
       */
      changeSessionTo(organizationName: string): Chainable<void>

      /**
       * Reset the mock billing-server's payment gateway state (Stripe by default)
       * @example cy.clearBilling()
       */
      clearBilling(): Chainable<void>

      /**
       * Save the next payment redirect so the test can complete or cancel it later.
       * @example cy.deferPaymentRedirect()
       */
      deferPaymentRedirect(): Chainable<void>

      /**
       * Wait for orders before payment when using a mock payment gateway.
       * Redsys skips this wait so Cypress can complete its external form first.
       * @example cy.waitForOrdersBeforePayment()
       */
      waitForOrdersBeforePayment(): Chainable<void>

      /**
       * Wait for orders after payment when using Redsys.
       * @example cy.waitForOrdersAfterPayment()
       */
      waitForOrdersAfterPayment(): Chainable<void>

      /**
       * Complete the pending checkout, redirecting back to the order's success url
       * @param options - Set recurring for Redsys payments that require 3DS authentication
       * @example cy.completePayment({ recurring: true })
       */
      completePayment(options?: { recurring?: boolean }): Chainable<void>

      /**
       * Cancel the pending checkout, redirecting back to the order's cancel url
       * @example cy.cancelPayment()
       */
      cancelPayment(): Chainable<void>

      /**
       * Mark the next checkout as left pending instead of completed
       * @example cy.setPaymentPending()
       */
      setPaymentPending(): Chainable<void>

      /**
       * Open an offering details page from search and click its add-to-cart button.
       * @param offeringName - Name of the offering card to open
       * @example cy.openAddToCartDrawerFromSearch('E2E Test Offering')
       */
      openAddToCartDrawerFromSearch(offeringName: string): Chainable<void>
    }
  }
}

// Custom command to select elements by data-cy attribute
Cypress.Commands.add('getBySel', (selector: string, options?: any) => {
  return cy.get(`[data-cy="${selector}"]`, options)
})
