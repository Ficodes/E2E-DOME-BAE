import { HAPPY_JOURNEY } from './happy-journey-constants'
import {
  createOffering,
  updateOffering,
  clickLoadMoreUntilGone,
} from './form-helpers'

export const unchecked= 'unchecked'
export const ack = 'acknowledged'
export const inProgress = 'inProgress'
export const completed = 'completed'
export const cancelled = 'cancelled'
export const failed = 'failed'

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

  cy.request({url: 'http://localhost:4201/clear', method: 'POST'}).then(
    (response) => {
      expect(response.status).to.eq(200)
    }
  )
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
  cy.getBySel('catalogSection').click()
  cy.getBySel('catalogTable').should('be.visible')
  cy.getBySel('catalogTable').contains(catalogName).should('be.visible')

  cy.getBySel('prdSpecSection').click()
  cy.getBySel('prodSpecTable').should('be.visible')
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
  cy.clearAllCookies()
  cy.clearLocalStorage()
  cy.clearAllSessionStorage()
}

/**
 * Setup function for the 'beforeEach' hook in global states tests
 * Prepares the order with all three offerings in the expected initial state
 */
export function setupGlobalStateBeforeEach(params: GlobalStateSetupParams & { autoName: string, semiName: string, manualName: string }, nTest: number = 1) {
  const { catalogName, offeringAutoName, offeringSemiName, offeringManualName, autoName, semiName, manualName} = params

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
  cy.getBySel('offFeatured').contains(catalogName).parent().find('[data-cy="viewService"]').should('be.visible').click()
  cy.wait('@cartItem', {timeout: 60000})
  clickLoadMoreUntilGone(10, true)
  // AUTO
  cy.contains('[data-cy="baeCard"]', offeringAutoName).within(() => {
    cy.getBySel('addToCart').first().click()
  })
  // Select the drawer that contains the auto offering name
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
  // Select the drawer that contains the semi-proc offering name
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
  // Select the drawer that contains the manual offering name
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
  cy.wait('@createOrder', { timeout: 60000 })
  cy.wait('@getOrders')

  cy.changeSessionTo('SELLER ORG')
  // Navigate to product orders as provider
  cy.visit('/product-orders')
  cy.getBySel('asProviderTab').click()
  cy.wait(2000)
  cy.getBySel('ordersTable', { timeout: 60000 }).should('be.visible')

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
      cy.getBySel('confirmActionBtn').click()
      cy.wait(2000)
      // Find the most recent order (first row) and acknowledge it
      cy.getBySel('ordersTable').find('tbody tr').first().within(() => {
        cy.contains(/inprogress/i)
        cy.getBySel('viewOrderDetails').click()
      })
      if (nTest === 6) break

      cy.getBySel('orderItems').contains('tr', manualName).within(() => {
        cy.getBySel('startOrderTreatment').click()
      })
      cy.getBySel('confirmActionBtn').click()
      cy.wait(2000)
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
      cy.getBySel('confirmActionBtn').click()
      cy.wait(2000)
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
      cy.getBySel('confirmActionBtn').click()
      cy.wait(2000)
      cy.getBySel('ordersTable').find('tbody tr').first().within(() => {
        cy.contains(/inprogress/i)
        cy.getBySel('viewOrderDetails').click()
      })
    default:
      break
  }
}