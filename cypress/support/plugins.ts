import {
  addToCartAndWait, createCatalog, createOffering, createProductSpec,
  updateCatalogStatus, updateOffering, updateProductSpecStatus,
  updateResourceSpecStatus, updateServiceSpecStatus, waitForInitialPaginatedList, waitForPaginatedTab, clickLoadMoreUntilGone,
  clickLoadMoreUntilFound
} from './form-helpers'
import { confirmOrderAction, waitForOrderList } from './global-state-flows'
import { openAccountPage, openSearch } from './navigation'
import { openInventory, openProductInventory } from './inventory'
import { api } from './api'
export { api } from './api'

export type Domain = 'service' | 'resource'
export interface TestPlugin {
  id: string; name: string; type: Domain; version: string; requiresFile: boolean; path: string; categoryId: string
}
export interface HookEvent {
  pluginId: string; hook: string; version: string; rejected: boolean; time: number; args: any[]
}
export interface CatalogRecord { path: string; id: string }

export function trackCatalogRecords(records: CatalogRecord[]) {
  const paths = ['/catalog/productOffering', '/catalog/productSpecification',
    '/service/serviceSpecification', '/resource/resourceSpecification', '/catalog/catalog']
  cy.intercept({ method: 'POST', url: '**', middleware: true }, request => {
    const pathname = new URL(request.url).pathname.replace(/\/$/, '')
    const target = paths.find(path => pathname.endsWith('/' + path.split('/').pop()))
    if (target) request.on('after:response', response => {
      if (response.statusCode === 201 && response.body?.id) records.push({ path: target, id: response.body.id })
    })
  })
}

export function retireCatalogRecords(records: CatalogRecord[]) {
  if (!records.length) return
  cy.window({ log: false }).then(win => {
    const session = JSON.parse(win.localStorage.getItem('login_items') || '{}')
    const seller = session.organizations.find((org: any) => org.name === 'SELLER ORG')
    expect(seller?.id, 'seller organization for fixture cleanup').to.be.a('string').and.not.be.empty
    // Cleanup must also work when an expected failure leaves a blocking dialog
    // or checkout spinner. Retire only this case's records as their seller.
    for (const path of ['/catalog/productOffering', '/catalog/productSpecification',
      '/service/serviceSpecification', '/resource/resourceSpecification', '/catalog/catalog']) {
      for (const record of records.filter(record => record.path === path)) {
        api('PATCH', `${path}/${encodeURIComponent(record.id)}`, { lifecycleStatus: 'Retired' }, true, seller.id)
          .its('status').should('be.oneOf', [200, 204])
      }
    }
  })
}
export const assetTypes = '/charging/api/assetManagement/assetTypes'
export const specPath = (domain: Domain) => `/${domain}/${domain}Specification`
export const prefix = (domain: Domain) => domain === 'service' ? 'servSpec' : 'resSpec'
export const fileContent = 'DOME plugin E2E managed file\n'

export function usePersonalSession() {
  cy.window({ log: false }).then(win => {
    const session = JSON.parse(win.localStorage.getItem('login_items') || '{}')
    if (session.logged_as !== session.id) cy.changeSessionTo(session.user)
  })
}

export function buildPlugin(domain: Domain, requiresFile: boolean, purpose: string, version = '1.0') {
  return cy.task<TestPlugin>('plugins:build', { domain, requiresFile, purpose, version })
}

export function installFixture(domain: Domain, requiresFile: boolean, purpose: string): Cypress.Chainable<TestPlugin> {
  return buildPlugin(domain, requiresFile, purpose).then(plugin => {
    return cy.task('plugins:install', plugin.path, { timeout: 120000 }).then(() => {
      return api('GET', `${assetTypes}/${plugin.id}`).then(({ body }) => {
        expect(body.categoryId).to.be.a('string').and.not.be.empty
        expect(body.type).to.eq(domain)
        return { ...plugin, ...body }
      })
    })
  })
}

