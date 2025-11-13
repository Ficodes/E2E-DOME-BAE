describe('DOME System E2E Tests', {
  viewportHeight: 1080,
  viewportWidth: 1920,
}, () => {

  it('should load frontend successfully', () => {
    cy.visit('/')
    cy.url().should('include', 'localhost:4200')
  })

  it('should verify proxy backend is running', () => {
    cy.request('http://localhost:8004/version').then((response) => {
      expect(response.status).to.eq(200)
    })
  })

  it('should verify charging backend is running', () => {
    cy.request('http://localhost:8004/service').then((response) => {
      expect(response.status).to.eq(200)
    })
  })

  it('should verify IDM is running', () => {
    cy.request('http://localhost:3000/version').then((response) => {
      expect(response.status).to.eq(200)
    })
  })

  it('should verify TMForum APIs are running', () => {
    cy.request('http://localhost:8636/resourceCatalog').then((response) => {
      expect(response.status).to.eq(200)
    })

    cy.request('http://localhost:8637/serviceCatalog').then((response) => {
      expect(response.status).to.eq(200)
    })

    cy.request('http://localhost:8632/productSpecification').then((response) => {
      expect(response.status).to.eq(200)
    })
  })

  it('should fetch config from proxy', () => {
    cy.request('http://localhost:8004/config').then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body).to.have.property('siop')
    })
  })

  it('should fetch stats from proxy', () => {
    cy.request({
      url: 'http://localhost:8004/stats',
      failOnStatusCode: false
    }).then((response) => {
      expect([200, 404]).to.include(response.status)
    })
  })

  it('should access catalog endpoints through proxy', () => {
    cy.request({
      url: 'http://localhost:8004/catalog/catalog',
      failOnStatusCode: false
    }).then((response) => {
      expect([200, 401, 404]).to.include(response.status)
    })
  })

  it('should access product offerings through proxy', () => {
    cy.request({
      url: 'http://localhost:8004/catalog/productOffering',
      failOnStatusCode: false
    }).then((response) => {
      expect([200, 401, 404]).to.include(response.status)
    })
  })

  it('should interact with frontend after loading', () => {
    cy.visit('/')
    cy.wait(2000)

    // Verify page loaded
    cy.get('body').should('be.visible')
  })
})
