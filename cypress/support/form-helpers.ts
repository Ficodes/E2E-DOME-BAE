// Helper functions for filling forms in the application

export interface CatalogParams {
  name: string
  description: string
}

export interface UpdateCatalogStatusParams {
  name: string
  status: string
}

export interface ProductSpecParams {
  name: string
  description?: string
  howItWorks?: string
  version?: string
  brand: string
  productNumber: string
  serviceSpecName?: string | null
  resourceSpecName?: string | null
  characteristics?: Characteristic[]
}

export interface UpdateProductSpecStatusParams {
  name: string
  status: string
}

export interface PricePlan {
  name: string
  description?: string
  forbiddenCharacteristics?: string[]
}

export interface PriceComponent {
  name: string
  description: string
  price: number
  type: string
  recurringPeriod?: string
  usageInput?: [string, string]
  charLink?: { characteristicName: string; value?: string }
  tier?: {
    min: number
    max: number
    price: number
    type: string
    name: string
    description: string
    recurringPeriod?: string
  }
}

export interface OfferingParams {
  name: string
  version?: string
  description: string
  productSpecName: string
  catalogName: string
  detailedDescription: string
  mode: string
  pricePlan?: PricePlan
  priceComponent?: PriceComponent
  priceComponents?: PriceComponent[]
  procurement: string
}

export interface UpdateOfferingParams {
  name: string
  status: string
}

export function selectProcurementMode(procurement: string): void {
  cy.wait('@getPaymentInfo')
  cy.getBySel('procurement').click()
  cy.getBySel(`procurement-${procurement}`).should('be.visible').click()
  cy.getBySel('procurement').should('not.have.attr', 'aria-expanded', 'true')
}

function selectFirstAvailableOption(selector: string): void {
  cy.get(selector)
    .find('option')
    .not('[value=""]')
    .should('have.length.greaterThan', 0)
    .first()
    .then(($option) => {
      cy.get(selector).select(String($option.val()))
    })
}

export interface BillingParams {
  title: string
  country: string
  city: string
  state: string
  zip: string
  street: string
  email: string
  phoneNumber: string
}

export interface CharacteristicValue {
  value: number
  unit: string
}

export interface RangeValue {
  from: number
  to: number
  unit: string
}

export interface Characteristic {
  name: string
  description: string
  type: 'string' | 'number' | 'range'
  values: string[] | CharacteristicValue[] | RangeValue
}

export interface ServiceSpecParams {
  name: string
  description: string
  characteristics?: Characteristic[]
}

export interface ResourceSpecParams {
  name: string
  description: string
  characteristics?: Characteristic[]
}

export interface UpdateServiceSpecStatusParams {
  name: string
  status: string
}

export interface UpdateResourceSpecStatusParams {
  name: string
  status: string
}

export interface Metric {
  name: string
  description: string
}

export interface UsageSpecParams {
  name: string
  description: string
  metrics?: Metric[]
}

export interface DspEndpoint {
  name: string
  url: string
  description: string
}

export interface DspConfig {
  endpoint: DspEndpoint
  upstreamAddress: string
  targetSpecification: string
  serviceConfiguration: string
  credentialsConfig: string
  policyConfig: string
}

export interface DspContractDefinition {
  accessPolicy: string
  contractPolicy: string
}

export interface DspProductSpecParams {
  name: string
  version?: string
  brand: string
  productNumber: string
  dspConfig: DspConfig
}

export interface DspOfferingParams {
  name: string
  version?: string
  description: string
  productSpecName: string
  catalogName: string
  detailedDescription: string
  procurement: string
  pricePlan?: PricePlan
  priceComponent?: PriceComponent
  contractDefinition: DspContractDefinition
}

/**
 * Create a new catalog
 */
export function createCatalog({ name, description }: CatalogParams): void {
  cy.visit('/my-offerings')
  cy.getBySel('catalogSection').click()
  cy.getBySel('newCatalog').click()

  // Fill catalog form - Step 1: General info
  cy.getBySel('catalogName').should('be.visible').type(name)
  cy.getBySel('catalogDsc').type(description)
  cy.getBySel('catalogNext').click()

  // Step 2: Finish catalog creation
  cy.getBySel('catalogFinish').click()

  // Close feedback modal if it appears, then wait for redirect back to catalog list
  cy.closeFeedbackModalIfVisible()
  cy.getBySel('catalogTable').should('be.visible')

  // Verify catalog appears in table
  cy.getBySel('catalogTable').should('be.visible')
  cy.getBySel('catalogTable').contains(name).should('be.visible')
}

/**
 * Update catalog status
 */