export function waitForHook(plugin: TestPlugin, hook: string, entityName: string): Cypress.Chainable<HookEvent[]> {
  const deadline = Date.now() + 30000
  function poll(): Cypress.Chainable<HookEvent[]> {
    return cy.task<HookEvent[]>('plugins:events', null, { log: false }).then(events => {
      const matching = events.filter(event => event.pluginId === plugin.id && event.hook === hook
        && event.args.some(arg => arg?.name === entityName))
      if (matching.length) return cy.wrap(matching, { log: false })
      if (Date.now() >= deadline) throw new Error(`Missing ${hook} for ${entityName} (${plugin.id})`)
      return cy.wait(250, { log: false }).then(poll)
    })
  }
  return poll()
}

export function assertNoHook(plugin: TestPlugin, hook: string, entityName: string) {
  cy.task<HookEvent[]>('plugins:events').then(events => {
    expect(events.filter(event => event.pluginId === plugin.id && event.hook === hook
      && event.args.some(arg => arg?.name === entityName)), `${hook}: ${entityName}`).to.have.length(0)
  })
}

export function characteristics(document: any, domain: Domain): Record<string, any> {
  const entries = document[domain === 'service' ? 'specCharacteristic' : 'resourceSpecCharacteristic']
  const values = domain === 'service' ? 'characteristicValueSpecification' : 'resourceSpecCharacteristicValue'
  const result: Record<string, any> = {}
  for (const entry of entries || []) {
    const name = entry.name.trim().toLowerCase()
    expect(result, `no duplicate ${entry.name}`).not.to.have.property(name)
    result[name] = entry[values]?.[0]?.value
  }
  return result
}

/** Tampered requests still traverse the proxy and charging backend. */
export function verifyBackendValidation(plugin: TestPlugin, saved: any) {
  const field = plugin.type === 'service' ? 'specCharacteristic' : 'resourceSpecCharacteristic'
  const values = plugin.type === 'service' ? 'characteristicValueSpecification' : 'resourceSpecCharacteristicValue'
  const typeName = `${plugin.type} type`
  const cases: [string, (entries: any[]) => any[]][] = [
    ['missing-field', entries => entries.filter(c => c.name !== 'display_name')],
    ['boolean-string', entries => entries.map(c => c.name === 'enabled' ? { ...c, [values]: [{ value: 'false' }] } : c)],
    ['invalid-option', entries => entries.map(c => c.name === 'region' ? { ...c, [values]: [{ value: 'invalid' }] } : c)],
    ['object-type', entries => entries.map(c => c.name.toLowerCase() === typeName ? { ...c, [values]: [{ value: { id: plugin.categoryId } }] } : c)],
    ['duplicate-type', entries => [...entries, entries.find(c => c.name.toLowerCase() === typeName)]]
  ]
  if (plugin.requiresFile) cases.push(
    ['missing-file', entries => entries.filter(c => c.name !== 'File')],
    ['unknown-file', entries => entries.map(c => c.name === 'File' ? { ...c, [values]: [{ value: '000000000000000000000000' }] } : c)]
  )
  for (const [label, mutate] of cases) {
    const name = `${saved.name} ${label}`
    api('POST', specPath(plugin.type), { name, description: saved.description,
      lifecycleStatus: 'Active', relatedParty: saved.relatedParty,
      [field]: mutate(JSON.parse(JSON.stringify(saved[field]))) }, false).its('status').should('eq', 400)
    api('GET', `${specPath(plugin.type)}?name=${encodeURIComponent(name)}`).its('body').should('have.length', 0)
    assertNoHook(plugin, `on_post_${plugin.type}_spec_creation`, name)
  }
  api('PATCH', `${specPath(plugin.type)}/${encodeURIComponent(saved.id)}`, { version: '9.0' }, false)
    .its('status').should('eq', 400)
  api('GET', `${specPath(plugin.type)}/${encodeURIComponent(saved.id)}`).then(({ body }) => {
    expect(body.version).to.eq(saved.version)
  })
}

