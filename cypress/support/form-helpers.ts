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
}

export interface PriceComponent {
  name: string
  description: string
  price: number
  type: string
  recurringPeriod?: string
  usageInput?: [string, string]
  charLink?: { characteristicName: string; value?: string }
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

  // Wait for redirect back to catalog list
  cy.wait(3000)

  // Close feedback modal if it appears
  cy.closeFeedbackModalIfVisible()

  // Verify catalog appears in table
  cy.getBySel('catalogTable').should('be.visible')
  cy.getBySel('catalogTable').contains(name).should('be.visible')
}

/**
 * Update catalog status
 */
export function updateCatalogStatus({ name, status }: UpdateCatalogStatusParams): void {
  cy.getBySel('catalogTable').contains(name).parents('[data-cy="catalogRow"]').find('[data-cy="catalogEdit"]').click()

  if (status === 'launched') {
    cy.getBySel('catalogStatusLaunched').click()
  }

  cy.getBySel('catalogNext').click()
  cy.getBySel('catalogUpdate').click()

  // Close feedback modal if it appears
  cy.closeFeedbackModalIfVisible()
}

/**
 * Create a new product specification
 */
export function createProductSpec({ name, version = '0.1', brand, productNumber, serviceSpecName = null, resourceSpecName = null, characteristics = [] }: ProductSpecParams): void {
  cy.visit('/my-offerings')
  cy.getBySel('prdSpecSection').click()
  cy.getBySel('createProdSpec').click()

  // Fill product spec form - Step 1: General info
  cy.getBySel('inputName').should('be.visible').type(name)
  cy.getBySel('inputVersion').should('have.value', version)
  cy.getBySel('inputBrand').type(brand)
  cy.getBySel('inputIdNumber').type(productNumber)

  // Navigate through all required steps
  cy.getBySel('btnNext').click() // Go to Compliance step
  cy.getBySel('btnNext').click() // Go to Characteristics step

  // Step 3: Characteristics
  if (characteristics.length > 0) {
    characteristics.forEach((char) => {
      cy.getBySel('btnNewCharacteristic').click()

      // Fill characteristic basic info (select type first to avoid form reset clearing name)
      cy.getBySel('charType').should('be.visible').select(char.type)
      cy.getBySel('charName').should('be.visible').type(char.name)
      cy.getBySel('charDescription').type(char.description)

      // Add values based on type
      if (char.type === 'string') {
        (char.values as string[]).forEach((value) => {
          cy.getBySel('charStringValue').clear().type(value)
          cy.getBySel('btnAddStringValue').click()
        })
      } else if (char.type === 'number') {
        (char.values as CharacteristicValue[]).forEach((valueObj) => {
          cy.getBySel('charNumberValue').clear().type(String(valueObj.value))
          cy.getBySel('charNumberUnit').clear().type(valueObj.unit)
          cy.getBySel('btnAddNumberValue').click()
        })
      } else if (char.type === 'range') {
        const rangeValues = char.values as RangeValue
        cy.getBySel('charRangeFrom').clear().type(String(rangeValues.from))
        cy.getBySel('charRangeTo').clear().type(String(rangeValues.to))
        cy.getBySel('charRangeUnit').clear().type(rangeValues.unit)
        cy.getBySel('btnAddRangeValue').click()
      }

      // Save characteristic
      cy.getBySel('btnSaveCharacteristic').click()
      cy.wait(1000)
    })
  }

  cy.getBySel('btnNext').click() // Go to Resource step
  if (resourceSpecName){
    cy.getBySel('tableResourceSpecs').contains('tr', resourceSpecName).find('[id="select-checkbox"]').click()
  }
  cy.getBySel('btnNext').click() // Go to Service step
  if (serviceSpecName){
    cy.getBySel('tableServiceSpecs').contains('tr', serviceSpecName).find('[id="select-checkbox"]').click()
  }
  cy.getBySel('btnNext').click() // Go to Attachments step
  cy.getBySel('btnNext').click() // Go to Relationships step
  cy.getBySel('btnNext').click() // Finish creation, view spec summary

  // Create product spec
  cy.getBySel('btnCreateProduct').should('be.enabled').click()

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
  cy.getBySel('prodSpecTable').contains(name).parents('[data-cy="prodSpecRow"]').find('[data-cy="productSpecEdit"]').click()

  if (status === 'launched') {
    cy.getBySel('productSpecStatusLaunched').click()
  }

  // Navigate through steps to reach update button
  cy.getBySel('btnNext').click() // Bundle step
  cy.getBySel('btnNext').click() // Compliance step
  cy.getBySel('btnNext').click() // Characteristics step
  cy.getBySel('btnNext').click() // Resource step
  cy.getBySel('btnNext').click() // Service step
  cy.getBySel('btnNext').click() // Attachments step
  cy.getBySel('btnNext').click() // Relationships step

  cy.getBySel('productSpecUpdate').click()

  // Close feedback modal if it appears
  cy.closeFeedbackModalIfVisible()
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
  cy.intercept('GET', '**/usage/usageSpecification?*').as('usageGET')
  cy.visit('/my-offerings')
  cy.getBySel('offerSection').click()
  cy.getBySel('newOffering').click()

  // Step 1: Basic Information
  cy.getBySel('offerName').should('be.visible').type(name)
  cy.getBySel('offerVersion').should('have.value', version)
  cy.getBySel('textArea').type(description)
  cy.getBySel('offerNext').click()

  // Step 2: Select the Product Specification
  clickLoadMoreUntilGone()
  cy.getBySel('prodSpecs').contains( productSpecName).click()
  cy.getBySel('offerNext').click()

  // Step 3: Select the Catalog
  cy.getBySel('catalogList').contains(catalogName).click()
  cy.getBySel('offerNext').click()

  // Step 4: Select Category
  // cy.getBySel('categoryList').should('have.length.at.least', 1)
  // cy.getBySel('categoryList').first().click()
  cy.getBySel('offerNext').click()

  // Step 5: Description
  cy.getBySel('textArea').type(detailedDescription)
  cy.getBySel('offerNext').click()

  // Step 6: Pricing (skip for basic offering)
  cy.getBySel('pricePlanType').select(mode)
  if(pricePlan){
      cy.getBySel('newPricePlan').click()
      cy.getBySel('pricePlanName').type(pricePlan.name)
      cy.getBySel('textArea').type(pricePlan.description || '')
      cy.getBySel('savePricePlan').should('have.attr', 'disabled')
      const components = priceComponents || (priceComponent ? [priceComponent] : [])
      components.forEach((pc) => {
          cy.getBySel('newPriceComponent').click()
          cy.getBySel('priceComponentName').type(pc.name)
          cy.getBySel('priceComponentDescription').find('[data-cy="textArea"]').type(pc.description)
          cy.getBySel('price').type(String(pc.price))
          if (pc.charLink) {
              cy.getBySel('selectPriceSpecChar').select(pc.charLink.characteristicName)
              if (pc.charLink.value) {
                  cy.getBySel('selectPriceSpecCharValue').select(pc.charLink.value)
              }
          }
          cy.getBySel('priceType').select(pc.type)
          if (pc.recurringPeriod){
              cy.getBySel('recurringType').select(pc.recurringPeriod)
          }
          else if (pc.usageInput){
              cy.wait('@usageGET')
              cy.getBySel('usageInput').select(pc.usageInput[0])
              cy.getBySel('usageMetric').select(pc.usageInput[1])
          }
          cy.getBySel('savePriceComponent').click()
      })
      cy.getBySel('savePricePlan').click()
  }
  cy.getBySel('offerNext').click()

  // Step 7: procurement info
  cy.getBySel('procurement').select(procurement)
  cy.getBySel('offerNext').click()

  // Step 8: Finish
  cy.getBySel('offerFinish').click()

  // Close feedback modal if it appears
  cy.closeFeedbackModalIfVisible()

  // Load all offerings
  clickLoadMoreUntilGone()

  // Verify offering was created in table
  cy.getBySel('offers').should('be.visible')
  cy.getBySel('offers').contains(name).should('be.visible')
}

