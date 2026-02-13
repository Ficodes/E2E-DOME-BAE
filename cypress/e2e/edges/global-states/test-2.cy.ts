
import { HAPPY_JOURNEY } from '../../../support/happy-journey-constants'
import {
  setupGlobalStateBefore,
} from '../../../support/global-state-flows'
import {
  clickLoadMoreUntilGone,
} from '../../../support/form-helpers'

describe('Check order global states - Reverse test (auto and semi failed, iterate manual)',  {
  viewportHeight: 1080,
  viewportWidth: 1920,
  defaultCommandTimeout: 60000
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
      cy.request({url: 'http://localhost:4201/clear', method: 'POST'}).then(
        (response) => {
          expect(response.status).to.eq(200)
        }
      )
      cy.intercept('POST', '**/billing/order/').as('postOrder')
      cy.intercept('POST', '**/shoppingCart/item/').as('postCart')
      cy.intercept('POST', '**/ordering/productOrder').as('createOrder')
      cy.intercept('GET', '**/ordering/productOrder*').as('getOrders')
      cy.intercept('GET', '**/account/billingAccount*').as('getBilling')

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

      //cy.getBySel('offFeatured').contains(catalogName).parent().find('[data-cy="viewService"]').should('be.visible').click()
      cy.visit('/search')
      cy.wait('@cartItem')

      clickLoadMoreUntilGone(10, true)

      // AUTO
      cy.contains('[data-cy="baeCard"]', offeringAutoName).within(() => {
        cy.getBySel('addToCart').first().click()
      })
      cy.contains('[data-cy="toCartDrawer"]', `Adding ${offeringAutoName} to cart`).within(() => {
        cy.contains(HAPPY_JOURNEY.pricePlan.name).click()
        cy.getBySel('acceptTermsCheckbox').click()
        cy.getBySel('addToCart').click()
      })
      cy.wait('@postOrder')
      cy.wait('@postCart')

      //SEMI
      cy.contains('[data-cy="baeCard"]', offeringSemiName).within(() => {
        cy.getBySel('addToCart').first().click()
      })
      cy.contains('[data-cy="toCartDrawer"]', `Adding ${offeringSemiName} to cart`).within(() => {
        cy.contains(HAPPY_JOURNEY.pricePlan.name).click()
        cy.getBySel('acceptTermsCheckbox').click()
        cy.getBySel('addToCart').click()
      })
      cy.wait('@postOrder')
      cy.wait('@postCart')

      //MANUAL
      cy.contains('[data-cy="baeCard"]', offeringManualName).within(() => {
        cy.getBySel('addToCart').first().click()
      })
      cy.contains('[data-cy="toCartDrawer"]', `Adding ${offeringManualName} to cart`).within(() => {
        cy.contains(HAPPY_JOURNEY.pricePlan.name).click()
        cy.getBySel('acceptTermsCheckbox').click()
        cy.getBySel('addToCart').click()
      })
      cy.wait('@postOrder')
      cy.wait('@postCart')

      cy.getBySel('shoppingCart').click()
      cy.getBySel('cartPurchase').click()

      cy.intercept('POST', '**/ordering/productOrder').as('createOrder')
      cy.intercept('GET', '**/ordering/productOrder*').as('getOrders')
      cy.intercept('GET', '**/account/billingAccount*').as('getBilling')

      cy.wait(2000)
      cy.wait('@getBilling')
      cy.wait(2000)
      cy.getBySel('checkout').should('be.visible').should('not.be.disabled').click()
      cy.wait('@createOrder')
      cy.wait('@getOrders')

      // Fail the auto and semi offering
      cy.intercept('**/charging/api/orderManagement/orders/confirm/').as('checkin')
      cy.visit('http://localhost:4201/bad-checkin')
      cy.wait('@checkin')
      cy.wait(2000)
      cy.visit('/')
      cy.changeSessionTo('SELLER ORG')
      // Navigate to product orders as provider
      cy.visit('/product-orders')
      cy.getBySel('asProviderTab').click()
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
      cy.getBySel('confirmActionBtn').click()
      cy.wait(2000)

      cy.getBySel('ordersTable').find('tbody tr').first().within(() => {
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
      cy.getBySel('confirmActionBtn').click()
      cy.wait(2000)

      cy.getBySel('ordersTable').find('tbody tr').first().within(() => {
        cy.getBySel('viewOrderDetails').click()
      })

      // Start manual treatment
      cy.getBySel('orderItems').contains('tr', manualName).within(() => {
        cy.getBySel('startOrderTreatment').click()
      })
      cy.getBySel('confirmActionBtn').click()
      cy.wait(2000)

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
      cy.getBySel('confirmActionBtn').click()
      cy.wait(2000)

      cy.getBySel('ordersTable').find('tbody tr').first().within(() => {
        cy.getBySel('viewOrderDetails').click()
      })

      // Start manual treatment
      cy.getBySel('orderItems').contains('tr', manualName).within(() => {
        cy.getBySel('startOrderTreatment').click()
      })
      cy.getBySel('confirmActionBtn').click()
      cy.wait(2000)

      cy.getBySel('ordersTable').find('tbody tr').first().within(() => {
        cy.getBySel('viewOrderDetails').click()
      })

      // Complete manual
      cy.getBySel('orderItems').contains('tr', manualName).within(() => {
        cy.getBySel('completeOrder').click()
      })
      cy.getBySel('confirmActionBtn').click()
      cy.wait(2000)

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
      cy.getBySel('confirmActionBtn').click()
      cy.wait(2000)

      cy.getBySel('ordersTable').find('tbody tr').first().within(() => {
        cy.getBySel('viewOrderDetails').click()
      })

      // Start manual treatment
      cy.getBySel('orderItems').contains('tr', manualName).within(() => {
        cy.getBySel('startOrderTreatment').click()
      })
      cy.getBySel('confirmActionBtn').click()
      cy.wait(2000)

      cy.getBySel('ordersTable').find('tbody tr').first().within(() => {
        cy.getBySel('viewOrderDetails').click()
      })

      // Fail manual
      cy.getBySel('orderItems').contains('tr', manualName).within(() => {
        cy.getBySel('failOrder').click()
      })
      cy.getBySel('confirmActionBtn').click()
      cy.wait(2000)

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
      cy.getBySel('confirmActionBtn').click()
      cy.wait(2000)

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
