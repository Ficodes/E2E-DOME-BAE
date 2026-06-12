// Import commands
import './commands'

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
       * Complete the pending checkout, redirecting back to the order's success url
       * @example cy.completePayment()
       */
      completePayment(): Chainable<void>

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
    }
  }
}

// Custom command to select elements by data-cy attribute
Cypress.Commands.add('getBySel', (selector: string, options?: any) => {
  return cy.get(`[data-cy="${selector}"]`, options)
})
