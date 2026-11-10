import { PROXY_URL } from '../../support/endpoints'
import { api, assetTypes, buildPlugin, prefix, TestPlugin, usePersonalSession } from '../../support/plugins'
import { openAccountPage } from '../../support/navigation'

describe('Plugin administration E2E', () => {
  it('rejects unauthenticated package installation and removal', () => {
    cy.clearAllCookies()
    cy.request({ method: 'POST', url: `${PROXY_URL}${assetTypes}/installJob`, failOnStatusCode: false })
      .its('status').should('eq', 401)
    cy.request({ method: 'DELETE', url: `${PROXY_URL}${assetTypes}/e2e-not-installed`, failOnStatusCode: false })
      .its('status').should('eq', 401)
  })

  for (const domain of ['service', 'resource'] as const) {
    it(`installs, upgrades and removes an unused ${domain} plugin`, () => {
      cy.loginAsAdmin()
      usePersonalSession()
      let installed: TestPlugin
      cy.intercept('POST', `**${assetTypes}/installJob`).as('installPlugin')
      cy.intercept('GET', `**${assetTypes}`).as('listPlugins')
      openAccountPage('administration')
      cy.getBySel('adminPluginsSection').click()
      cy.wait('@listPlugins')
      // Browser checks and server package validation are separate boundaries.
      cy.getBySel('adminPluginPackage').selectFile({ contents: Cypress.Buffer.from('invalid'), fileName: 'invalid.txt' })
      cy.getBySel('adminInstallPlugin').should('be.disabled')
      cy.getBySel('adminPluginPackage').selectFile({ contents: Cypress.Buffer.from('not a zip'), fileName: 'invalid.zip' })
      cy.getBySel('adminInstallPlugin').should('be.enabled').click()
      cy.wait('@installPlugin').its('response.statusCode').should('eq', 422)

      function upload(version: string, expectedStatus: number) {
        buildPlugin(domain, false, 'administration', version).then(plugin => {
          cy.getBySel('adminPluginPackage').selectFile(plugin.path)
          cy.getBySel('adminInstallPlugin').should('be.enabled').click()
          cy.wait('@installPlugin').then(({ response }) => {
            expect(response?.statusCode).to.eq(expectedStatus)
            if (expectedStatus !== 200) return
            const metadata = response!.body
            expect(metadata).to.include({ id: plugin.id, name: plugin.name, type: domain, version })
            expect(metadata.categoryId).to.be.a('string').and.not.be.empty
            if (installed) expect(metadata.categoryId).to.eq(installed.categoryId)
            installed = { ...plugin, ...metadata }
          })
          if (expectedStatus === 200) {
            cy.wait('@listPlugins')
            cy.contains('[data-cy="adminPluginRow"]', plugin.name).should('contain.text', version)
          } else {
            api('GET', `${assetTypes}/${plugin.id}`).its('body.version').should('eq', '2.0')
          }
        })
      }

      upload('1.0', 200)
      upload('2.0', 200)
      upload('2.0', 409)
      upload('1.0', 409)
      cy.then(() => {
        // The package must become usable immediately, in its own domain only.
        for (const editor of ['service', 'resource'] as const) {
          const p = prefix(editor)
          cy.intercept('GET', `**${assetTypes}?type=${editor}`).as('editorPluginTypes')
          openAccountPage('offerings')
          cy.getBySel(`${p}Section`).click()
          cy.getBySel(editor === 'service' ? 'createServSpec' : 'createResSpec').click()
          cy.wait('@editorPluginTypes')
          if (editor === domain) {
            cy.getBySel(`${p}Type`).find(`option[value="${installed.id}"]`).should('be.enabled')
            cy.getBySel(`${p}Type`).select(installed.id)
          } else {
            cy.get(`option[value="${installed.id}"]`).should('not.exist')
          }
          cy.getBySel('workspaceBack').click()
          if (editor === domain) cy.getBySel(`${p}DiscardChanges`).should('be.visible').click()
          cy.getBySel(`${p}Section`).should('be.visible')
        }
        openAccountPage('administration')
        cy.getBySel('adminPluginsSection').click()
        cy.wait('@listPlugins')
        cy.intercept('DELETE', `**${assetTypes}/${installed.id}`).as('deletePlugin')
        cy.contains('[data-cy="adminPluginRow"]', installed.name).within(() => {
          cy.getBySel('adminDeletePlugin').click()
        })
        // Cancel first: opening the confirmation must not remove the package.
        cy.getBySel('adminDeletePluginModal').find('[data-cy="confirmDialogCancel"]').click()
        api('GET', `${assetTypes}/${installed.id}`).its('status').should('eq', 200)
        cy.contains('[data-cy="adminPluginRow"]', installed.name).within(() => {
          cy.getBySel('adminDeletePlugin').click()
        })
        cy.getBySel('adminDeletePluginModal').find('[data-cy="confirmDialogConfirm"]').click()
        cy.wait('@deletePlugin').then(({ response }) => {
          expect(response?.statusCode).to.eq(204)
          expect(response?.body).to.be.oneOf(['', undefined, null])
        })
        cy.wait('@listPlugins')
        cy.contains('[data-cy="adminPluginRow"]', installed.name).should('not.exist')
        api('GET', `${assetTypes}/${installed.id}`, undefined, false).its('status').should('eq', 404)
        api('DELETE', `${assetTypes}/${installed.id}`, undefined, false).its('status').should('eq', 404)
        cy.intercept('GET', `**${assetTypes}?type=${domain}`).as('removedPluginTypes')
        openAccountPage('offerings')
        cy.getBySel(`${prefix(domain)}Section`).click()
        cy.getBySel(domain === 'service' ? 'createServSpec' : 'createResSpec').click()
        cy.wait('@removedPluginTypes')
        cy.get(`option[value="${installed.id}"]`).should('not.exist')
      })
    })
  }
})
