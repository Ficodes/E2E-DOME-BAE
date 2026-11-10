import {
  api, assetTypes, assertInventory, assertNoHook, CatalogRecord, checkout, createPluginSpec, editPluginSpec,
  completeManualOrder, installFixture, launchSpec, publishProduct, retireCatalogRecords, terminatePurchase, TestPlugin, trackCatalogRecords, usePersonalSession, verifyBackendValidation, openActiveProducts, waitForHook
} from '../../support/plugins'

// Each case owns its specs, product, offering and purchase. No core-test seed
// data, administration-test state, or cross-spec execution order is required.
describe('Plugin specification to purchase E2E', () => {
  let records: CatalogRecord[]
  beforeEach(() => {
    records = []
    trackCatalogRecords(records)
  })
  afterEach(() => {
    cy.task('plugins:fail', null)
    retireCatalogRecords(records)
  })

  const scenarios: { key: string; serviceFile: boolean; resourceFile: boolean; edit: boolean;
    failure?: 'pre' | 'post'; activationFailure?: boolean; procurement?: string; termination?: 'success' | 'retry' }[] = [
    { key: 'files', serviceFile: true, resourceFile: true, edit: false },
    { key: 'forms-edited', serviceFile: false, resourceFile: false, edit: true },
    { key: 'files-edited', serviceFile: true, resourceFile: true, edit: true },
    { key: 'pre-rejected', serviceFile: false, resourceFile: true, edit: false, failure: 'pre' as const },
    { key: 'post-rejected', serviceFile: true, resourceFile: false, edit: false, failure: 'post' as const },
    { key: 'activation-rejected', serviceFile: false, resourceFile: false, edit: false, activationFailure: true },
    { key: 'manual', serviceFile: false, resourceFile: false, edit: false, procurement: 'manual' },
    { key: 'payment-automatic', serviceFile: false, resourceFile: false, edit: false, procurement: 'payment-automatic' },
    { key: 'termination', serviceFile: false, resourceFile: true, edit: false, termination: 'success' },
    { key: 'termination-retry', serviceFile: true, resourceFile: false, edit: false, termination: 'retry' }
  ]

  const selectedScenarios = String(Cypress.env('PLUGIN_SCENARIO') || '').split(',').map(key => key.trim()).filter(Boolean)
  for (const selected of selectedScenarios) {
    if (!scenarios.some(scenario => scenario.key === selected)) throw new Error(`Unknown PLUGIN_SCENARIO: ${selected}`)
  }
  for (const scenario of scenarios.filter(scenario => !selectedScenarios.length || selectedScenarios.includes(scenario.key))) {
    it(`${scenario.key}: creates specs, publishes a product and offering, then purchases`, () => {
      let service: TestPlugin
      let resource: TestPlugin
      let name: string
      cy.clearBilling()
      cy.loginAsAdmin()
      usePersonalSession()
      // Establish the administrator's own backend identity before acting for an
      // organization. Charging initializes staff status in the personal context.
      api('GET', assetTypes).its('status').should('eq', 200)
      cy.changeSessionTo('SELLER ORG')
      installFixture('service', scenario.serviceFile, scenario.key).then(plugin => { service = plugin })
      installFixture('resource', scenario.resourceFile, scenario.key).then(plugin => { resource = plugin })
      cy.then(() => {
        name = `${scenario.key} ${service.id.split('-').slice(-2).join('-')}`
        createPluginSpec(service, `${name} service`, scenario.failure).then(saved => {
          if (scenario.key === 'files') verifyBackendValidation(service, saved)
        })
        createPluginSpec(resource, `${name} resource`).then(saved => {
          if (scenario.key === 'files') verifyBackendValidation(resource, saved)
        })
        if (scenario.edit) {
          editPluginSpec(service, `${name} service`)
          editPluginSpec(resource, `${name} resource`)
        }
        launchSpec(service, `${name} service`)
        launchSpec(resource, `${name} resource`)
        // Referenced packages must survive a refused uninstall.
        api('DELETE', `${assetTypes}/${service.id}`, undefined, false).its('status').should('eq', 409)
        api('GET', `${assetTypes}/${service.id}`).its('body.categoryId').should('eq', service.categoryId)
        publishProduct(name, `${name} service`, `${name} resource`, scenario.procurement, !!scenario.termination)
        for (const plugin of [service, resource]) {
          for (const entity of ['product_spec', 'product_offering']) {
            const entityName = `${name} ${entity === 'product_spec' ? 'product' : 'offering'}`
            for (const operation of ['creation', 'update']) {
              waitForHook(plugin, `on_pre_${entity}_${operation}`, entityName)
              waitForHook(plugin, `on_post_${entity}_${operation}`, entityName).then(events => {
                const [, specification, product, offering] = events[0].args
                expect(specification.name).to.eq(`${name} ${plugin.type}`)
                expect(product.name).to.eq(`${name} product`)
                expect(product.id).to.be.a('string')
                if (offering) expect(offering.id).to.be.a('string')
              })
            }
          }
        }
        if (scenario.activationFailure) {
          cy.task('plugins:fail', { pluginId: service.id, hook: 'on_service_activation', entityName: `${name} service` })
        }
        checkout(name, scenario.procurement, !!scenario.termination, !!scenario.activationFailure)
        if (scenario.procurement) completeManualOrder(scenario.procurement)
        if (scenario.activationFailure) {
          waitForHook(service, 'on_service_activation', `${name} service`).then(events => {
            expect(events[0].rejected).to.eq(true)
            const product = events[0].args[3]
            api('GET', `/inventory/product/${encodeURIComponent(product.id)}`).its('body.status').should('not.eq', 'active')
          })
          assertNoHook(resource, 'on_resource_activation', `${name} resource`)
          cy.get<string>('@pluginOrderId').then(id => {
            api('GET', `/ordering/productOrder/${encodeURIComponent(id)}`).then(({ body }) => {
              expect(body.state).not.to.eq('completed')
              expect(body.productOrderItem.every((item: any) => item.state === 'completed')).to.eq(false)
            })
          })
        } else {
          cy.get<string>('@pluginOrderId').then(id => {
            api('GET', `/ordering/productOrder/${encodeURIComponent(id)}`).its('body.state').should('eq', 'completed')
          })
          openActiveProducts()
          cy.contains('[data-cy="productInventory"]', `${name} offering`).contains('span', /^active$/i).should('be.visible')
          if (scenario.procurement) {
            assertNoHook(service, 'on_service_activation', `${name} service`)
            assertNoHook(resource, 'on_resource_activation', `${name} resource`)
          } else {
            assertInventory(service, `${name} service`, scenario.edit ? 'us' : 'eu')
            assertInventory(resource, `${name} resource`, scenario.edit ? 'us' : 'eu')
          }
          if (scenario.termination) {
            waitForHook(service, 'on_service_activation', `${name} service`).then(events => {
              const productId = events[0].args[3].id
              if (scenario.termination === 'retry') cy.task('plugins:fail', {
                pluginId: service.id, hook: 'on_service_termination', entityName: `${name} service`
              })
              terminatePurchase(name, scenario.termination === 'retry')
              waitForHook(service, 'on_service_termination', `${name} service`).then(cleanups => {
                expect(cleanups[0].rejected).to.eq(scenario.termination === 'retry')
              })
              if (scenario.termination === 'retry') {
                cy.task('plugins:pending', productId).should('eq', 1)
                api('GET', `/inventory/product/${encodeURIComponent(productId)}`).its('body.status').should('eq', 'active')
                assertNoHook(resource, 'on_resource_termination', `${name} resource`)
                cy.task('plugins:fail', null)
                cy.task('plugins:recover', null, { timeout: 120000 })
                waitForHook(service, 'on_service_termination', `${name} service`).then(cleanups => {
                  expect(cleanups).to.have.length(2)
                  expect(cleanups.map(event => event.rejected)).to.deep.eq([true, false])
                })
              }
              cy.task('plugins:pending', productId).should('eq', 0)
              api('GET', `/inventory/product/${encodeURIComponent(productId)}`).its('body.status').should('eq', 'terminated')
              waitForHook(resource, 'on_resource_termination', `${name} resource`).then(cleanups => {
                const resourceId = cleanups[0].args[2].id
                api('GET', `/resourceInventory/resource/${encodeURIComponent(resourceId)}`)
                  .its('body.resourceStatus').should('eq', 'suspended')
              })
              const serviceId = events[0].args[2].id
              api('GET', `/serviceInventory/service/${encodeURIComponent(serviceId)}`).its('body.state').should('eq', 'terminated')
            })
          }
        }
      })
    })
  }
})