export function updateCatalogStatus({ name, status }: UpdateCatalogStatusParams): void {
  expect(status).to.eq('launched')
  cy.intercept('PATCH', '**/catalog/catalog/**').as('publishCatalog')

  cy.getBySel('catalogTable').contains(name).parents('[data-cy="catalogRow"]').within(() => {
    cy.getBySel('catalogActions').click()
  })
  cy.getBySel('catalogPublish').should('be.visible').click()
  cy.wait('@publishCatalog').its('response.statusCode').should('be.oneOf', [200, 204])

  // Close feedback modal if it appears
  cy.closeFeedbackModalIfVisible()

  // Allow the TMForum API list cache to expire before requesting the new status.
  cy.wait(2500)
  waitForInitialPaginatedList('**/catalog/catalog?*', () => {
    cy.contains('button', 'Published').click()
  })
  clickLoadMoreUntilGone(10, '[data-cy="catalogRow"]')
  cy.getBySel('catalogTable').contains(name).parents('[data-cy="catalogRow"]').within(() => {
    cy.getBySel('catalogStatus').should('contain.text', 'Published')
  })
}

/**
 * Create a new product specification
 */
export function createProductSpec({
  name,
  description = 'E2E product specification description',
  howItWorks = 'E2E product specification usage description',
  serviceSpecName = null,
  resourceSpecName = null,
  characteristics = [],
}: ProductSpecParams): void {
  cy.visit('/my-offerings')
  cy.getBySel('prdSpecSection').click()
  cy.getBySel('createProdSpec').click()

  // Fill product spec form - Step 1: General info
  cy.getBySel('prodSpecName').should('be.visible').type(name)
  cy.get('#prod-image-upload').selectFile({
    contents: Cypress.Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/Pu98WQAAAABJRU5ErkJggg==', 'base64'),
    fileName: 'e2e-product.png',
    mimeType: 'image/png'
  }, { force: true })

  cy.getBySel('prodSpecNext').should('be.enabled').click()
  cy.getBySel('prodSpecDescription').find('textarea').type(description)
  cy.getBySel('prodSpecHowItWorks').find('textarea').type(howItWorks)

  if (characteristics.length > 0) {
    cy.contains('span', 'Configuration options').click({ force: true })

    characteristics.forEach((characteristic) => {
      cy.contains('button', 'Add configuration option').click()
      cy.getBySel('prodSpecCharName').type(characteristic.name)
      cy.getBySel('prodSpecCharType').select(characteristic.type)
      cy.getBySel('prodSpecCharDescription').type(characteristic.description)

      if (characteristic.type === 'string') {
        ;(characteristic.values as string[]).forEach((value) => {
          cy.getBySel('prodSpecCharValueString').type(value)
          cy.getBySel('prodSpecAddCharValue').click()
        })
      } else if (characteristic.type === 'number') {
        ;(characteristic.values as CharacteristicValue[]).forEach(({ value, unit }) => {
          cy.getBySel('prodSpecCharValueNumber').type(String(value))
          cy.getBySel('prodSpecCharValueUnit').type(unit)
          cy.getBySel('prodSpecAddCharValue').click()
        })
      } else {
        const { from, to, unit } = characteristic.values as RangeValue
        cy.getBySel('prodSpecCharValueFrom').type(String(from))
        cy.getBySel('prodSpecCharValueTo').type(String(to))
        cy.getBySel('prodSpecCharValueUnit').type(unit)
        cy.getBySel('prodSpecAddCharValue').click()
      }

      cy.getBySel('prodSpecSaveChar').should('be.enabled').click()
    })
  }

  if (serviceSpecName) {
    cy.contains('span', 'Service specifications').click({ force: true })
    cy.contains('h2', 'Service specifications').parent().find('input[type="text"]').click()
    cy.contains('label', serviceSpecName).should('be.visible').find('input[type="checkbox"]').check()
  }

  if (resourceSpecName) {
    cy.contains('span', 'Resource specifications').click({ force: true })
    cy.contains('h2', 'Resource specification').parent().find('input[type="text"]').click()
    cy.contains('label', resourceSpecName).should('be.visible').find('input[type="checkbox"]').check()
  }

  cy.contains('span', 'Compliance profile').click({ force: true })
  cy.getBySel('prodSpecFinish').should('be.enabled').click()
  cy.contains('button', 'Save as draft').should('be.enabled').click()

  // Close feedback modal if it appears
  cy.closeFeedbackModalIfVisible()

  // Verify product spec appears in table
  cy.getBySel('prodSpecTable').should('be.visible')
  cy.getBySel('prodSpecTable').contains(name).should('be.visible')
}

/**
 * Update product spec status
 */
