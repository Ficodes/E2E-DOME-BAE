import { clickLoadMoreUntilFound, waitForInitialPaginatedList, waitForPaginatedTab } from './form-helpers'
import { openAccountPage } from './navigation'

type ProductStatus = 'created' | 'active' | 'suspended' | 'terminated'
type InventorySection = 'products' | 'services' | 'resources'

const sections = {
  products: { button: 'inventoryProducts', api: '**/inventory/product?*', statusParameter: 'status', defaultStatus: 'active' },
  services: { button: 'inventoryServices', api: '**/serviceInventory/service?*', statusParameter: 'state', defaultStatus: 'reserved' },
  resources: { button: 'inventoryResources', api: '**/resourceInventory/resource?*', statusParameter: 'resourceStatus', defaultStatus: 'reserved' },
} as const

/** Use the account menu, visible inventory navigation, and an explicit status tab. */
export function openInventory(section: InventorySection, requestedStatus?: string): void {
  const config = sections[section]
  const status = requestedStatus ?? config.defaultStatus
  openAccountPage('inventory')
  cy.getBySel(config.button).filter(':visible').should('have.length', 1).then($button => {
    if ($button.attr('aria-current') !== 'page') {
      waitForInitialPaginatedList(config.api, () => cy.wrap($button).click())
    }
  })
  cy.getBySel('inventoryStatusTab').filter(`[data-status="${status}"]`).then($tab => {
    if ($tab.attr('aria-pressed') !== 'true') {
      waitForPaginatedTab(`${config.api}${config.statusParameter}=${status}*`, () => {
        cy.wrap($tab).should('be.enabled').click()
      })
    }
  })
  cy.getBySel('inventoryStatusTab').filter(`[data-status="${status}"]`)
    .should('have.attr', 'aria-pressed', 'true')
}

export function openProductInventory(status: ProductStatus = 'active'): void {
  openInventory('products', status)
}

export function getInventoryProduct(name: string): Cypress.Chainable<JQuery<HTMLElement>> {
  clickLoadMoreUntilFound(name, '[data-cy="productInventory"]', 30)
  return cy.contains('[data-cy="productInventory"]', name)
}

export function assertInventoryProductStatus(name: string, status: ProductStatus): void {
  getInventoryProduct(name).contains('span', new RegExp(`^\\s*${status}\\s*$`, 'i')).should('be.visible')
}

/** Open the product's title button and read its ID independently of view query parameters. */
export function openInventoryProduct(name: string): Cypress.Chainable<string> {
  return getInventoryProduct(name).then($card => {
    const id = $card.attr('data-entity-id')
    expect(id, 'inventory product entity ID').to.be.a('string').and.not.be.empty
    cy.wrap($card).find('h3 button').should('have.length', 1).click()
    cy.getBySel('inventoryProductTitle').should('contain.text', name)
    return cy.location('pathname').should('match', /^\/product-inventory\/[^/]+$/)
      .then(pathname => {
        expect(decodeURIComponent(pathname.slice('/product-inventory/'.length))).to.eq(id)
        return id!
      })
  })
}
