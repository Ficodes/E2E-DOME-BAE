// Import commands
import './commands'

const videoClockStartedAt = Date.now()
const videoClockId = 'cypress-video-clock'

function addVideoClock(win: Cypress.AUTWindow): void {
  try {
    const baseUrl = Cypress.config('baseUrl')
    if (!baseUrl || win.location.origin !== new URL(baseUrl).origin) return
    if (win.document.getElementById(videoClockId)) return

    const clock = win.document.createElement('div')
    clock.id = videoClockId
    clock.setAttribute('aria-hidden', 'true')
    Object.assign(clock.style, {
      position: 'fixed',
      top: '8px',
      left: '8px',
      zIndex: '2147483647',
      padding: '4px 8px',
      borderRadius: '4px',
      background: 'rgba(0, 0, 0, 0.75)',
      color: '#fff',
      font: '12px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      pointerEvents: 'none',
    })
    win.document.body.appendChild(clock)

    const updateClock = () => {
      const now = Date.now()
      const elapsedSeconds = ((now - videoClockStartedAt) / 1000).toFixed(3)
      clock.textContent = `${new Date(now).toISOString()} | +${elapsedSeconds}s`
    }

    updateClock()
    const intervalId = win.setInterval(updateClock, 100)
    win.addEventListener('beforeunload', () => win.clearInterval(intervalId), { once: true })
  } catch {
    // Cross-origin pages cannot be annotated from the Cypress support context.
  }
}

// The overlay is recorded in run-mode videos/screenshots but stays out of interactive open mode.
if (!Cypress.config('isInteractive')) {
  Cypress.on('window:load', addVideoClock)
}

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
