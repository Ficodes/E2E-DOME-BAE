// Helper functions for filling forms in the application

/**
 * Create a new catalog
 * @param {Object} params - Catalog parameters
 * @param {string} params.name - Catalog name
 * @param {string} params.description - Catalog description
 */
function createCatalog({ name, description }) {
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
 * @param {Object} params - Update parameters
 * @param {string} params.name - Catalog name
 * @param {string} params.status - Status to set
 */
function updateCatalogStatus({ name, status }) {
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
 * @param {Object} params - Product spec parameters
 * @param {string} params.name - Product spec name
 * @param {string} params.version - Version (default: '0.1')
 * @param {string} params.brand - Brand name
 * @param {string} params.productNumber - Product number
 */
function createProductSpec({ name, version = '0.1', brand, productNumber, serviceSpecName=null, resourceSpecName=null }) {
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
  cy.getBySel('btnFinish').click() // Finish creation, view spec summary

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
 * @param {Object} params - Update parameters
 * @param {string} params.name - Product spec name
 * @param {string} params.status - Status to set
 */
function updateProductSpecStatus({ name, status }) {
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
  cy.getBySel('btnFinish').click() // Relationships step

  cy.getBySel('productSpecUpdate').click()

  // Close feedback modal if it appears
  cy.closeFeedbackModalIfVisible()
}

/**
 * Create a new offering
 * @param {Object} params - Offering parameters
 * @param {string} params.name - Offering name
 * @param {string} params.version - Version (default: '0.1')
 * @param {string} params.description - Short description
 * @param {string} params.productSpecName - Product spec to link
 * @param {string} params.catalogName - Catalog to link
 * @param {string} params.detailedDescription - Detailed description
 * @param {string} params.mode - payment mode [free, tailored or paid]
 * @param {Object} params.pricePlan - {name, description}
 * @param {Object} params.priceComponent - {name, description, price, type[one time, recurring, recurring-prepaid, usage], recurringPeriod?, usageInput?}
 * @param {Object} params.procurement - manual, payment-automatic, automatic
 */
function createOffering({
  name,
  version = '0.1',
  description,
  productSpecName,
  catalogName,
  detailedDescription,
  mode,
  pricePlan,
  priceComponent,
  procurement
}) {
  cy.visit('/my-offerings')
  cy.getBySel('offerSection').click()
  cy.getBySel('newOffering').click()

  // Step 1: Basic Information
  cy.getBySel('offerName').should('be.visible').type(name)
  cy.getBySel('offerVersion').should('have.value', version)
  cy.getBySel('textArea').type(description)
  cy.getBySel('offerNext').click()

  // Step 2: Select the Product Specification
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
      cy.getBySel('textArea').type(pricePlan.description)
      cy.getBySel('savePricePlan').should('have.attr', 'disabled')
      if(priceComponent){
          cy.getBySel('newPriceComponent').click()
          cy.getBySel('priceComponentName').type(priceComponent.name)
          cy.getBySel('priceComponentDescription').find('[data-cy="textArea"]').type(priceComponent.description)
          cy.getBySel('price').type(String(priceComponent.price))
          cy.getBySel('priceType').select(priceComponent.type)
          if (priceComponent.recurringPeriod){
              cy.getBySel('recurringType').select(priceComponent.recurringPeriod)
          }
          else if (priceComponent.usageInput){
              cy.wait('@usageGET')
              cy.getBySel('usageInput').select(priceComponent.usageInput[0])
              cy.getBySel('usageMetric').select(priceComponent.usageInput[1])
          }
          cy.getBySel('savePriceComponent').click()
      }
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
 * @param {Object} params - Update parameters
 * @param {string} params.name - Offering name
 * @param {string} params.status - Status to set
 */
function updateOffering({ name, status }) {
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
 * @param {number} maxClicks - Maximum number of times to click (default: 10)
 */
function clickLoadMoreUntilGone(maxClicks = 10) {
  cy.wait(3000)

  const clickIfExists = (remainingClicks) => {
    if (remainingClicks === 0) return

    cy.get('body').then(() => {
      if (cy.$$("button[data-cy=loadMore]").length > 0) {
        cy.getBySel('loadMore').click()
        cy.wait(2000)
        clickIfExists(remainingClicks - 1)
      }
    })
  }

  clickIfExists(maxClicks)
}

/**
 * Create checkout billing information
 * @param {Object} params - Billing parameters
 * @param {string} params.title - Title
 * @param {string} params.country - Country
 * @param {string} params.city - City
 * @param {string} params.state - State
 * @param {string} params.zip - Zip code
 * @param {string} params.street - Street address
 * @param {string} params.email - Email address
 * @param {string} params.phoneNumber - Phone number
 */
function createCheckoutBilling({title, country, city, state, zip, street, email, phoneNumber}){
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
 * @param {Object} params - Service spec parameters
 * @param {string} params.name - Service spec name
 * @param {string} params.description - Service spec description
 * @param {Array} params.characteristics - Array of characteristic objects (optional)
 * @param {string} params.characteristics[].name - Characteristic name
 * @param {string} params.characteristics[].description - Characteristic description
 * @param {string} params.characteristics[].type - Type: 'string', 'number', or 'range'
 * @param {Array|Object} params.characteristics[].values - Values based on type:
 *   - For 'string': Array of strings ['value1', 'value2']
 *   - For 'number': Array of objects [{value: 10, unit: 'GB'}]
 *   - For 'range': Object {from: 1, to: 100, unit: 'GB'}
 */
function createServiceSpec({ name, description, characteristics = [] }) {
  cy.visit('/my-offerings')
  cy.getBySel('servSpecSection').click()
  cy.getBySel('createServSpec').click()

  // Step 1: General info
  cy.getBySel('servSpecName').should('be.visible').type(name)
  cy.getBySel('servSpecDescription').should('be.visible').type(description)
  cy.getBySel('servSpecNextGeneral').click()

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
        char.values.forEach((value) => {
          cy.getBySel('servSpecCharValueString').clear().type(value)
          cy.getBySel('servSpecAddCharValue').click()
        })
      } else if (char.type === 'number') {
        char.values.forEach((valueObj) => {
          cy.getBySel('servSpecCharValueNumber').clear().type(String(valueObj.value))
          cy.getBySel('servSpecCharValueUnit').clear().type(valueObj.unit)
          cy.getBySel('servSpecAddCharValue').click()
        })
      } else if (char.type === 'range') {
        cy.getBySel('servSpecCharValueFrom').clear().type(String(char.values.from))
        cy.getBySel('servSpecCharValueTo').clear().type(String(char.values.to))
        cy.getBySel('servSpecCharValueUnit').clear().type(char.values.unit)
        cy.getBySel('servSpecAddCharValue').click()
      }

      // Save characteristic
      cy.getBySel('servSpecSaveChar').click()
      cy.wait(1000)
    })
  }

  // Go to next step
  cy.getBySel('servSpecNextChars').click()

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
 * @param {Object} params - Resource spec parameters
 * @param {string} params.name - Resource spec name
 * @param {string} params.description - Resource spec description
 * @param {Array} params.characteristics - Array of characteristic objects (optional)
 * @param {string} params.characteristics[].name - Characteristic name
 * @param {string} params.characteristics[].description - Characteristic description
 * @param {string} params.characteristics[].type - Type: 'string', 'number', or 'range'
 * @param {Array|Object} params.characteristics[].values - Values based on type:
 *   - For 'string': Array of strings ['value1', 'value2']
 *   - For 'number': Array of objects [{value: 10, unit: 'GB'}]
 *   - For 'range': Object {from: 1, to: 100, unit: 'GB'}
 */
function createResourceSpec({ name, description, characteristics = [] }) {
  cy.visit('/my-offerings')
  cy.getBySel('resSpecSection').click()
  cy.getBySel('createResSpec').click()

  // Step 1: General info
  cy.getBySel('resSpecName').should('be.visible').type(name)
  cy.getBySel('resSpecDescription').should('be.visible').type(description)
  cy.getBySel('resSpecNextGeneral').click()

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
        char.values.forEach((value) => {
          cy.getBySel('resSpecCharValueString').clear().type(value)
          cy.getBySel('resSpecAddCharValue').click()
        })
      } else if (char.type === 'number') {
        char.values.forEach((valueObj) => {
          cy.getBySel('resSpecCharValueNumber').clear().type(String(valueObj.value))
          cy.getBySel('resSpecCharValueUnit').clear().type(valueObj.unit)
          cy.getBySel('resSpecAddCharValue').click()
        })
      } else if (char.type === 'range') {
        cy.getBySel('resSpecCharValueFrom').clear().type(String(char.values.from))
        cy.getBySel('resSpecCharValueTo').clear().type(String(char.values.to))
        cy.getBySel('resSpecCharValueUnit').clear().type(char.values.unit)
        cy.getBySel('resSpecAddCharValue').click()
      }

      // Save characteristic
      cy.getBySel('resSpecSaveChar').click()
      cy.wait(1000)
    })
  }

  // Go to next step
  cy.getBySel('resSpecNextChars').click()

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
 * @param {Object} params - Update parameters
 * @param {string} params.name - Resource spec name
 * @param {string} params.status - Status to set
 */