export function updateProductSpecStatus({ name, status }: UpdateProductSpecStatusParams): void {
  expect(status).to.eq('launched')
  cy.intercept('PATCH', '**/catalog/productSpecification/**').as('validateProductSpec')

  cy.getBySel('prodSpecTable').contains(name).parents('[data-cy="prodSpecRow"]').within(() => {
    cy.get('td').last().find('button').first().click()
    cy.contains('button', 'Validate').should('be.visible').click()
  })
  cy.wait('@validateProductSpec').its('response.statusCode').should('be.oneOf', [200, 204])

  // Close feedback modal if it appears
  cy.closeFeedbackModalIfVisible()

  cy.wait(2500)
  waitForInitialPaginatedList('**/catalog/productSpecification?*', () => {
    cy.contains('button', 'Validated').click()
  })
  clickLoadMoreUntilGone(10, '[data-cy="prodSpecRow"]')
  cy.getBySel('prodSpecTable').contains(name).parents('[data-cy="prodSpecRow"]').should('contain.text', 'Validated')
}

/**
 * Create a new offering
 */
export function createOffering({
  name,
  version = '0.1',
  description,
  productSpecName,
  catalogName,
  detailedDescription,
  mode,
  pricePlan,
  priceComponent,
  priceComponents,
  procurement
}: OfferingParams): void {
  cy.intercept('GET', '**/paymentInfo').as('getPaymentInfo')
  cy.visit('/my-offerings')
  cy.getBySel('offerSection').click()
  cy.getBySel('newOffering').click()

  // Step 1: General information
  cy.getBySel('offerName').should('be.visible').type(name)
  cy.get('#prodSpecSelect').should('be.visible').select(productSpecName)
  cy.getBySel('offerCatalogSelect').should('be.visible').select(catalogName)
  cy.get('body').then(($body) => {
    if ($body.find('#generalInfoCategoryFilter').length > 0) {
      selectFirstAvailableOption('#generalInfoCategoryFilter')
    }
  })
  cy.getBySel('offerOverview').type(description)
  cy.getBySel('offerNext').click()

  // Step 2: Category
  selectFirstAvailableOption('#rootCategorySelect')
  cy.getBySel('offerNext').click()

  // Step 3: Terms and conditions
  cy.getBySel('tcText').find('textarea').type(detailedDescription)
  cy.getBySel('offerNext').click()

  // Step 4: Price plans
  if (mode === 'paid' && pricePlan) {
    cy.contains('button', 'Online paid price').click()
    cy.getBySel('addPricePlan').first().click()
    cy.contains('button', 'Flex plan').click()
    cy.getBySel('selectPlanTypeContinue').should('be.enabled').click()
    cy.getBySel('paidName').type(pricePlan.name)
    cy.getBySel('paidDescription').find('textarea').type(pricePlan.description || 'E2E price plan')

    const forbiddenCharacteristics = pricePlan.forbiddenCharacteristics || []
    if (forbiddenCharacteristics.length > 0) {
      cy.getBySel('choosePricePlanCharacteristics').click()
      forbiddenCharacteristics.forEach((characteristicName) => {
        cy.getBySel('pricePlanCharacteristicsModal')
          .contains('p', characteristicName)
          .should('be.visible')
          .parent()
          .siblings('div')
          .find('button[role="switch"]')
          .should('have.attr', 'aria-checked', 'true')
          .click()
          .should('have.attr', 'aria-checked', 'false')
      })
      cy.getBySel('savePricePlanCharacteristics').click()
    }

    const assertForbiddenCharacteristicsAreUnavailable = () => {
      forbiddenCharacteristics.forEach((characteristicName) => {
        cy.getBySel('pcConfigOption').find('option').should(($options) => {
          const optionLabels = Array.from($options, (option) => option.textContent?.trim())
          expect(optionLabels).not.to.include(characteristicName)
        })
      })
    }

    const components = priceComponents || (priceComponent ? [priceComponent] : [])
    components.forEach((pc) => {
      cy.getBySel('addPriceComponent').click()
      assertForbiddenCharacteristicsAreUnavailable()
      cy.getBySel('pcName').type(pc.name)
      cy.getBySel('pcDescription').type(pc.description)
      cy.getBySel('pcBasePrice').type(String(pc.price))
      cy.getBySel('pcPriceType').click()
      cy.getBySel(`pcPriceType-${pc.type}`).click()

      if (pc.charLink) {
        cy.getBySel('pcConfigOption').select(pc.charLink.characteristicName)
        if (pc.charLink.value) {
          cy.getBySel('pcConfigValue').select(pc.charLink.value)
        }
      }

      if (pc.recurringPeriod) {
        cy.getBySel(`pcRecurringPeriod-${pc.recurringPeriod}`).check()
      } else if (pc.usageInput) {
        cy.getBySel('pcUsageSpec').select(pc.usageInput[0])
        cy.getBySel('pcMetric').select(pc.usageInput[1])
      }

      if (pc.tier) {
        cy.getBySel('pcAddTier').click()
        cy.getBySel('tierMin').clear().type(String(pc.tier.min))
        cy.getBySel('tierMax').clear().type(String(pc.tier.max))
        cy.getBySel('tierPrice').type(String(pc.tier.price))
        cy.getBySel('tierPriceType').select(pc.tier.type)
        cy.getBySel('tierName').type(pc.tier.name)
        cy.getBySel('tierDescription').type(pc.tier.description)
        if (pc.tier.recurringPeriod) {
          cy.get('[formcontrolname="recurringPeriod"]').filter(':visible').select(pc.tier.recurringPeriod)
        }
        cy.getBySel('pcSaveTier').should('be.enabled').click()
      }

      cy.getBySel('pcSave').should('be.enabled').click()
    })

    if (forbiddenCharacteristics.length > 0 && components.length > 0) {
      cy.contains('td', components[0].name).parents('tr').first().within(() => {
        cy.get('button').click()
      })
      cy.contains('button', 'Edit').should('be.visible').click()
      assertForbiddenCharacteristicsAreUnavailable()
      cy.getBySel('pcSave').should('be.enabled').click()
    }

    cy.getBySel('ppSave').should('be.enabled').click()
  } else {
    cy.contains('button', 'Free').click()
  }
  cy.getBySel('offerNext').click()

  // Step 5: Procurement info
  selectProcurementMode(procurement)

  // Finish
  waitForInitialPaginatedList('**/catalog/productOffering?*', () => {
    cy.getBySel('offerFinish').should('be.enabled').click()
  })

  // Close feedback modal if it appears
  cy.closeFeedbackModalIfVisible()

  // Verify offering was created in table
  cy.getBySel('offers').should('be.visible')

  clickLoadMoreUntilFound(name, '[data-cy="offerRow"]')

  cy.getBySel('offers').contains(name).should('be.visible')
}

