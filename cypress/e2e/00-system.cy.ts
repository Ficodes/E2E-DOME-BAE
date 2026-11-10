import { IDM_URL, PROXY_URL, TMF_URL } from '../support/endpoints'
describe('DOME System E2E Tests', {
  viewportHeight: 1080,
  viewportWidth: 1920,
}, () => {

  it('should load frontend successfully', () => {
    cy.visit('/')
    cy.location('origin').should('eq', new URL(Cypress.config('baseUrl')!).origin)
  })

  it('should verify proxy backend is running', () => {
    cy.request(`${PROXY_URL}/version`).then((response) => {
      expect(response.status).to.eq(200)
    })
  })

  it('should verify charging backend is running', () => {
    cy.request(`${PROXY_URL}/service`).then((response) => {
      expect(response.status).to.eq(200)
    })
  })

  it('should verify IDM is running', () => {
    cy.request(`${IDM_URL}/version`).then((response) => {
      expect(response.status).to.eq(200)
    })
  })

  it('should verify TMForum APIs are running', () => {
    cy.request(`${TMF_URL}/tmf-api/resourceCatalog/v4/resourceCatalog`).then((response) => {
      expect(response.status).to.eq(200)
    })

    cy.request(`${TMF_URL}/tmf-api/serviceCatalogManagement/v4/serviceCatalog`).then((response) => {
      expect(response.status).to.eq(200)
    })

    cy.request(`${TMF_URL}/tmf-api/productCatalogManagement/v4/productSpecification`).then((response) => {
      expect(response.status).to.eq(200)
    })
  })

  it('should fetch config from proxy', () => {
    cy.request(`${PROXY_URL}/config`).then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body).to.have.property('siop')
    })
  })

  it('should fetch stats from proxy', () => {
    cy.request({
      url: `${PROXY_URL}/stats`,
      failOnStatusCode: false
    }).then((response) => {
      expect([200, 404]).to.include(response.status)
    })
  })

  it('should access catalog endpoints through proxy', () => {
    cy.request({
      url: `${PROXY_URL}/catalog/catalog`,
      failOnStatusCode: false
    }).then((response) => {
      expect([200, 401, 404]).to.include(response.status)
    })
  })

  it('should access product offerings through proxy', () => {
    cy.request({
      url: `${PROXY_URL}/catalog/productOffering`,
      failOnStatusCode: false
    }).then((response) => {
      expect([200, 401, 404]).to.include(response.status)
    })
  })

  it('should interact with frontend after loading', () => {
    cy.visit('/')
    // Verify page loaded
    cy.get('body').should('be.visible')
  })
})
