import { PROXY_URL } from './endpoints'

/** Use the real session and organization headers, as the Angular interceptor does. */
export function api(method: string, url: string, body?: any, failOnStatusCode = true, organizationId?: string): Cypress.Chainable<Cypress.Response<any>> {
  return cy.window({ log: false }).then(win => {
    const session = JSON.parse(win.localStorage.getItem('login_items') || '{}')
    expect(typeof session.token === 'string' && session.token.length > 0, 'authenticated test session').to.eq(true)
    const headers: Record<string, string> = { Authorization: `Bearer ${session.token}` }
    const organization = organizationId || (session.logged_as !== session.id ? session.logged_as : undefined)
    if (organization) headers['X-Organization'] = organization
    return cy.request({ method, url: `${PROXY_URL}${url}`, headers, body, failOnStatusCode, log: false })
  })
}