/**
 * Update offering status
 */
export function updateOffering({ name, status }: UpdateOfferingParams): void {
  expect(status).to.eq('launched')

  clickLoadMoreUntilFound(name, '[data-cy="offerRow"]')

  cy.intercept('PATCH', '**/catalog/productOffering/**').as('publishOffering')

  cy.getBySel('offers').contains(name).parents('[data-cy="offerRow"]').within(() => {
    cy.getBySel('offerActions').find('button').first().click()
    cy.contains('button', 'Publish').should('be.visible').and('not.be.disabled').click()
  })
  cy.wait('@publishOffering').its('response.statusCode').should('be.oneOf', [200, 204])

  // Close feedback modal if it appears
  cy.closeFeedbackModalIfVisible()
}


/**
 * Run an action that triggers a paginated list load and wait until all matching requests settle.
 */
export function waitForInitialPaginatedList(apiPattern: string | string[], action: () => void, idleMs = 300): void {
  createRequestTracker(apiPattern, idleMs).waitForAction(action)
}

/**
 * Register a single intercept for reuse across multiple actions.
 * Avoids accumulating handlers when the same URL pattern must be waited on multiple times.
 * Use waitForAction() instead of registering a new intercept each time.
 *
 * abandonMs: requests with no response after this many ms are treated as aborted and ignored.
 * Cypress does not fire req.on('response') for requests cancelled by the app (AbortController /
 * browser navigation), so without this, pendingRequests stays elevated indefinitely.
 */
export function createRequestTracker(apiPattern: string | string[], idleMs = 300, abandonMs = 5000) {
  let pendingRequests = 0
  let lastActivity = Date.now()
  let seenRequest = false
  let requestId = 0
  const pendingStartTimes = new Map<number, number>()

  const patterns = Array.isArray(apiPattern) ? apiPattern : [apiPattern]
  const label = patterns.join(', ')

  for (const pattern of patterns) {
    cy.intercept('GET', pattern, (req) => {
      const id = requestId++
      const finished = new Set<number>()
      seenRequest = true
      pendingRequests++
      pendingStartTimes.set(id, Date.now())
      lastActivity = Date.now()

      const finish = () => {
        if (finished.has(id)) return
        finished.add(id)
        pendingRequests = Math.max(0, pendingRequests - 1)
        pendingStartTimes.delete(id)
        lastActivity = Date.now()
      }
      req.on('response', finish)
      req.on('after:response', finish)
    })
  }

  return {
    waitForAction: (action: () => void) => {
      cy.then(() => {
        seenRequest = false
        pendingRequests = 0
        pendingStartTimes.clear()
        lastActivity = Date.now()
      })
      action()
      cy.wrap(null).should(() => {
        // Requests aborted by the app (AbortController, navigation) never fire req.on('response').
        // After abandonMs without a response, treat them as done so we don't block forever.
        const now = Date.now()
        for (const [id, startTime] of pendingStartTimes) {
          if (now - startTime > abandonMs) {
            pendingRequests = Math.max(0, pendingRequests - 1)
            pendingStartTimes.delete(id)
            lastActivity = now
          }
        }
        expect(seenRequest, `${label} has seen requests`).to.eq(true)
        expect(pendingRequests, `${label} pending requests`).to.eq(0)
        expect(Date.now() - lastActivity, `${label} idle time`).to.be.greaterThan(idleMs)
      })
    },
  }
}

