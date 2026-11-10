const accountPages = {
  administration: { button: 'administration', path: '/admin' },
  offerings: { button: 'myOfferings', path: '/my-offerings' },
  profile: { button: 'userProfile', path: '/profile' },
  orders: { button: 'productOrders', path: '/product-orders' },
  inventory: { button: 'myInventory', path: '/product-inventory' },
} as const

/** Navigate through the account menu, including when it is already open. */
export function openAccountPage(page: keyof typeof accountPages): void {
  // Close read-only detail dialogs before interacting with the menu behind them.
  cy.get('body').then($body => {
    const invoiceClose = $body.find('[data-cy="invoiceDetail"] button[data-modal-hide="delete-bill-modal"]')
    if (invoiceClose.length) cy.wrap(invoiceClose).click()
    if ($body.find('[data-cy="closeOrderDetails"]').length) cy.getBySel('closeOrderDetails').click()
  })
  cy.getBySel('userDropdown').then($menu => {
    if (!$menu.is(':visible')) cy.getBySel('loggedAcc').filter(':visible').click()
  })
  cy.getBySel('userDropdown').find(`[data-cy="${accountPages[page].button}"]`).should('be.visible').click()
  cy.location('pathname').should('eq', accountPages[page].path)
}

function returnToMarketplace(remaining = 4): void {
  cy.get('body').then($body => {
    const back = $body.find('[data-cy="workspaceBack"]:visible')
    if (!back.length) return
    expect(remaining, 'Back buttons remaining before the marketplace').to.be.greaterThan(0)
    cy.wrap(back).click()
    returnToMarketplace(remaining - 1)
  })
}

/** Leave the workspace using Back, then use Browse > Services. */
export function openMarketplace(): void {
  returnToMarketplace()
  cy.getBySel('browse').filter(':visible').should('be.visible')
}

export function openSearch(): void {
  openMarketplace()
  cy.getBySel('browse').filter(':visible').click()
  cy.getBySel('browseServices').should('be.visible').click()
  cy.location('pathname').should('eq', '/search')
}
