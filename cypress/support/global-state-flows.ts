import { HAPPY_JOURNEY } from './happy-journey-constants'
import {
  createOffering,
  updateOffering,
  clickLoadMoreUntilGone,
  clickLoadMoreUntilFound,
  createRequestTracker,
  waitForInitialPaginatedList,
  waitForPaginatedTab,
} from './form-helpers'

export const unchecked= 'unchecked'
export const ack = 'acknowledged'
export const inProgress = 'inProgress'
export const completed = 'completed'
export const cancelled = 'cancelled'
export const failed = 'failed'

export function confirmOrderAction(): void {
  cy.getBySel('confirmActionBtn').click()
  cy.wait('@patchOrder')
  cy.wait('@patchOrder')
}

interface GlobalStateSetupParams {
  catalogName: string
  productSpecName: string
  offeringAutoName: string
  offeringSemiName: string
  offeringManualName: string
}

/**
 * Setup function for the 'before' hook in global states tests
 * Creates the necessary offerings and prepares the environment
 */
export function setupGlobalStateBefore(params: GlobalStateSetupParams) {
  const { catalogName, productSpecName, offeringAutoName, offeringSemiName, offeringManualName } = params

  cy.clearBilling()
  cy.loginAsAdmin()
  cy.on('uncaught:exception', (err) => {
    // Log all errors to help debug
    console.error('Uncaught exception:', err.message)
    // Ignore cross-origin errors from proxy.docker
    if (err.message.includes("Unexpected token '<'")) {
      return false
    }
  })
  // Verify that catalog and product spec exist (from happy journey test)
  cy.visit('/my-offerings')
  waitForInitialPaginatedList('**/catalog/catalog?*', () => {
    cy.getBySel('catalogSection').click()
  })
  waitForPaginatedTab('**/catalog/catalog?*lifecycleStatus=Launched*', () => {
    cy.contains('button', 'Published').click()
  })
  cy.getBySel('catalogTable').should('be.visible')
  clickLoadMoreUntilGone(10, '[data-cy="catalogRow"]')
  cy.getBySel('catalogTable').contains(catalogName).should('be.visible')

  waitForInitialPaginatedList('**/catalog/productSpecification?*', () => {
    cy.getBySel('prdSpecSection').click()
  })
  waitForPaginatedTab('**/catalog/productSpecification?*lifecycleStatus=Launched*', () => {
    cy.contains('button', 'Validated').click()
  })
  cy.getBySel('prodSpecTable').should('be.visible')
  clickLoadMoreUntilGone(10, '[data-cy="prodSpecRow"]')
  cy.getBySel('prodSpecTable').contains(productSpecName).should('be.visible')

  createOffering({
        name: offeringAutoName,
        description: HAPPY_JOURNEY.offering.description,
        productSpecName: productSpecName,
        catalogName: catalogName,
        detailedDescription: HAPPY_JOURNEY.offering.detailedDescription,
        mode: "paid",
        pricePlan: {name: HAPPY_JOURNEY.pricePlan.name, description: "descr"},
        priceComponent: {name: HAPPY_JOURNEY.priceComponent.name, description: "descr", price: HAPPY_JOURNEY.priceComponent.price, type: HAPPY_JOURNEY.priceComponent.type},
        procurement: "automatic"
      })


  updateOffering({ name: offeringAutoName, status: 'launched' })

  createOffering({
        name: offeringManualName,
        description: HAPPY_JOURNEY.offering.description,
        productSpecName: productSpecName,
        catalogName: catalogName,
        detailedDescription: HAPPY_JOURNEY.offering.detailedDescription,
        mode: "paid",
        pricePlan: {name: HAPPY_JOURNEY.pricePlan.name, description: "descr"},
        priceComponent: {name: HAPPY_JOURNEY.priceComponent.name, description: "descr", price: HAPPY_JOURNEY.priceComponent.price, type: HAPPY_JOURNEY.priceComponent.type},
        procurement: "manual"
      })

  updateOffering({ name: offeringManualName, status: 'launched' })

  createOffering({
        name: offeringSemiName,
        description: HAPPY_JOURNEY.offering.description,
        productSpecName: productSpecName,
        catalogName: catalogName,
        detailedDescription: HAPPY_JOURNEY.offering.detailedDescription,
        mode: "paid",
        pricePlan: {name: HAPPY_JOURNEY.pricePlan.name, description: "descr"},
        priceComponent: {name: HAPPY_JOURNEY.priceComponent.name, description: "descr", price: HAPPY_JOURNEY.priceComponent.price, type: HAPPY_JOURNEY.priceComponent.type},
        procurement: "payment-automatic"
      })

  updateOffering({ name: offeringSemiName, status: 'launched' })
}

/**
 * Setup function for the 'beforeEach' hook in global states tests
 * Prepares the order with all three offerings in the expected initial state
 */