export function createPluginSpec(plugin: TestPlugin, name: string, failure?: 'pre' | 'post'): Cypress.Chainable<any> {
  const p = prefix(plugin.type)
  cy.intercept('POST', `**${specPath(plugin.type)}`).as('savePluginSpec')
  openAccountPage('offerings')
  cy.getBySel(`${p}Section`).click()
  cy.getBySel(plugin.type === 'service' ? 'createServSpec' : 'createResSpec').click()
  cy.getBySel(`${p}Name`).type(name)
  cy.getBySel(`${p}Description`).type('Plugin E2E specification')
  cy.getBySel(`${p}Type`).select(plugin.id)
  cy.getBySel(`${p}Next`).click()
  cy.getBySel(`${p}Field-region`).should('have.value', 'eu')
  cy.getBySel(`${p}Field-enabled`).should('not.be.checked')
  cy.getBySel(`${p}Field-notes`).should('have.value', 'Fixture notes')
  cy.getBySel(`${p}Next`).should('be.disabled')
  cy.getBySel(`${p}Field-display_name`).type(name)
  if (plugin.requiresFile) {
    cy.getBySel(`${p}Next`).should('be.disabled')
    cy.getBySel(`${p}File`).selectFile({ contents: Cypress.Buffer.from(fileContent),
      fileName: `${name}.txt`, mimeType: 'text/plain' })
  } else {
    cy.getBySel(`${p}File`).should('not.exist')
  }
  cy.getBySel(`${p}Next`).should('be.enabled').click()
  if (failure) cy.task('plugins:fail', { pluginId: plugin.id,
    hook: `on_${failure}_${plugin.type}_spec_creation`, entityName: name })
  cy.getBySel(`${p}Finish`).click()
  if (failure === 'pre') {
    cy.wait('@savePluginSpec').its('response.statusCode').should('eq', 422)
    api('GET', `${specPath(plugin.type)}?name=${encodeURIComponent(name)}`).then(({ body }) => {
      expect(body).to.have.length(0)
    })
    assertNoHook(plugin, `on_post_${plugin.type}_spec_creation`, name)
    cy.task('plugins:fail', null)
    cy.getBySel(`${p}Finish`).should('be.enabled').click()
  }
  cy.getBySel(`${p}SaveDraft`).should('be.visible').click()
  cy.closeFeedbackModalIfVisible()
  return cy.wait('@savePluginSpec').then(({ response }) => {
    expect(response?.statusCode).to.eq(201)
    const saved = response!.body
    const values = characteristics(saved, plugin.type)
    expect(values[`${plugin.type} type`]).to.eq(plugin.categoryId)
    expect(values.enabled).to.eq(false)
    expect(values.region).to.eq('eu')
    expect(values).not.to.have.property('reference')
    if (plugin.requiresFile) expect(values.file).to.match(/^[a-f0-9]{24}$/)
    else expect(values).not.to.have.property('file')
    if (plugin.requiresFile) {
      // Check the upload before verifying buyer downloads after purchase.
      api('GET', `/charging/api/assetManagement/assets/${values.file}`).then(({ body }) => {
        const download = new URL(body.location)
        expect(download.pathname).to.match(/^\/charging\/media\/assets\//)
        api('GET', download.pathname).then(({ body: content }) => expect(content).to.eq(fileContent))
      })
    }
    waitForHook(plugin, `on_post_${plugin.type}_spec_creation`, name).then(events => {
      expect(events).to.have.length(1)
      expect(events[0].args[1].id).to.eq(saved.id)
      expect(events[0].rejected).to.eq(failure === 'post')
      waitForHook(plugin, `on_pre_${plugin.type}_spec_creation`, name).then(pre => {
        expect(pre).to.have.length(failure === 'pre' ? 2 : 1)
        expect(pre[pre.length - 1].time).to.be.at.most(events[0].time)
      })
    })
    if (failure === 'post') cy.task('plugins:fail', null)
    return cy.wrap(saved)
  })
}

export function editPluginSpec(plugin: TestPlugin, name: string): void {
  const p = prefix(plugin.type)
  waitForInitialPaginatedList(`**${specPath(plugin.type)}?*`, () => {
    openAccountPage('offerings')
    cy.getBySel(`${p}Section`).click()
  })
  clickLoadMoreUntilGone(30, `[data-cy="${p}Row"]`)
  cy.contains(`[data-cy="${p}Row"]`, name).within(() => {
    cy.getBySel(`${p}Actions`).click()
    cy.getBySel(plugin.type === 'service' ? 'serviceSpecEdit' : 'resourceSpecEdit').click()
  })
  cy.getBySel(`${p}Type`).should('have.value', plugin.id)
  cy.getBySel(`${p}Next`).click()
  cy.getBySel(`${p}Field-display_name`).should('have.value', name)
  cy.getBySel(`${p}Field-enabled`).should('not.be.checked')
  cy.getBySel(`${p}Field-region`).select('us')
  cy.getBySel(`${p}Field-notes`).clear().type('Updated before purchase')
  if (plugin.requiresFile) cy.getBySel('managedFileName').should('contain.text', `${name}.txt`)
  cy.getBySel(`${p}Next`).click()
  cy.intercept('PATCH', `**${specPath(plugin.type)}/*`).as('editPluginSpec')
  cy.getBySel(`${p}Finish`).click()
  cy.getBySel(`${p}SaveDraft`).click()
  cy.wait('@editPluginSpec').then(({ response }) => {
    expect(response?.statusCode).to.be.oneOf([200, 204])
  })
  cy.closeFeedbackModalIfVisible()
  waitForHook(plugin, `on_post_${plugin.type}_spec_update`, name)
}

export function launchSpec(plugin: TestPlugin, name: string) {
  waitForInitialPaginatedList(`**${specPath(plugin.type)}?*`, () => {
    openAccountPage('offerings')
    cy.getBySel(`${prefix(plugin.type)}Section`).click()
  })
  if (plugin.type === 'service') updateServiceSpecStatus({ name, status: 'launched' })
  else updateResourceSpecStatus({ name, status: 'launched' })
}

export function publishProduct(name: string, service: string, resource: string, procurement = 'automatic', subscription = false) {
  createCatalog({ name: `${name} catalog`, description: 'Plugin journey catalog' })
  updateCatalogStatus({ name: `${name} catalog`, status: 'launched' })
  createProductSpec({ name: `${name} product`, description: 'Plugin journey product',
    brand: 'DOME E2E', productNumber: name, serviceSpecName: service, resourceSpecName: resource })
  updateProductSpecStatus({ name: `${name} product`, status: 'launched' })
  createOffering({ name: `${name} offering`, description: 'Plugin journey offering',
    detailedDescription: 'Plugin lifecycle E2E', productSpecName: `${name} product`,
    catalogName: `${name} catalog`, mode: 'paid', procurement,
    pricePlan: { name: 'Plugin plan' },
    priceComponent: subscription
      ? { name: 'Plugin subscription', description: 'Monthly prepaid subscription', price: 5.2, type: 'recurring-prepaid', recurringPeriod: 'month' }
      : { name: 'Plugin one time', description: 'Plugin purchase', price: 5.2, type: 'one time' } })
  updateOffering({ name: `${name} offering`, status: 'launched' })
}

export function checkout(name: string, procurement = 'automatic', subscription = false, activationFailure = false) {
  openAccountPage('profile')
  cy.getBySel('orgCountry').select('ES')
  cy.getBySel('orgUpdate').click()
  cy.changeSessionTo('BUYER ORG')
  openAccountPage('profile')
  cy.getBySel('orgCountry').select('ES')
  cy.getBySel('orgUpdate').click()
  api('POST', '/shoppingCart/empty/', {})
  // Billing-address editing is covered by core tests. Ensure a real prerequisite
  // without depending on another spec or accumulating addresses across retries.
  cy.window({ log: false }).then(win => {
    const session = JSON.parse(win.localStorage.getItem('login_items') || '{}')
    const org = session.organizations.find((item: any) => item.id === session.logged_as)
    return api('GET', '/account/billingAccount').then(({ body: existing }) => {
      if (existing.length) return cy.wrap(existing[0].name).as('pluginBillingName')
      return api('POST', '/account/billingAccount', {
      name: 'E2E Plugin Billing', state: 'Defined', relatedParty: [{ id: org.partyId, href: org.partyId, name: org.name, role: 'Seller' }],
      contact: [{ contactMedium: [
        { mediumType: 'Email', preferred: true, characteristic: { contactType: 'Email', emailAddress: 'buyer@test.com' } },
        { mediumType: 'PostalAddress', preferred: true, characteristic: { contactType: 'PostalAddress',
          city: 'Madrid', country: 'ES', postCode: '28000', stateOrProvince: 'Madrid', street1: 'Gran Via 10' } },
        { mediumType: 'TelephoneNumber', preferred: true, characteristic: { contactType: 'Mobile', phoneNumber: '+34600123456' } }
      ] }]
      }).then(({ status, body }) => {
        expect(status).to.eq(201)
        return cy.wrap(body.name).as('pluginBillingName')
      })
    })
  })
  cy.intercept('GET', '**/shoppingCart/item/').as('pluginCart')
  cy.intercept('GET', '**/ordering/productOrder*').as('getOrders')
  openSearch()
  cy.wait('@pluginCart')
  clickLoadMoreUntilFound(`${name} offering`, '[data-cy="baeCard"]', 30)
  cy.openAddToCartDrawerFromSearch(`${name} offering`)
  cy.getBySel('toCartDrawer').filter(':visible').within(() => {
    cy.contains('Plugin plan').click()
    cy.getBySel('acceptTermsCheckbox').check()
    addToCartAndWait()
  })
  cy.getBySel('shoppingCart').click()
  cy.intercept('GET', '**/account/billingAccount*').as('pluginBilling')
  cy.getBySel('cartPurchase').click()
  cy.wait('@pluginBilling')
  cy.get<string>('@pluginBillingName').then(billingName => cy.contains('app-billing-address', billingName).click())
  cy.intercept('POST', '**/ordering/productOrder').as('createOrder')
  if (procurement !== 'manual') {
    cy.intercept('**/charging/api/orderManagement/orders/confirm/').as('pluginConfirmation')
  }
  cy.getBySel('checkout').should('be.enabled').click()
  cy.wait('@createOrder').then(({ response }) => {
    expect(response?.statusCode).to.eq(201)
    cy.wrap(response!.body.id).as('pluginOrderId')
  })
  if (procurement === 'manual') {
    cy.wait('@getOrders')
    cy.getBySel('ordersTable').should('be.visible')
    return
  }
  cy.completePayment({ recurring: subscription, followRedirect: true })
  cy.wait('@pluginConfirmation').then(({ response }) => {
    expect(response?.statusCode, JSON.stringify(response?.body)).to.eq(activationFailure ? 403 : 200)
  })
  if (!activationFailure) {
    cy.wait('@getOrders')
    cy.location('pathname').should('eq', '/product-orders')
    cy.getBySel('ordersTable').should('be.visible')
  }
}

export function completeManualOrder(procurement: string) {
  waitForOrderList(() => cy.changeSessionTo('SELLER ORG'))
  openAccountPage('orders')
  // Rows are rendered after their billing and offering details finish loading.
  cy.getBySel('ordersTable').should('be.visible')
  waitForOrderList(() => cy.getBySel('asProviderTab').click())
  cy.intercept('PATCH', '**/ordering/productOrder/*').as('patchOrder')
  cy.get<string>('@pluginOrderId').then(id => {
    const actions = procurement === 'manual'
      ? ['acknowledgeOrder', 'startOrderTreatment', 'completeOrder'] : ['completeOrder']
    for (const action of actions) {
      cy.getBySel('ordersTable').find(`span[title="${id}"]`).closest('tr').within(() => {
        cy.getBySel('viewOrderDetails').click()
      })
      cy.getBySel(action).click()
      confirmOrderAction()
      cy.getBySel('confirmActionBtn').should('not.be.visible')
    }
  })
  cy.changeSessionTo('BUYER ORG')
}

export function terminatePurchase(name: string, expectCleanupFailure = false) {
  openActiveProducts()
  cy.contains('[data-cy="productInventory"]', `${name} offering`).within(() => {
    cy.getBySel('terminateInvProduct').click()
  })
  cy.getBySel('terminateProductModal').find('[data-cy="confirmTerminateProduct"]').click()
  cy.get<string>('@pluginBillingName').then(name => {
    cy.getBySel('inventoryBillingModal').contains('app-billing-address', name).click()
  })
  cy.intercept('POST', '**/ordering/productOrder').as('terminateOrder')
  cy.getBySel('inventoryBillingModal').find('[data-cy="confirmInventoryBilling"]').should('be.enabled').click()
  cy.wait('@terminateOrder').then(({ request, response }) => {
    expect(request.body.productOrderItem[0].action).to.eq('delete')
    if (expectCleanupFailure) expect(response?.statusCode).to.be.within(400, 599)
    else expect(response?.statusCode, 'successful cancellation').to.eq(201)
  })
}

export function openActiveProducts() {
  openProductInventory('active')
  clickLoadMoreUntilGone(30, '[data-cy="productInventory"]')
}

export function assertInventory(plugin: TestPlugin, name: string, region: string) {
  const domain = plugin.type
  waitForHook(plugin, `on_${domain}_activation`, name).then(events => {
    const [provider, buyer, instance, product, order] = events[0].args
    expect(provider.actor_id).not.to.eq(buyer.actor_id)
    expect(instance.id).to.be.a('string')
    expect(product.id).to.be.a('string')
    expect(order.id).to.be.a('string')
    const values = Object.fromEntries(instance[`${domain}Characteristic`].map((c: any) => [c.name.trim().toLowerCase(), c.value]))
    expect(values[`${domain} type`]).to.eq(plugin.categoryId)
    expect(String(values.enabled).toLowerCase()).to.eq('false')
    expect(values.region).to.eq(region)
    const status = domain === 'service' ? instance.state : instance.resourceStatus
    openInventory(domain === 'service' ? 'services' : 'resources', status)
    clickLoadMoreUntilFound(name, '[data-cy="inventoryRow"]', 30)
    cy.getBySel('inventoryRow').filter(`[data-entity-id="${instance.id}"]`).within(() => {
      cy.getBySel('inventoryEntityOpen').should('have.attr', 'data-entity-id', instance.id).click()
    })
    cy.getBySel('inventoryEntityTitle').should('contain.text', name)
    cy.getBySel('inventoryEntityTab-plugin').click()
    cy.contains(plugin.name).should('be.visible')
    if (plugin.requiresFile) {
      cy.getBySel('inventoryEntityFile').find('[data-cy="managedFileName"]').should('contain.text', `${name}.txt`)
      cy.intercept('GET', '**/charging/media/assets/**').as('inventoryFileDownload')
      cy.getBySel('inventoryEntityFile').find('[data-cy="managedFileDownload"]')
        .should('have.length', 1).and('be.enabled').click()
      cy.wait('@inventoryFileDownload').then(({ response }) => {
        expect(response?.statusCode, `purchaser ${domain} download: ${JSON.stringify(response?.body)}`).to.eq(200)
      })
      cy.getBySel('inventoryEntityFile').find('[role="alert"]').should('not.exist')
      cy.readFile(`${Cypress.config('downloadsFolder')}/${name}.txt`, 'utf8')
        .should('eq', fileContent)
    } else {
      cy.getBySel('inventoryEntityFile').should('not.exist')
    }
  })
}
