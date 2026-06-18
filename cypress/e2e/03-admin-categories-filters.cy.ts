import { ORGS } from '../support/constants'

type CategorySeed = {
  defaultCatalogName: string
  primaryRootName: string
  primaryChildName: string
  filterRootName: string
  filterChildName: string
  toolbarFilterLabel: string
}

const openAdministrationFromMenu = (): void => {
  cy.getBySel('loggedAcc').should('be.visible').click()
  cy.getBySel('administration').should('be.visible').click()

  cy.url().should('include', '/admin')
  cy.contains('h1', 'Administration').should('be.visible')
  cy.getBySel('adminCategoriesSection').should('be.visible')
}

const ensurePersonalAdminSession = (): void => {
  cy.window().then((win) => {
    const loginInfo = JSON.parse(win.localStorage.getItem('login_items') || '{}')
    const roles = Array.isArray(loginInfo.roles)
      ? loginInfo.roles.map((role: { name?: string }) => role.name)
      : []

    expect(roles, 'logged user roles').to.include('admin')

    if (!loginInfo.id || loginInfo.logged_as === loginInfo.id) {
      return
    }

    cy.getBySel('loggedAcc').should('be.visible').click()
    cy.getBySel('changeSession').should('be.visible').click()
    cy.getBySel('orgsDropdown').should('be.visible').contains('button', loginInfo.user).click()
  })

  cy.window().should((win) => {
    const loginInfo = JSON.parse(win.localStorage.getItem('login_items') || '{}')
    expect(loginInfo.logged_as, 'logged_as after session change').to.eq(loginInfo.id)
  })

  cy.visit('/dashboard')
  cy.getBySel('loggedAcc').should('be.visible')
}

const openCategoriesSection = (): void => {
  cy.getBySel('adminCategoriesSection').should('be.visible').click()
  cy.getBySel('adminAddNewCategory').should('be.visible')
}

const switchToSellerOrganizationForAdminChanges = (): void => {
  cy.changeSessionTo(ORGS.SELLER)
  cy.getBySel('adminCategoriesSection').should('be.visible')
}

const configureDefaultCatalog = (name: string): void => {
  cy.intercept('POST', '**/admin/catalog/catalog').as('createDefaultCatalog')
  cy.intercept('POST', '**/admin/defaultcatalog').as('setDefaultCatalog')

  cy.getBySel('adminDefaultCatalogSection').should('be.visible').click()
  cy.getBySel('adminDefaultCatalogName').should('be.visible').clear().type(name)
  cy.getBySel('adminDefaultCatalogDescription').clear().type('Default catalog for admin categories and search filters E2E')
  cy.getBySel('adminSaveDefaultCatalog').should('not.be.disabled').click()

  cy.wait('@createDefaultCatalog', { timeout: 120000 }).then(({ request, response }) => {
    expect(
      response?.statusCode,
      `default catalog create response: ${JSON.stringify(response?.body)} request: ${JSON.stringify(request.body)}`
    ).to.be.oneOf([200, 201])
  })
  cy.wait('@setDefaultCatalog', { timeout: 120000 }).then(({ request, response }) => {
    expect(
      response?.statusCode,
      `set default catalog response: ${JSON.stringify(response?.body)} request: ${JSON.stringify(request.body)}`
    ).to.be.oneOf([200, 201, 204])
  })
  cy.request<{ defaultId?: string }>('http://localhost:8004/config')
    .its('body.defaultId')
    .should('be.a', 'string')
    .and('not.be.empty')
}

const openSearchFiltersSection = (): void => {
  cy.getBySel('adminSearchFiltersSection').should('be.visible').click()
  cy.getBySel('adminSearchFiltersConfig').should('be.visible')
}

const setTextareaValue = (selector: string, value: string): void => {
  cy.getBySel(selector)
    .should('be.visible')
    .clear()
    .invoke('val', value)
    .trigger('input')
}

const createCategory = (name: string, parentName?: string): void => {
  cy.intercept('POST', '**/catalog/category').as('createCategory')

  cy.getBySel('adminAddNewCategory').should('be.visible').click()
  cy.getBySel('adminCategoryNameInput').should('be.visible').clear().type(name)

  if (parentName) {
    cy.getBySel('adminToggleParentCategory').click({ force: true })
    cy.contains('[data-cy="adminParentCategoryRow"]', parentName, { timeout: 120000 })
      .should('be.visible')
      .within(() => {
        cy.getBySel('adminParentCategoryCheckbox').click({ force: true })
      })
  }

  cy.getBySel('adminCategoryNext').should('not.be.disabled').click()
  cy.getBySel('adminCreateCategory').should('be.visible').click()
  cy.wait('@createCategory').then(({ request, response }) => {
    expect(
      response?.statusCode,
      `create category "${name}" response: ${JSON.stringify(response?.body)} request: ${JSON.stringify(request.body)}`
    ).to.be.oneOf([200, 201])
  })
  cy.getBySel('adminAddNewCategory', { timeout: 120000 }).should('be.visible')
}