/**
 * Click "Load More" button repeatedly until all items are loaded.
 * Waits for the loadMoreLoading spinner to appear then disappear after each click.
 * Optionally waits for itemSelector to be visible before starting.
 */
export function clickLoadMoreUntilGone(maxClicks = 10, itemSelector?: string): void {
  if (itemSelector) {
    cy.get(itemSelector).should('be.visible')
  }

  const clickIfExists = (remaining: number): void => {
    if (remaining === 0) return

    cy.get('body').then($body => {
      const loadMore = $body.find('[data-cy="loadMore"]:visible')[0] as HTMLElement | undefined
      if (!loadMore) return

      const previousItemCount = itemSelector ? $body.find(itemSelector).length : 0
      cy.wrap(loadMore).click()

      if (itemSelector) {
        cy.get('body').should($updatedBody => {
          const nextItemCount = $updatedBody.find(itemSelector).length
          const stillHasLoadMore = $updatedBody.find('[data-cy="loadMore"]:visible').length > 0
          expect(
            nextItemCount > previousItemCount || !stillHasLoadMore,
            `${itemSelector} grows or Load more disappears`,
          ).to.eq(true)
        })
      } else {
        cy.getBySel('loadMoreLoading').should('not.exist')
      }

      clickIfExists(remaining - 1)
    })
  }

  clickIfExists(maxClicks)
}

/**
 * Load paginated items until a specific card or row is present.
 * This also waits for a delayed Load more button before deciding the item is absent.
 */
export function clickLoadMoreUntilFound(targetText: string, itemSelector: string, maxClicks = 10): void {
  const findOrLoad = (remaining: number): void => {
    cy.get('body').should($body => {
      const hasTarget = [...$body.find(itemSelector)].some(item => item.textContent?.includes(targetText))
      const hasLoadMore = $body.find('[data-cy="loadMore"]:visible').length > 0
      expect(hasTarget || hasLoadMore, `${targetText} or Load more is available`).to.eq(true)
    }).then($body => {
      const hasTarget = [...$body.find(itemSelector)].some(item => item.textContent?.includes(targetText))
      if (hasTarget) return

      expect(remaining, `pages remaining while looking for ${targetText}`).to.be.greaterThan(0)
      const loadMore = $body.find('[data-cy="loadMore"]:visible')[0] as HTMLElement
      const previousItemCount = $body.find(itemSelector).length

      cy.wrap(loadMore).scrollIntoView().click()
      cy.get('body').should($updatedBody => {
        const nextItemCount = $updatedBody.find(itemSelector).length
        const nextHasTarget = [...$updatedBody.find(itemSelector)]
          .some(item => item.textContent?.includes(targetText))
        const stillHasLoadMore = $updatedBody.find('[data-cy="loadMore"]:visible').length > 0
        expect(
          nextHasTarget || nextItemCount > previousItemCount || !stillHasLoadMore,
          `${itemSelector} grows, ${targetText} appears, or Load more disappears`,
        ).to.eq(true)
      })

      findOrLoad(remaining - 1)
    })
  }

  findOrLoad(maxClicks)
}

/**
 * Create checkout billing information
 */
export function createCheckoutBilling({title, country, city, state, zip, street, email, phoneNumber}: BillingParams): void {
  cy.getBySel('billingTitle').should('be.visible').type(title)
  cy.getBySel('billingCountry').should('be.visible').select(country)
  cy.getBySel('billingCity').type(city)
  cy.getBySel('billingState').type(state)
  cy.getBySel('billingZip').type(zip)
  cy.getBySel('billingAddress').type(street)
  cy.getBySel('billingEmail').type(email)
  cy.getBySel('billingPhone').parent().find('button').first().click()
  cy.get('ul[aria-labelledby="dropdown-phone-button"]').contains('Spain').scrollIntoView().click()
  cy.getBySel('billingPhone').type(phoneNumber)
  cy.getBySel('addBilling').click()
}

/**
 * Create a new service specification
 */