export function setupGlobalStateBeforeEach(params: GlobalStateSetupParams & { autoName: string, semiName: string, manualName: string }, nTest: number = 1) {
  const { catalogName, offeringAutoName, offeringSemiName, offeringManualName, autoName, semiName, manualName} = params

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
  // Select the drawer that contains the auto offering name
  cy.contains('[data-cy="toCartDrawer"]', `Adding ${offeringAutoName} to cart`).within(() => {
    cy.contains(HAPPY_JOURNEY.pricePlan.name).click()
    cy.getBySel('acceptTermsCheckbox').click()
    cy.getBySel('addToCart').click()
  })
  cy.wait('@postOrder')
  cy.wait('@postCart')

  //SEMI
  openOfferingDrawer(offeringSemiName)
  // Select the drawer that contains the semi-proc offering name
  cy.contains('[data-cy="toCartDrawer"]', `Adding ${offeringSemiName} to cart`).within(() => {
    cy.contains(HAPPY_JOURNEY.pricePlan.name).click()
    cy.getBySel('acceptTermsCheckbox').click()
    cy.getBySel('addToCart').click()
  })
  cy.wait('@postOrder')
  cy.wait('@postCart')

  //MANUAL
  const cartReadyTracker = createRequestTracker([
    '**/shoppingCart/item/',
    '**/catalog/productOffering/**',
    '**/catalog/productSpecification/**',
  ], 500)
  openOfferingDrawer(offeringManualName)
  // Select the drawer that contains the manual offering name
  cartReadyTracker.waitForAction(() => {
    cy.contains('[data-cy="toCartDrawer"]', `Adding ${offeringManualName} to cart`).within(() => {
      cy.contains(HAPPY_JOURNEY.pricePlan.name).click()
      cy.getBySel('acceptTermsCheckbox').click()
      cy.getBySel('addToCart').click()
    })
  })
  cy.wait('@postOrder')
  cy.wait('@postCart')

  cy.getBySel('shoppingCart').click()
  cy.getBySel('cartPurchase').should('be.visible').should('not.be.disabled').click()

  cy.deferPaymentRedirect()

  cy.wait('@getBilling')
  cy.getBySel('checkout').should('be.visible').should('not.be.disabled').click()
  cy.wait('@createOrder')
  cy.waitForOrdersBeforePayment()

  cy.changeSessionTo('SELLER ORG')
  // Navigate to product orders as provider
  cy.visit('/product-orders')

  cy.wait('@getOrders')
  cy.getBySel('ordersTable').should('be.visible')
  cy.getBySel('asProviderTab').should('be.visible').click()
  cy.wait('@getProviderOrders')
  cy.wait(2000)
  cy.getBySel('ordersTable').should('be.visible')

  // Find the most recent order (first row) and acknowledge it
  cy.getBySel('ordersTable').find('tbody tr').first().within(() => {
    cy.contains(/inprogress/i)
    cy.getBySel('viewOrderDetails').click()
  })
  cy.getBySel('globalState').contains(/inprogress/i)
  cy.getBySel('orderItems').contains('tr', autoName).contains(/inprogress/i)
  cy.getBySel('orderItems').contains('tr', semiName).contains(/inprogress/i)
  switch (nTest){
    case 1:
    case 2:
    case 3:
    case 4:
    case 6:
      cy.getBySel('orderItems').contains('tr', manualName).contains( /unchecked/i)
      if (nTest === 1) break

      cy.getBySel('orderItems').contains('tr', manualName).within(() => {
        cy.getBySel('acknowledgeOrder').click()
      })
      confirmOrderAction()
      // Find the most recent order (first row) and acknowledge it
      cy.getBySel('ordersTable').find('tbody tr').first().within(() => {
        cy.contains(/inprogress/i)
        cy.getBySel('viewOrderDetails').click()
      })
      if (nTest === 6) break

      cy.getBySel('orderItems').contains('tr', manualName).within(() => {
        cy.getBySel('startOrderTreatment').click()
      })
      confirmOrderAction()
      cy.getBySel('ordersTable').find('tbody tr').first().within(() => {
        cy.contains(/inprogress/i)
        cy.getBySel('viewOrderDetails').click()
      })
      if (nTest === 2) break
      let orderAction = 'completeOrder'
      if (nTest === 3){
        orderAction = 'failOrder'
      }
      cy.getBySel('orderItems').contains('tr', manualName).within(() => {
        cy.getBySel(orderAction).click()
      })
      confirmOrderAction()
      cy.getBySel('ordersTable').find('tbody tr').first().within(() => {
        cy.contains(/inprogress/i)
        cy.getBySel('viewOrderDetails').click()
      })
      break
    case 5:
      cy.getBySel('orderItems').contains('tr', manualName).contains( /unchecked/i)
      cy.getBySel('orderItems').contains('tr', manualName).within(() => {
        cy.getBySel('rejectOrder').click()
      })
      confirmOrderAction()
      cy.getBySel('ordersTable').find('tbody tr').first().within(() => {
        cy.contains(/inprogress/i)
        cy.getBySel('viewOrderDetails').click()
      })
    default:
      break
  }
}