/**
 * Update offering status
 */
export function updateOffering({ name, status }: UpdateOfferingParams): void {
  // Load all offerings
  clickLoadMoreUntilGone()

  cy.getBySel('offers').contains(name).parents('[data-cy="offerRow"]').within(() => {
    cy.get('button[type="button"]').first().click() // Click edit button
  })

  // Wait for edit page to load
  cy.wait(2000)

  // Change status
  if (status === 'launched') {
    cy.getBySel('offerStatusLaunched').click()
    cy.wait(1000)
  }

  // Click update button
  cy.get('button').contains('Update Offer').click()

  // Close feedback modal if it appears
  cy.closeFeedbackModalIfVisible()
}

/**
 * Click "Load More" button repeatedly until all items are loaded
 */
export function clickLoadMoreUntilGone(maxClicks = 10, offering: boolean = false): void {
  if(offering){
    cy.intercept('**/catalog/productOffering?*').as('offeringList')
  }
  cy.wait(5000)
  const clickIfExists = (remainingClicks: number, retries = 5): void => {
    if (remainingClicks === 0) return

    cy.wait(2000)
    cy.get('body').then($body => {
      const $btn = $body.find('[data-cy="loadMore"]:visible')
      if ($btn.length > 0) {
        cy.wrap($btn).click()
        if (offering) {
          cy.wait('@offeringList')
        }
        clickIfExists(remainingClicks - 1)
      } else if (retries > 0) {
        // Retry: button might still be loading
        clickIfExists(remainingClicks, retries - 1)
      }
      // No button after all retries = done
    })
  }
  clickIfExists(maxClicks)
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
      cy.getBySel('servSpecNewChar').click()

      // Fill characteristic basic info
      cy.getBySel('servSpecCharName').should('be.visible').type(char.name)
      cy.getBySel('servSpecCharType').select(char.type)
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
      cy.wait(1000)
    })
  }

  // Go to next step
  cy.getBySel('servSpecNext').click()

  // Step 3: Finish
  cy.getBySel('servSpecFinish').should('be.enabled').click()

  // Close feedback modal if it appears
  cy.closeFeedbackModalIfVisible()

  // Verify service spec appears in list
  cy.wait(2000)
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
      cy.getBySel('resSpecNewChar').click()

      // Fill characteristic basic info
      cy.getBySel('resSpecCharName').should('be.visible').type(char.name)
      cy.getBySel('resSpecCharType').select(char.type)
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
      cy.wait(1000)
    })
  }

  // Go to next step
  cy.getBySel('resSpecNext').click()

  // Step 3: Finish
  cy.getBySel('resSpecFinish').should('be.enabled').click()

  // Close feedback modal if it appears
  cy.closeFeedbackModalIfVisible()

  // Verify resource spec appears in list
  cy.wait(2000)
  cy.contains(name).should('be.visible')
}