export function createServiceSpec({ name, description, characteristics = [] }: ServiceSpecParams): void {
  cy.visit('/my-offerings')
  cy.getBySel('servSpecSection').click()
  cy.getBySel('createServSpec').click()

  // Step 1: General info
  cy.getBySel('servSpecName').should('be.visible').type(name)
  cy.getBySel('servSpecDescription').should('be.visible').type(description)
  cy.getBySel('servSpecNext').click()

  // Step 2: Characteristics
  if (characteristics.length > 0) {
    characteristics.forEach((char) => {
      cy.contains('button', 'Add configuration option').click()

      // Fill characteristic basic info
      cy.getBySel('servSpecCharType').select(char.type)
      cy.getBySel('servSpecCharName').should('be.visible').type(char.name)
      cy.getBySel('servSpecCharDescription').type(char.description)

      // Add values based on type
      if (char.type === 'string') {
        (char.values as string[]).forEach((value) => {
          cy.getBySel('servSpecCharValueString').clear().type(value)
          cy.getBySel('servSpecAddCharValue').click()
        })
      } else if (char.type === 'number') {
        (char.values as CharacteristicValue[]).forEach((valueObj) => {
          cy.getBySel('servSpecCharValueNumber').clear().type(String(valueObj.value))
          cy.getBySel('servSpecCharValueUnit').clear().type(valueObj.unit)
          cy.getBySel('servSpecAddCharValue').click()
        })
      } else if (char.type === 'range') {
        const rangeValues = char.values as RangeValue
        cy.getBySel('servSpecCharValueFrom').clear().type(String(rangeValues.from))
        cy.getBySel('servSpecCharValueTo').clear().type(String(rangeValues.to))
        cy.getBySel('servSpecCharValueUnit').clear().type(rangeValues.unit)
        cy.getBySel('servSpecAddCharValue').click()
      }

      // Save characteristic
      cy.getBySel('servSpecSaveChar').click()
      cy.getBySel('servSpecCharName').should('not.exist')
    })
  }

  // Finish and save as draft
  cy.getBySel('servSpecFinish').should('be.enabled').click()
  cy.contains('button', 'Save as draft').should('be.enabled').click()

  // Close feedback modal if it appears
  cy.closeFeedbackModalIfVisible()

  // Verify service spec appears in list
  cy.contains(name).should('be.visible')
}

/**
 * Create a new resource specification
 */
export function createResourceSpec({ name, description, characteristics = [] }: ResourceSpecParams): void {
  cy.visit('/my-offerings')
  cy.getBySel('resSpecSection').click()
  cy.getBySel('createResSpec').click()

  // Step 1: General info
  cy.getBySel('resSpecName').should('be.visible').type(name)
  cy.getBySel('resSpecDescription').should('be.visible').type(description)
  cy.getBySel('resSpecNext').click()

  // Step 2: Characteristics
  if (characteristics.length > 0) {
    characteristics.forEach((char) => {
      cy.contains('button', 'Add configuration option').click()

      // Fill characteristic basic info
      cy.getBySel('resSpecCharType').select(char.type)
      cy.getBySel('resSpecCharName').should('be.visible').type(char.name)
      cy.getBySel('resSpecCharDescription').type(char.description)

      // Add values based on type
      if (char.type === 'string') {
        (char.values as string[]).forEach((value) => {
          cy.getBySel('resSpecCharValueString').clear().type(value)
          cy.getBySel('resSpecAddCharValue').click()
        })
      } else if (char.type === 'number') {
        (char.values as CharacteristicValue[]).forEach((valueObj) => {
          cy.getBySel('resSpecCharValueNumber').clear().type(String(valueObj.value))
          cy.getBySel('resSpecCharValueUnit').clear().type(valueObj.unit)
          cy.getBySel('resSpecAddCharValue').click()
        })
      } else if (char.type === 'range') {
        const rangeValues = char.values as RangeValue
        cy.getBySel('resSpecCharValueFrom').clear().type(String(rangeValues.from))
        cy.getBySel('resSpecCharValueTo').clear().type(String(rangeValues.to))
        cy.getBySel('resSpecCharValueUnit').clear().type(rangeValues.unit)
        cy.getBySel('resSpecAddCharValue').click()
      }

      // Save characteristic
      cy.getBySel('resSpecSaveChar').click()
      cy.getBySel('resSpecCharName').should('not.exist')
    })
  }

  // Finish and save as draft
  cy.getBySel('resSpecFinish').should('be.enabled').click()
  cy.contains('button', 'Save as draft').should('be.enabled').click()

  // Close feedback modal if it appears
  cy.closeFeedbackModalIfVisible()

  // Verify resource spec appears in list
  cy.contains(name).should('be.visible')
}

/**
 * Update resource spec status
 */
export function updateResourceSpecStatus({ name, status }: UpdateResourceSpecStatusParams): void {
  expect(status).to.eq('launched')
  cy.intercept('PATCH', '**/resource/resourceSpecification/**').as('validateResourceSpec')

  cy.getBySel('resSpecTable').contains(name).parents('[data-cy="resSpecRow"]').within(() => {
    cy.get('td').last().find('button').first().click()
    cy.contains('button', 'Validate').should('be.visible').click()
  })
  cy.wait('@validateResourceSpec').its('response.statusCode').should('be.oneOf', [200, 204])

  // Close feedback modal if it appears
  cy.closeFeedbackModalIfVisible()

  cy.wait(2500)
  waitForInitialPaginatedList('**/resource/resourceSpecification?*', () => {
    cy.contains('button', 'Validated').click()
  })
  clickLoadMoreUntilGone(10, '[data-cy="resSpecRow"]')
  cy.getBySel('resSpecTable').contains(name).parents('[data-cy="resSpecRow"]').should('contain.text', 'Validated')
}

