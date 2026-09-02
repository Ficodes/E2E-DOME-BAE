
import { HAPPY_JOURNEY } from '../../../support/happy-journey-constants'
import {
  setupGlobalStateBefore,
  confirmOrderAction,
} from '../../../support/global-state-flows'
import {
  clickLoadMoreUntilFound,
  createRequestTracker,
} from '../../../support/form-helpers'

describe('Check order global states - Reverse test (auto and semi failed, iterate manual)',  {
  viewportHeight: 1080,
  viewportWidth: 1920,
  defaultCommandTimeout: 200000
}, () => {
    const autoName = 'Auto Payment'
    const semiName = 'Semi Proc'
    const manualName = 'Manual Payment'

    // Use the same catalog and product spec from happy journey
    const catalogName = HAPPY_JOURNEY.catalog.name
    const productSpecName = HAPPY_JOURNEY.productSpec.name

    const dateNow = Date.now()
    const offeringAutoName = `${autoName} ${dateNow}`
    const offeringSemiName = `${semiName} ${dateNow}`
    const offeringManualName = `${manualName} ${dateNow}`

    before(() => {
      setupGlobalStateBefore({
        catalogName,
        productSpecName,
        offeringAutoName,
        offeringSemiName,
        offeringManualName
      })
    })

    /**
     * Custom beforeEach that sets auto and semi to failed state
     * Then manual can be iterated through different states
     */
    beforeEach(() => {
      cy.clearBilling()
      cy.intercept('POST', '**/billing/order/').as('postOrder')
      cy.intercept('POST', '**/shoppingCart/item/').as('postCart')
      cy.intercept('POST', '**/ordering/productOrder').as('createOrder')
      cy.intercept('GET', '**/ordering/productOrder*').as('getOrders')
      cy.intercept('GET', '**/ordering/productOrder?*relatedParty.role=seller*').as('getProviderOrders')
      cy.intercept('GET', '**/account/billingAccount*').as('getBilling')
      cy.intercept('GET', '**/catalog/productOffering?*', (request) => {
        delete request.headers['if-none-match']
      })
      cy.intercept('PATCH', '**/ordering/productOrder/**').as('patchOrder')

      cy.loginAsAdmin()
      cy.on('uncaught:exception', (err) => {
        // Log all errors to help debug
        console.error('Uncaught exception:', err.message)
        // Ignore cross-origin errors from proxy.docker
        if (err.message.includes("Unexpected token '<'")) {
          return false
        }
      })

      cy.visit('/dashboard')
      cy.changeSessionTo('BUYER ORG')
      cy.intercept('GET', '**/shoppingCart/item/').as('cartItem')

      const catalogTracker = createRequestTracker('**/catalog/productOffering?*')
      const openOfferingDrawer = (offeringName: string) => {
        catalogTracker.waitForAction(() => cy.visit('/search'))
        cy.wait('@cartItem')
        clickLoadMoreUntilFound(offeringName, '[data-cy="baeCard"]')
        cy.openAddToCartDrawerFromSearch(offeringName)
      }


      // AUTO
      openOfferingDrawer(offeringAutoName)
      cy.contains('[data-cy="toCartDrawer"]', `Adding ${offeringAutoName} to cart`).within(() => {
        cy.contains(HAPPY_JOURNEY.pricePlan.name).click()
        cy.getBySel('acceptTermsCheckbox').click()
        cy.getBySel('addToCart').click()
      })
      cy.wait('@postOrder')
      cy.wait('@postCart')

      //SEMI
      openOfferingDrawer(offeringSemiName)
      cy.contains('[data-cy="toCartDrawer"]', `Adding ${offeringSemiName} to cart`).within(() => {
        cy.contains(HAPPY_JOURNEY.pricePlan.name).click()
        cy.getBySel('acceptTermsCheckbox').click()
        cy.getBySel('addToCart').click()
      })
      cy.wait('@postOrder')
      cy.wait('@postCart')

      //MANUAL
      openOfferingDrawer(offeringManualName)
      cy.contains('[data-cy="toCartDrawer"]', `Adding ${offeringManualName} to cart`).within(() => {
        cy.contains(HAPPY_JOURNEY.pricePlan.name).click()
        cy.getBySel('acceptTermsCheckbox').click()
        cy.getBySel('addToCart').click()
      })
      cy.wait('@postOrder')
      cy.wait('@postCart')

      cy.getBySel('shoppingCart').click()
      cy.getBySel('cartPurchase').click()

      cy.deferPaymentRedirect()
      cy.intercept('GET', '**/ordering/productOrder*').as('getOrders')
      cy.intercept('GET', '**/account/billingAccount*').as('getBilling')

      cy.wait('@getBilling')
      cy.getBySel('checkout').should('be.visible').should('not.be.disabled').click()
      cy.wait('@createOrder')
      cy.waitForOrdersBeforePayment()

      // Fail the auto and semi offering
      cy.intercept('**/charging/api/orderManagement/orders/confirm/').as('checkin')
      cy.cancelPayment()
      cy.wait('@checkin')
      cy.visit('/')
      cy.changeSessionTo('SELLER ORG')
      // Navigate to product orders as provider
      cy.visit('/product-orders')
      cy.getBySel('asProviderTab').should('be.visible').click()
      cy.wait('@getProviderOrders')
      cy.getBySel('ordersTable').should('be.visible')

      // Find the most recent order and set auto and semi to failed
      cy.getBySel('ordersTable').find('tbody tr').first().within(() => {
        cy.contains(/inprogress/i)
        cy.getBySel('viewOrderDetails').click()
      })

      // Verify auto and semi are failed, manual is unchecked
      cy.getBySel('orderItems').contains('tr', autoName).contains(/failed/i)
      cy.getBySel('orderItems').contains('tr', semiName).contains(/failed/i)
      cy.getBySel('orderItems').contains('tr', manualName).contains(/unchecked/i)
    })

    it('should show inProgress global state when auto and semi are failed and manual is unchecked', () => {
      // Check global state with auto=failed, semi=failed, manual=unchecked
      cy.getBySel('globalState').contains(/inprogress/i)
      cy.getBySel('orderItems').contains('tr', autoName).contains(/failed/i)
      cy.getBySel('orderItems').contains('tr', semiName).contains(/failed/i)
      cy.getBySel('orderItems').contains('tr', manualName).contains(/unchecked/i)
    })

    it('should show inProgress global state when auto and semi are failed and manual is acknowledged', () => {
      // Acknowledge manual
      cy.getBySel('orderItems').contains('tr', manualName).within(() => {
        cy.getBySel('acknowledgeOrder').click()
      })
      confirmOrderAction()

      cy.getBySel('ordersTable').should('be.visible').find('tbody tr').first().within(() => {
        cy.getBySel('viewOrderDetails').click()
      })

      // Check global state with auto=failed, semi=failed, manual=acknowledged
      cy.getBySel('globalState').contains(/inprogress/i)
      cy.getBySel('orderItems').contains('tr', autoName).contains(/failed/i)
      cy.getBySel('orderItems').contains('tr', semiName).contains(/failed/i)
      cy.getBySel('orderItems').contains('tr', manualName).contains(/acknowledged/i)
    })

    it('should show inProgress global state when auto and semi are failed and manual is inProgress', () => {
      // Acknowledge manual
      cy.getBySel('orderItems').contains('tr', manualName).within(() => {
        cy.getBySel('acknowledgeOrder').click()
      })
      confirmOrderAction()

      cy.getBySel('ordersTable').find('tbody tr').first().within(() => {
        cy.getBySel('viewOrderDetails').click()
      })

      // Start manual treatment
      cy.getBySel('orderItems').contains('tr', manualName).within(() => {
        cy.getBySel('startOrderTreatment').click()
      })
      confirmOrderAction()

      cy.getBySel('ordersTable').find('tbody tr').first().within(() => {
        cy.getBySel('viewOrderDetails').click()
      })

      // Check global state with auto=failed, semi=failed, manual=inProgress
      cy.getBySel('globalState').contains(/inprogress/i)
      cy.getBySel('orderItems').contains('tr', autoName).contains(/failed/i)
      cy.getBySel('orderItems').contains('tr', semiName).contains(/failed/i)
      cy.getBySel('orderItems').contains('tr', manualName).contains(/inprogress/i)
    })

    it('should show partial global state when auto and semi are failed and manual is completed', () => {
      // Acknowledge manual
      cy.getBySel('orderItems').contains('tr', manualName).within(() => {
        cy.getBySel('acknowledgeOrder').click()
      })
      confirmOrderAction()

      cy.getBySel('ordersTable').find('tbody tr').first().within(() => {
        cy.getBySel('viewOrderDetails').click()
      })

      // Start manual treatment
      cy.getBySel('orderItems').contains('tr', manualName).within(() => {
        cy.getBySel('startOrderTreatment').click()
      })
      confirmOrderAction()

      cy.getBySel('ordersTable').find('tbody tr').first().within(() => {
        cy.getBySel('viewOrderDetails').click()
      })

      // Complete manual
      cy.getBySel('orderItems').contains('tr', manualName).within(() => {
        cy.getBySel('completeOrder').click()
      })
      confirmOrderAction()

      cy.getBySel('ordersTable').find('tbody tr').first().within(() => {
        cy.getBySel('viewOrderDetails').click()
      })

      // Check global state with auto=failed, semi=failed, manual=completed
      cy.getBySel('globalState').contains(/partial/i)
      cy.getBySel('orderItems').contains('tr', autoName).contains(/failed/i)
      cy.getBySel('orderItems').contains('tr', semiName).contains(/failed/i)
      cy.getBySel('orderItems').contains('tr', manualName).contains(/completed/i)
    })

    it('should show failed global state when auto and semi are failed and manual is also failed', () => {
      // Acknowledge manual
      cy.getBySel('orderItems').contains('tr', manualName).within(() => {
        cy.getBySel('acknowledgeOrder').click()
      })
      confirmOrderAction()

      cy.getBySel('ordersTable').find('tbody tr').first().within(() => {
        cy.getBySel('viewOrderDetails').click()
      })

      // Start manual treatment
      cy.getBySel('orderItems').contains('tr', manualName).within(() => {
        cy.getBySel('startOrderTreatment').click()
      })
      confirmOrderAction()

      cy.getBySel('ordersTable').find('tbody tr').first().within(() => {
        cy.getBySel('viewOrderDetails').click()
      })

      // Fail manual
      cy.getBySel('orderItems').contains('tr', manualName).within(() => {
        cy.getBySel('failOrder').click()
      })
      confirmOrderAction()

      cy.getBySel('ordersTable').find('tbody tr').first().within(() => {
        cy.getBySel('viewOrderDetails').click()
      })

      // Check global state with auto=failed, semi=failed, manual=failed
      cy.getBySel('globalState').contains(/failed/i)
      cy.getBySel('orderItems').contains('tr', autoName).contains(/failed/i)
      cy.getBySel('orderItems').contains('tr', semiName).contains(/failed/i)
      cy.getBySel('orderItems').contains('tr', manualName).contains(/failed/i)
    })

    it('should show partial global state when auto and semi are failed and manual is cancelled', () => {
      // Reject manual
      cy.getBySel('orderItems').contains('tr', manualName).within(() => {
        cy.getBySel('rejectOrder').click()
      })
      confirmOrderAction()

      cy.getBySel('ordersTable').find('tbody tr').first().within(() => {
        cy.getBySel('viewOrderDetails').click()
      })

      // Check global state with auto=failed, semi=failed, manual=cancelled
      cy.getBySel('globalState').contains(/partial/i)
      cy.getBySel('orderItems').contains('tr', autoName).contains(/failed/i)
      cy.getBySel('orderItems').contains('tr', semiName).contains(/failed/i)
      cy.getBySel('orderItems').contains('tr', manualName).contains(/cancelled/i)
    })
})