const launchCategory = (name: string): void => {
  cy.intercept('PATCH', '**/catalog/category/*').as('updateCategory')

  cy.contains('[data-cy="adminCategoryRow"]', name, { timeout: 120000 })
    .should('be.visible')
    .within(() => {
      cy.getBySel('adminEditCategory').click()
    })

  cy.getBySel('adminCategoryStatusLaunched').should('be.visible').click()
  cy.getBySel('adminCategoryNext').should('not.be.disabled').click()
  cy.getBySel('adminUpdateCategory').should('be.visible').click()
  cy.wait('@updateCategory').then(({ request, response }) => {
    expect(
      response?.statusCode,
      `update category "${name}" response: ${JSON.stringify(response?.body)} request: ${JSON.stringify(request.body)}`
    ).to.be.oneOf([200, 201])
  })

  cy.contains('[data-cy="adminCategoryRow"]', name, { timeout: 120000 })
    .should('be.visible')
    .within(() => {
      cy.getBySel('adminCategoryStatus').should('contain', 'Launched')
    })
}

const createLaunchedCategory = (name: string, parentName?: string): void => {
  createCategory(name, parentName)
  launchCategory(name)
}

const configureSearchFilters = (seed: CategorySeed): void => {
  const searchFilters = {
    primaryCategoriesMode: 'rooted',
    primaryRootName: seed.primaryRootName,
    filters: [
      {
        name: `admin_e2e_filter_${Date.now()}`,
        label: seed.toolbarFilterLabel,
        source: 'categoryRoot',
        rootName: seed.filterRootName,
      },
    ],
  }

  cy.intercept('PATCH', '**/config/filters').as('saveSearchFilters')
  cy.intercept('GET', '**/config').as('getConfig')

  openSearchFiltersSection()
  cy.wait('@getConfig')
  setTextareaValue('adminSearchFiltersJson', JSON.stringify(searchFilters, null, 2))
  cy.getBySel('adminSaveSearchFiltersJson').should('be.visible').click()
  cy.wait('@saveSearchFilters').its('response.statusCode').should('be.oneOf', [200, 204])
  cy.wait('@getConfig')
}

const openSearchFromBrowseMenu = (): void => {
  cy.intercept('GET', '**/catalog/category*').as('categoryList')

  cy.getBySel('browse').should('be.visible').click()
  cy.getBySel('browseServices').should('be.visible').click()

  cy.url().should('include', '/search')
  cy.wait('@categoryList')
}

describe('Administration Categories And Search Filters E2E', {
  viewportHeight: 1080,
  viewportWidth: 1920,
}, () => {
  beforeEach(() => {
    cy.loginAsAdmin()
    ensurePersonalAdminSession()
    cy.on('uncaught:exception', (err) => {
      console.error('Uncaught exception:', err.message)
      if (err.message.includes("Unexpected token '<'")) {
        return false
      }
    })
  })

  it('should create launched admin categories, configure search filters, and expose them in search', () => {
    const suffix = Date.now()
    const seed: CategorySeed = {
      defaultCatalogName: `E2E Admin Default Catalog ${suffix}`,
      primaryRootName: `E2E Admin Primary Root ${suffix}`,
      primaryChildName: `E2E Admin Primary Child ${suffix}`,
      filterRootName: `E2E Admin Filter Root ${suffix}`,
      filterChildName: `E2E Admin Filter Child ${suffix}`,
      toolbarFilterLabel: `E2E Admin Filter ${suffix}`,
    }

    openAdministrationFromMenu()
    switchToSellerOrganizationForAdminChanges()
    configureDefaultCatalog(seed.defaultCatalogName)
    openCategoriesSection()

    createLaunchedCategory(seed.primaryRootName)
    createLaunchedCategory(seed.primaryChildName, seed.primaryRootName)
    createLaunchedCategory(seed.filterRootName)
    createLaunchedCategory(seed.filterChildName, seed.filterRootName)

    configureSearchFilters(seed)
    openSearchFromBrowseMenu()

    cy.getBySel('searchCategoryDropdown').should('be.visible').click()
    cy.contains('[data-cy="searchCategoryItem"]', seed.primaryChildName, { timeout: 120000 })
      .should('be.visible')
    cy.getBySel('searchCategoryDropdown').should('be.visible').click()
    cy.contains('[data-cy="searchCategoryItem"]', seed.primaryChildName).should('not.exist')

    cy.contains('[data-cy="searchToolbarFilter"]', seed.toolbarFilterLabel, { timeout: 120000 })
      .should('be.visible')
      .click()
    cy.contains('[data-cy="searchToolbarFilterOption"]', seed.filterChildName, { timeout: 120000 })
      .should('be.visible')
  })
})