/**
 * Update service spec status
 */
export function updateServiceSpecStatus({ name, status }: UpdateServiceSpecStatusParams): void {
  expect(status).to.eq('launched')
  cy.intercept('PATCH', '**/service/serviceSpecification/**').as('validateServiceSpec')

  cy.getBySel('servSpecTable').contains(name).parents('[data-cy="servSpecRow"]').within(() => {
    cy.get('td').last().find('button').first().click()
    cy.contains('button', 'Validate').should('be.visible').click()
  })
  cy.wait('@validateServiceSpec').its('response.statusCode').should('be.oneOf', [200, 204])

  // Close feedback modal if it appears
  cy.closeFeedbackModalIfVisible()

  cy.wait(2500)
  waitForInitialPaginatedList('**/service/serviceSpecification?*', () => {
    cy.contains('button', 'Validated').click()
  })
  clickLoadMoreUntilGone(10, '[data-cy="servSpecRow"]')
  cy.getBySel('servSpecTable').contains(name).parents('[data-cy="servSpecRow"]').should('contain.text', 'Validated')
}

/**
 * Create a DSP-compatible product specification
 * Enables the DSP toggle and fills the dsp_config step
 * Steps: General → Compliance → Characteristics → DSP Config → Resource → Service → Attachments → Relationships → Summary
 */
export function createDspProductSpec({ name, version = '0.1', brand, productNumber, dspConfig }: DspProductSpecParams): void {
  cy.visit('/my-offerings')
  cy.getBySel('prdSpecSection').click()
  cy.getBySel('createProdSpec').click()

  // General info
  cy.getBySel('prodSpecName').should('be.visible').type(name)
  cy.get('#prod-image-upload').selectFile({
    contents: Cypress.Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/Pu98WQAAAABJRU5ErkJggg==', 'base64'),
    fileName: 'e2e-dsp-product.png',
    mimeType: 'image/png'
  }, { force: true })
  cy.getBySel('prodSpecDspCompatible').check({ force: true })
  cy.getBySel('prodSpecNext').should('be.enabled').click()

  // Product details
  cy.getBySel('prodSpecDescription').find('textarea').type(`${brand} ${productNumber}`)
  cy.getBySel('prodSpecHowItWorks').find('textarea').type(`DSP product specification ${version}`)

  // Dataspace configuration
  cy.contains('span', 'Dataspace configuration').click({ force: true })
  cy.get('input[placeholder="Endpoint name"]').should('be.visible').type(dspConfig.endpoint.name)
  cy.get('input[placeholder="https://example.com/endpoint"]').type(dspConfig.endpoint.url)
  cy.get('input[placeholder="Describe this endpoint"]').type(dspConfig.endpoint.description)
  cy.contains('button', 'Add endpoint').click()
  cy.get('[formcontrolname="upstreamAddress"]').type(dspConfig.upstreamAddress)
  cy.contains('label', 'Target specification').parent().find('textarea')
    .type(dspConfig.targetSpecification, { parseSpecialCharSequences: false })
  cy.contains('label', 'Service configuration').parent().find('textarea')
    .type(dspConfig.serviceConfiguration, { parseSpecialCharSequences: false })
  cy.contains('label', 'Credentials config').parent().find('textarea')
    .type(dspConfig.credentialsConfig, { parseSpecialCharSequences: false })
  cy.contains('label', 'Policy config').parent().find('textarea')
    .type(dspConfig.policyConfig, { parseSpecialCharSequences: false })

  cy.contains('span', 'Compliance profile').click({ force: true })
  cy.getBySel('prodSpecFinish').should('be.enabled').click()
  cy.contains('button', 'Save as draft').should('be.enabled').click()
  cy.closeFeedbackModalIfVisible()

  cy.getBySel('prodSpecTable').should('be.visible')
  cy.getBySel('prodSpecTable').contains(name).should('be.visible')
}

/**
 * Update a DSP product spec status.
 * In the update component, dsp_config is inserted AFTER 'service' (not after 'characteristics' as in create).
 * The step appears automatically when prod.externalId is set (no need to toggle dsp-compatible again).
 */
export function updateDspProductSpecStatus({ name, status }: UpdateProductSpecStatusParams): void {
  updateProductSpecStatus({ name, status })
}