function updateResourceSpecStatus({ name, status }) {
  cy.getBySel('resSpecTable').contains(name).parents('[data-cy="resSpecRow"]').find('[data-cy="resourceSpecEdit"]').click()

  if (status === 'launched') {
    cy.getBySel('resourceSpecStatusLaunched').click()
  }

  // Navigate through steps to reach update button
  cy.getBySel('resSpecUpdateNextGeneral').click() // Go to Characteristics step
  cy.getBySel('resSpecUpdateNextChars').click() // Go to Summary step

  cy.getBySel('resourceSpecUpdate').click()

  // Close feedback modal if it appears
  cy.closeFeedbackModalIfVisible()
}

/**
 * Update service spec status
 * @param {Object} params - Update parameters
 * @param {string} params.name - Service spec name
 * @param {string} params.status - Status to set
 */
function updateServiceSpecStatus({ name, status }) {
  cy.getBySel('servSpecTable').contains(name).parents('[data-cy="servSpecRow"]').find('[data-cy="serviceSpecEdit"]').click()

  if (status === 'launched') {
    cy.getBySel('serviceSpecStatusLaunched').click()
  }

  // Navigate through steps to reach update button
  cy.getBySel('servSpecUpdateNextGeneral').click() // Go to Characteristics step
  cy.getBySel('servSpecUpdateNextChars').click() // Go to Summary step

  cy.getBySel('serviceSpecUpdate').click()

  // Close feedback modal if it appears
  cy.closeFeedbackModalIfVisible()
}

module.exports = {
  createCatalog,
  updateCatalogStatus,
  createProductSpec,
  updateProductSpecStatus,
  createOffering,
  updateOffering,
  clickLoadMoreUntilGone,
  createCheckoutBilling,
  createServiceSpec,
  updateServiceSpecStatus,
  createResourceSpec,
  updateResourceSpecStatus
}