/**
 * Update resource spec status
 */
export function updateResourceSpecStatus({ name, status }: UpdateResourceSpecStatusParams): void {
  cy.getBySel('resSpecTable').contains(name).parents('[data-cy="resSpecRow"]').find('[data-cy="resourceSpecEdit"]').click()

  if (status === 'launched') {
    cy.getBySel('resourceSpecStatusLaunched').click()
  }

  // Navigate through steps to reach update button
  cy.getBySel('resSpecUpdateNext').click() // Go to Characteristics step
  cy.getBySel('resSpecUpdateNext').click() // Go to Summary step

  cy.getBySel('resourceSpecUpdate').click()

  // Close feedback modal if it appears
  cy.closeFeedbackModalIfVisible()
}

/**
 * Update service spec status
 */
export function updateServiceSpecStatus({ name, status }: UpdateServiceSpecStatusParams): void {
  cy.getBySel('servSpecTable').contains(name).parents('[data-cy="servSpecRow"]').find('[data-cy="serviceSpecEdit"]').click()

  if (status === 'launched') {
    cy.getBySel('serviceSpecStatusLaunched').click()
  }

  // Navigate through steps to reach update button
  cy.getBySel('servSpecUpdateNext').click() // Go to Characteristics step
  cy.getBySel('servSpecUpdateNext').click() // Go to Summary step

  cy.getBySel('serviceSpecUpdate').click()

  // Close feedback modal if it appears
  cy.closeFeedbackModalIfVisible()
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
      cy.wait(1000)
    })
  }

  // Go to next step (Summary)
  cy.getBySel('usageSpecNext').click()

  // Step 3: Create usage spec
  cy.getBySel('btnCreateUsageSpec').should('be.enabled').click()

  // Close feedback modal if it appears
  cy.closeFeedbackModalIfVisible()

  // Verify usage spec appears in table
  cy.wait(2000)
  cy.getBySel('usageSpecTable').should('be.visible')
  cy.getBySel('usageSpecTable').contains(name).should('be.visible')
}