/**
 * Create a DSP-compatible offering with contract definition
 * The contract-definition step is automatically inserted after terms and conditions
 * when the selected product spec is DSP compatible.
 * Steps: General → Category → Terms → Contract Definition → Price → Procurement → Summary
 */
export function createDspOffering({
  name,
  description,
  productSpecName,
  catalogName,
  detailedDescription,
  procurement,
  pricePlan,
  priceComponent,
  contractDefinition
}: DspOfferingParams): void {
  cy.intercept('GET', '**/paymentInfo').as('getPaymentInfo')
  cy.visit('/my-offerings')
  cy.getBySel('offerSection').click()
  cy.getBySel('newOffering').click()

  // Step 1: General information
  cy.getBySel('offerName').should('be.visible').type(name)
  cy.get('#prodSpecSelect').should('be.visible').select(productSpecName)
  cy.getBySel('offerCatalogSelect').should('be.visible').select(catalogName)
  cy.get('body').then(($body) => {
    if ($body.find('#generalInfoCategoryFilter').length > 0) {
      selectFirstAvailableOption('#generalInfoCategoryFilter')
    }
  })
  cy.getBySel('offerOverview').type(description)
  cy.getBySel('offerNext').click()

  // Step 2: Category
  selectFirstAvailableOption('#rootCategorySelect')
  cy.getBySel('offerNext').click()

  // Step 3: Terms and conditions
  cy.getBySel('tcText').find('textarea').type(detailedDescription)
  cy.getBySel('offerNext').click()

  // Step 4: Contract definition
  cy.get('app-edc-contract-definition-form input[type="checkbox"]').check({ force: true })
  cy.getBySel('dspAccessPolicy').should('be.visible').type(contractDefinition.accessPolicy, { parseSpecialCharSequences: false })
  cy.getBySel('dspContractPolicy').should('be.visible').type(contractDefinition.contractPolicy, { parseSpecialCharSequences: false })
  cy.getBySel('offerNext').click()

  // Step 5: Price plans
  if (pricePlan) {
    cy.contains('button', 'Online paid price').click()
    cy.getBySel('addPricePlan').first().click()
    cy.contains('button', 'Flex plan').click()
    cy.getBySel('selectPlanTypeContinue').should('be.enabled').click()
    cy.getBySel('paidName').type(pricePlan.name)
    cy.getBySel('paidDescription').find('textarea').type(pricePlan.description || 'DSP price plan')

    if (priceComponent) {
      cy.getBySel('addPriceComponent').click()
      cy.getBySel('pcName').type(priceComponent.name)
      cy.getBySel('pcDescription').type(priceComponent.description)
      cy.getBySel('pcBasePrice').type(String(priceComponent.price))
      cy.getBySel('pcPriceType').click()
      cy.getBySel(`pcPriceType-${priceComponent.type}`).click()
      cy.getBySel('pcSave').should('be.enabled').click()
    }
    cy.getBySel('ppSave').should('be.enabled').click()
  } else {
    cy.contains('button', 'Free').click()
  }
  cy.getBySel('offerNext').click()

  // Step 6: Procurement
  selectProcurementMode(procurement)

  // Step 7: Summary
  waitForInitialPaginatedList('**/catalog/productOffering?*', () => {
    cy.getBySel('offerFinish').should('be.enabled').click()
  })

  cy.closeFeedbackModalIfVisible()
  cy.getBySel('offers').should('be.visible')
  clickLoadMoreUntilGone(10, '[data-cy="offerRow"]')
  cy.getBySel('offers').contains(name).should('be.visible')
}

/**
 * Create a new usage specification
 */
export function createUsageSpec({ name, description, metrics = [] }: UsageSpecParams): void {
  cy.visit('/usage-spec')
  cy.getBySel('createUsageSpec').click()

  // Step 1: General info
  cy.getBySel('usageSpecName').should('be.visible').type(name)
  cy.getBySel('usageSpecDescription').should('be.visible').type(description)
  cy.getBySel('usageSpecNext').click()

  // Step 2: Metrics
  if (metrics.length > 0) {
    metrics.forEach((metric) => {
      cy.getBySel('btnNewMetric').click()

      // Fill metric info
      cy.getBySel('metricName').should('be.visible').type(metric.name)
      cy.getBySel('metricDescription').type(metric.description)

      // Save metric
      cy.getBySel('btnSaveMetric').click()
      cy.getBySel('btnNewMetric').should('be.visible')
    })
  }

  // Go to next step (Summary)
  cy.getBySel('usageSpecNext').click()

  // Step 3: Create usage spec
  cy.getBySel('btnCreateUsageSpec').should('be.enabled').click()

  // Close feedback modal if it appears
  cy.closeFeedbackModalIfVisible()

  // Verify usage spec appears in table
  cy.getBySel('usageSpecTable').should('be.visible')
  cy.getBySel('usageSpecTable').contains(name).should('be.visible')
}
