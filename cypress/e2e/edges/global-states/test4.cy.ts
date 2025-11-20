
import { HAPPY_JOURNEY } from '../../../support/happy-journey-constants'
import {
  setupGlobalStateBefore,
  setupGlobalStateBeforeEach,
} from '../../../support/global-state-flows'
describe('Check order global states',  {
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

    beforeEach(() => {
      setupGlobalStateBeforeEach({
        catalogName,
        productSpecName,
        offeringAutoName,
        offeringSemiName,
        offeringManualName,
        autoName,
        semiName,
        manualName
      }, 4)
    })
    
    // At the moment I have done this test, orders are ordered by the most recent first.
    it('should give the correct global state: test 4 - Google Sheet', () => {
      cy.visit('/')
      cy.changeSessionTo('BUYER ORG')
      // complete auto offering
      cy.visit('http://localhost:4201/checkin')

      cy.intercept('**/charging/api/orderManagement/orders/confirm/').as('checkin')
      cy.wait('@checkin', { timeout: 60000 })

      cy.changeSessionTo('SELLER ORG')
      cy.visit('/product-orders')
      cy.getBySel('asProviderTab').click()
      cy.getBySel('ordersTable', { timeout: 60000 }).should('be.visible')
      // check global state
      cy.getBySel('ordersTable').find('tbody tr').first().within(() => {
        cy.contains(/inprogress/i)
        cy.getBySel('viewOrderDetails').click()
      })
      cy.getBySel('globalState').contains(/inprogress/i)
      cy.getBySel('orderItems').contains('tr', autoName).contains(/completed/i)
      cy.getBySel('orderItems').contains('tr', semiName).contains(/inprogress/i)
      cy.getBySel('orderItems').contains('tr', manualName).contains( /completed/i)

      // complete semi auto offering
      cy.getBySel('orderItems').contains('tr', semiName).within(() =>{
        cy.getBySel('completeOrder').click()
      })
      cy.getBySel('confirmActionBtn').click()
      cy.wait(2000)

      cy.getBySel('ordersTable').find('tbody tr').first().within(() => {
        cy.contains(/completed/i)
        cy.getBySel('viewOrderDetails').click()
      })
      // check global state
      cy.getBySel('globalState').contains(/completed/i)
      cy.getBySel('orderItems').contains('tr', autoName).contains(/completed/i)
      cy.getBySel('orderItems').contains('tr', semiName).contains(/completed/i)
      cy.getBySel('orderItems').contains('tr', manualName).contains( /completed/i)

    })

    // orders are ordered by the most recent first.
    it('should give the correct global state: test 4 - Google Sheet', () => {
      cy.getBySel('orderItems').contains('tr', semiName).within(() =>{
        cy.getBySel('completeOrder').click()
      })
      cy.getBySel('confirmActionBtn').click()
      cy.wait(2000)

      cy.getBySel('ordersTable').find('tbody tr').first().within(() => {
        cy.contains(/inprogress/i)
        cy.getBySel('viewOrderDetails').click()
      })
      // check global state
      cy.getBySel('globalState').contains(/inprogress/i)
      cy.getBySel('orderItems').contains('tr', autoName).contains(/inProgress/i)
      cy.getBySel('orderItems').contains('tr', semiName).contains(/completed/i)
      cy.getBySel('orderItems').contains('tr', manualName).contains( /completed/i)

      // complete auto offering
      cy.visit('/')
      cy.changeSessionTo('BUYER ORG')
      cy.visit('http://localhost:4201/checkin')

      cy.intercept('**/charging/api/orderManagement/orders/confirm/').as('checkin')
      cy.wait('@checkin', { timeout: 60000 })

      cy.changeSessionTo('SELLER ORG')
      cy.visit('/product-orders')
      cy.getBySel('asProviderTab').click()
      cy.getBySel('ordersTable', { timeout: 60000 }).should('be.visible')
      // check global state
      cy.getBySel('ordersTable').find('tbody tr').first().within(() => {
        cy.contains(/completed/i)
        cy.getBySel('viewOrderDetails').click()
      })
      cy.getBySel('globalState').contains(/completed/i)
      cy.getBySel('orderItems').contains('tr', autoName).contains(/completed/i)
      cy.getBySel('orderItems').contains('tr', semiName).contains(/completed/i)
      cy.getBySel('orderItems').contains('tr', manualName).contains( /completed/i)

    })
})
