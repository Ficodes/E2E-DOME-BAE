import { HAPPY_JOURNEY } from '../../support/happy-journey-constants'
import {
  createProductSpec, createOffering, updateOffering,
  clickLoadMoreUntilFound, waitForInitialPaginatedList,
} from '../../support/form-helpers'

// Run 01-happy-journey.cy.ts once first. Each attempt owns its specs/prices/offers,
// so a failed attempt can be rerun without resetting the shared environment.
describe('Product characteristics E2E', () => {
  beforeEach(() => {
    cy.loginAsAdmin()
  })

  it('enforces characteristics in the editor, buyer price simulator and cart', () => {
    const suffix = `${Date.now()}-${Cypress._.random(100000, 999999)}`
    const specName = `Characteristics Spec ${suffix}`
    const offerName = `Characteristics Offer ${suffix}`
    const planName = 'Restricted plan'
    const unrestrictedPlanName = 'Unrestricted plan'
    const openOffers = () => {
      waitForInitialPaginatedList(['**/catalog/productOffering?*', '**/catalog/productOfferingPrice/**'], () => {
        cy.visit('/my-offerings')
        cy.getBySel('offerSection').click()
      })
      clickLoadMoreUntilFound(offerName, '[data-cy="offerRow"]', 20)
    }
    const assertPrice = (response: any, amount: number) => {
      expect(response?.statusCode).to.eq(200)
      expect(response.body.orderTotalPrice).to.have.length(1)
      const total = response.body.orderTotalPrice[0]
      const price = total.price
      expect(Number(price.dutyFreeAmount.value)).to.eq(amount)
      expect(price.dutyFreeAmount.unit).to.eq('EUR')
      cy.getBySel('previewPrices').should('have.length', 1).and('be.visible')
        .find('span.font-bold').should(($amount) => {
          const period = 'recurringChargePeriod' in total ? ` / ${total.recurringChargePeriod}` : ''
          expect($amount.text().trim().replace(/\s+/g, ' '))
            .to.eq(`${Number(price.taxIncludedAmount.value).toFixed(2)} ${price.taxIncludedAmount.unit}${period}`)
        })
    }
    const assertRestrictedConfiguration = () => {
      cy.getBySel('prdSpecMetrics').should('be.visible').and('not.contain.text', 'Hidden')
      cy.contains('app-characteristic', 'Plan').find('select').should(($select) => {
        expect($select.find('option').map((_, option) => option.textContent?.trim()).get()).to.deep.equal(['Premium'])
        expect($select.find('option:selected').text().trim()).to.eq('Premium')
      })
      cy.contains('app-characteristic', 'Storage').find('select').should(($select) => {
        expect($select.find('option').map((_, option) => option.textContent?.trim()).get()).to.deep.equal(['500 GB'])
        expect($select.find('option:selected').text().trim()).to.eq('500 GB')
      })
      cy.contains('app-characteristic', 'Users').find('input[type="range"]')
        .should('have.attr', 'min', '3').and('have.attr', 'max', '7').and('have.value', '3')
    }
    const selectRestrictedPlan = () => {
      cy.getBySel(`pricePlan-${planName}`).click()
      assertRestrictedConfiguration()
      cy.wait('@simulateRestrictedPrice').then(({ request, response }) => {
        const item = request.body.productOrder.productOrderItem[0]
        expect(item.itemTotalPrice[0].productOfferingPrice.name).to.eq(planName)
        expect(item.product.productCharacteristic.map(({ name, value }: { name: string; value: unknown }) => ({ name, value })))
          .to.have.deep.members([{ name: 'Plan', value: 'Premium' }, { name: 'Storage', value: 500 }, { name: 'Users', value: 3 }])
        assertPrice(response, 5)
      })
    }
    const assertPlanSwitch = () => {
      cy.getBySel(`pricePlan-${unrestrictedPlanName}`).click()
      cy.contains('app-characteristic', 'Hidden').should('be.visible')
      cy.contains('app-characteristic', 'Plan').find('option:selected').should('contain.text', 'Basic')
      cy.contains('app-characteristic', 'Storage').find('option:selected').should('contain.text', '100 GB')
      cy.wait('@simulateUnrestrictedDefaults').then(({ response }) => assertPrice(response, 9))
      cy.contains('app-characteristic', 'Users').find('input[type="range"]')
        .should('have.attr', 'min', '1').and('have.attr', 'max', '10')
        .invoke('val', '10').trigger('input').trigger('change')
      cy.wait('@simulateUnrestrictedPrice').then(({ request, response }) => {
        expect(request.body.productOrder.productOrderItem[0].product.productCharacteristic
          .map(({ name, value }: any) => ({ name, value }))).to.have.deep.members([
          { name: 'Hidden', value: 'Internal' }, { name: 'Plan', value: 'Basic' },
          { name: 'Storage', value: 100 }, { name: 'Users', value: 10 },
        ])
        assertPrice(response, 9)
      })
      selectRestrictedPlan()
    }
    // Register once: repeated alias handlers can consume an earlier calculation.
    cy.intercept('POST', '**/billing/order/', request => {
      const item = request.body.productOrder.productOrderItem[0]
      const selectedPlan = item.itemTotalPrice[0].productOfferingPrice.name
      const users = item.product.productCharacteristic.find((char: any) => char.name === 'Users')?.value
      if (selectedPlan === planName) {
        request.alias = users === 7 ? 'simulateRestrictedUpdatedPrice' : 'simulateRestrictedPrice'
      } else if (selectedPlan === unrestrictedPlanName) {
        request.alias = users === 10 ? 'simulateUnrestrictedPrice' : 'simulateUnrestrictedDefaults'
      }
    })
    createProductSpec({
      name: specName, brand: 'E2E', productNumber: suffix,
      characteristics: [
        { name: 'Hidden', description: 'Unavailable option', type: 'string', values: ['Internal'] },
        { name: 'Plan', description: 'Plan level', type: 'string', values: ['Basic', 'Premium'] },
        { name: 'Storage', description: 'Capacity', type: 'number', values: [
          { value: 100, unit: 'GB' }, { value: 500, unit: 'GB' },
        ] },
        { name: 'Users', description: 'User count', type: 'range', values: { from: 1, to: 10, unit: 'users' } },
      ],
    })
    cy.intercept('PATCH', '**/catalog/productSpecification/*').as('launchSpec')
    cy.contains('[data-cy="prodSpecRow"]', specName).within(() => {
      cy.get('td').last().find('button').first().click()
      cy.contains('button', 'Validate').click()
    })
    cy.wait('@launchSpec').then(({ request, response }) => {
      expect(request.body.lifecycleStatus).to.eq('Launched')
      expect(response?.statusCode).to.be.oneOf([200, 204])
    })
    cy.closeFeedbackModalIfVisible()
    createOffering({
      name: offerName, description: 'Characteristic constraints E2E',
      detailedDescription: 'Terms for characteristic constraints E2E',
      productSpecName: specName, catalogName: HAPPY_JOURNEY.catalog.name,
      mode: 'paid', procurement: 'automatic',
      pricePlan: { name: planName, forbiddenCharacteristics: ['Hidden'] },
      priceComponent: {
        name: 'Premium fee', description: 'Premium option fee', price: 5, type: 'one time',
        charLink: { characteristicName: 'Plan', value: 'Premium' },
      },
    })

    const editPlan = () => {
      cy.contains('[data-cy="offerRow"]', offerName).within(() => {
        cy.getBySel('offerActions').find('button').first().click()
        cy.getBySel('offerEdit').click()
      })
      cy.contains('span', 'Price plans').click()
      cy.contains('td', planName).parents('tr').find('button').first().click()
      cy.getBySel('editPricePlan').click()
      cy.getBySel('choosePricePlanCharacteristics').click()
    }
    editPlan()
    cy.getBySel('pricePlanCharacteristicsModal').within(() => {
      cy.getBySel('pricePlanCharacteristicToggle-1').should('be.disabled')
      cy.getBySel('pricePlanCharacteristicValue-1-1').should('be.checked').and('be.disabled')
      cy.getBySel('pricePlanCharacteristicValue-1-0').uncheck()
      cy.getBySel('pricePlanCharacteristicValue-2-0').uncheck()
      cy.getBySel('pricePlanCharacteristicValue-2-1').uncheck()
      cy.getBySel('savePricePlanCharacteristics').should('be.disabled')
      cy.getBySel('pricePlanCharacteristicValue-2-1').check()
      cy.getBySel('pricePlanCharacteristicRangeFrom-3').invoke('val', '8').trigger('input')
      cy.getBySel('pricePlanCharacteristicRangeTo-3').invoke('val', '7').trigger('input')
      cy.getBySel('savePricePlanCharacteristics').should('be.disabled')
      cy.getBySel('pricePlanCharacteristicRangeFrom-3').invoke('val', '0').trigger('input')
      cy.getBySel('savePricePlanCharacteristics').should('be.disabled')
      cy.getBySel('pricePlanCharacteristicRangeFrom-3').invoke('val', '3').trigger('input')
      cy.getBySel('pricePlanCharacteristicRangeTo-3').invoke('val', '11').trigger('input')
      cy.getBySel('savePricePlanCharacteristics').should('be.disabled')
      cy.getBySel('pricePlanCharacteristicRangeTo-3').invoke('val', '7').trigger('input')
      cy.getBySel('pricePlanCharacteristicToggle-0').should('have.attr', 'aria-checked', 'false')
      cy.getBySel('savePricePlanCharacteristics').should('be.enabled').click()
    })
    // Editing an existing component must use the restricted characteristic values too.
    cy.contains('td', 'Premium fee').parents('tr').within(() => cy.get('button').click())
    cy.contains('button', 'Edit').click()
    cy.getBySel('pcConfigOption').find('option').should(($options) => {
      expect([...$options].map(option => option.textContent?.trim())).not.to.include('Hidden')
    })
    cy.getBySel('pcConfigValue').find('option').should(($options) => {
      const labels = [...$options].map(option => option.textContent?.trim())
      expect(labels).to.include('Premium')
      expect(labels).not.to.include('Basic')
    })
    cy.getBySel('pcSave').should('be.enabled').click()
    // Tier limits follow the allowed range, and an in-use tier cannot be excluded.
    cy.getBySel('addPriceComponent').click()
    cy.getBySel('pcConfigOption').select('Users')
    cy.getBySel('pcAddTier').click()
    for (const selector of ['tierMin', 'tierMax', 'tierSliderMin', 'tierSliderMax']) {
      cy.getBySel(selector).should('have.attr', 'min', '3').and('have.attr', 'max', '7')
    }
    cy.getBySel('tierName').type('Users tier')
    cy.getBySel('tierDescription').type('Restricted user range')
    cy.getBySel('tierPrice').type('5')
    cy.getBySel('tierPriceType').select('one time')
    cy.getBySel('tierMin').invoke('val', '2').trigger('input')
    cy.getBySel('pcSaveTier').should('be.disabled')
    cy.getBySel('tierMin').invoke('val', '3').trigger('input')
    cy.getBySel('tierMax').invoke('val', '8').trigger('input')
    cy.getBySel('pcSaveTier').should('be.disabled')
    cy.getBySel('tierMax').invoke('val', '7').trigger('input')
    cy.getBySel('pcSaveTier').should('be.enabled').click()
    cy.getBySel('pcSave').should('be.enabled').click()
    cy.getBySel('choosePricePlanCharacteristics').click()
    cy.getBySel('pricePlanCharacteristicToggle-3').should('be.disabled')
    cy.getBySel('pricePlanCharacteristicRangeFrom-3').invoke('val', '4').trigger('input')
    cy.getBySel('savePricePlanCharacteristics').should('be.disabled')
    cy.getBySel('pricePlanCharacteristicRangeFrom-3').invoke('val', '3').trigger('input')
    cy.getBySel('pricePlanCharacteristicRangeTo-3').invoke('val', '6').trigger('input')
    cy.getBySel('savePricePlanCharacteristics').should('be.disabled')
    cy.getBySel('pricePlanCharacteristicRangeTo-3').invoke('val', '7').trigger('input')
    cy.getBySel('savePricePlanCharacteristics').should('be.enabled').click()
    cy.contains('td', /^Users$/).parents('tr').find('button').first().click()
    cy.contains('button', 'Delete').click()
    cy.getBySel('ppSave').should('be.enabled').click()

    // Configuration profiles and characteristic constraints are mutually exclusive in both directions.
    cy.getBySel('addPricePlan').first().click()
    cy.contains('button', 'Standard plan').click()
    cy.getBySel('selectPlanTypeContinue').click()
    cy.getBySel('choosePricePlanCharacteristics').should('be.enabled')
    cy.getBySel('setConfigProfile').should('be.enabled')
    cy.getBySel('choosePricePlanCharacteristics').click()
    cy.getBySel('pricePlanCharacteristicToggle-0').click()
    cy.getBySel('savePricePlanCharacteristics').click()
    cy.getBySel('setConfigProfile').should('be.disabled')
      .and('have.attr', 'aria-describedby', 'profileConstraintsHint')
    cy.get('#profileConstraintsHint').should('be.visible')
      .and('contain.text', 'Remove the characteristic restrictions before setting a configuration profile.')
    cy.getBySel('configProfileSave').should('not.exist')

    cy.getBySel('removePricePlanConstraints').click()
    cy.getBySel('setConfigProfile').should('be.enabled').click()
    cy.getBySel('configProfileSave').should('be.enabled').click()
    cy.getBySel('editConfigProfile').should('be.enabled')
    cy.contains('tr', 'Hidden').should('contain.text', 'Internal')
    cy.contains('tr', 'Plan').should('contain.text', 'Basic')
    cy.contains('tr', 'Storage').should('contain.text', '100')
    cy.contains('tr', 'Users').should('contain.text', '1')
    cy.getBySel('choosePricePlanCharacteristics').should('be.disabled')
      .and('have.attr', 'aria-describedby', 'constraintsProfileHint')
    cy.get('#constraintsProfileHint').should('be.visible')
      .and('contain.text', 'Characteristic restrictions cannot be combined with a configuration profile.')
    cy.getBySel('pricePlanCharacteristicsModal').should('not.exist')
    // Discard this local plan: its purpose is to exercise the editor state without changing the offer under test.
    cy.contains('button', 'Add price plan').click()

    cy.getBySel('addPricePlan').first().click()
    cy.contains('button', 'Flex plan').click()
    cy.getBySel('selectPlanTypeContinue').click()
    cy.getBySel('paidName').type(unrestrictedPlanName)
    cy.getBySel('paidDescription').find('textarea').type('All source values are available')
    cy.getBySel('addPriceComponent').click()
    cy.getBySel('pcName').type('Unrestricted base fee')
    cy.getBySel('pcDescription').type('Flat fee for the unrestricted plan')
    cy.getBySel('pcBasePrice').type('9')
    cy.getBySel('pcPriceType').click()
    cy.getBySel('pcPriceType-one time').click()
    cy.getBySel('pcSave').should('be.enabled').click()
    cy.getBySel('ppSave').should('be.enabled').click()
    cy.intercept('PATCH', '**/catalog/productOfferingPrice/*').as('saveConstraint')
    cy.intercept('PATCH', '**/catalog/productOffering/*').as('saveOffer')
    cy.contains('span', 'Procurement mode').click()
    cy.getBySel('offerFinish').should('be.enabled').click()
    cy.wait('@saveOffer').its('response.statusCode').should('be.oneOf', [200, 204])
    cy.get('@saveConstraint.all').then((calls: any) => {
      const constraint = calls.find((call: any) => call.request.body.priceType === 'constraint')
      expect(constraint, 'constraint persisted through the proxy').to.exist
      expect(constraint.response.statusCode).to.be.oneOf([200, 204])
      cy.request({
        url: constraint.request.url, log: false,
        headers: Cypress._.pick(constraint.request.headers, ['authorization', 'x-organization']),
      }).then(({ body }) => {
        const uses = body.prodSpecCharValueUse
        expect(uses.map((use: any) => use.name)).to.have.members(['Plan', 'Storage', 'Users', 'Hidden'])
        expect(uses.find((use: any) => use.name === 'Plan').productSpecCharacteristicValue
          .map((value: any) => value.value)).to.deep.equal(['Basic'])
        expect(uses.find((use: any) => use.name === 'Storage').productSpecCharacteristicValue
          .map((value: any) => ({ value: value.value, unit: value.unitOfMeasure })))
          .to.deep.equal([{ value: 100, unit: 'GB' }])
        expect(uses.find((use: any) => use.name === 'Hidden').productSpecCharacteristicValue || []).to.be.empty
        expect(uses.find((use: any) => use.name === 'Users').productSpecCharacteristicValue
          .map((value: any) => [value.valueFrom, value.valueTo])).to.deep.equal([[1, 2], [8, 10]])
      })
    })
    cy.closeFeedbackModalIfVisible()
    // Reopen from a fresh page to check persistence rather than local form state.
    openOffers()
    editPlan()
    cy.getBySel('pricePlanCharacteristicValue-1-0').should('not.be.checked')
    cy.getBySel('pricePlanCharacteristicValue-2-0').should('not.be.checked')
    cy.getBySel('pricePlanCharacteristicRangeFrom-3').should('have.value', '3')
    cy.getBySel('pricePlanCharacteristicRangeTo-3').should('have.value', '7')
    cy.getBySel('savePricePlanCharacteristics').click()
    cy.getBySel('ppSave').click()
    openOffers()
    updateOffering({ name: offerName, status: 'launched' })
    cy.changeSessionTo('BUYER ORG')
    waitForInitialPaginatedList('**/catalog/productOffering?*', () => cy.visit('/search'))
    clickLoadMoreUntilFound(offerName, '[data-cy="baeCard"]')
    cy.openAddToCartDrawerFromSearch(offerName)
    cy.contains('[data-cy="toCartDrawer"]', `Adding ${offerName} to cart`).within(() => {
      selectRestrictedPlan()
      assertPlanSwitch()
      cy.contains('app-characteristic', 'Users').find('input[type="range"]')
        .should('be.enabled').invoke('val', '7').trigger('input').trigger('change')
      cy.wait('@simulateRestrictedUpdatedPrice', { requestTimeout: 10000 }).then(({ request, response }) => {
        expect(request.body.productOrder.productOrderItem[0].product.productCharacteristic
          .map(({ name, value }: any) => ({ name, value })))
          .to.have.deep.members([{ name: 'Plan', value: 'Premium' }, { name: 'Storage', value: 500 }, { name: 'Users', value: 7 }])
        assertPrice(response, 5)
      })
      cy.intercept('POST', '**/shoppingCart/item/').as('addCharacteristicsToCart')
      cy.getBySel('acceptTermsCheckbox').check()
      cy.getBySel('addToCart').should('be.enabled').click()
    })
    cy.wait('@addCharacteristicsToCart').then(({ request, response }) => {
      expect(response?.statusCode).to.eq(201)
      const item = request.body
      expect(item.name).to.eq(offerName)
      expect(item.termsAccepted).to.eq(true)
      expect(item.options.characteristics.map(({ name, value }: any) => ({ name, value })))
        .to.have.deep.members([{ name: 'Plan', value: 'Premium' }, { name: 'Storage', value: 500 }, { name: 'Users', value: 7 }])
      expect(item.options.pricing).to.have.length(1)
      expect(Number(item.options.pricing[0].price.dutyFreeAmount.value)).to.eq(5)
      const url = `${request.url.replace(/\/$/, '')}/${encodeURIComponent(item.id)}`
      const headers = Cypress._.pick(request.headers, ['authorization', 'x-organization'])
      cy.request({ url, headers, log: false, failOnStatusCode: false }).then(({ status, body }) => {
        expect(status).to.eq(200)
        expect(body.name).to.eq(offerName)
        expect(body.options).to.deep.equal(item.options)
      })
      cy.request({ method: 'DELETE', url, headers, log: false, failOnStatusCode: false }).its('status').should('eq', 204)
    })
  })

  it('removes references from prices only for Active specs and rejects duplicate characteristic IDs', () => {
    const suffix = `${Date.now()}-${Cypress._.random(100000, 999999)}`
    cy.intercept('POST', '**/catalog/productSpecification').as('createSpec')
    createProductSpec({
      name: `Characteristic removal ${suffix}`, brand: 'E2E', productNumber: suffix,
      characteristics: ['Removed', 'Retained'].map(name => ({
        name, description: name, type: 'string', values: ['Basic', 'Premium'],
      })),
    })
    cy.wait('@createSpec').then(({ request, response }) => {
      expect(response?.statusCode).to.eq(201)
      const spec = response!.body
      const catalogUrl = request.url.replace(/\/productSpecification\/?$/, '')
      const specUrl = `${catalogUrl}/productSpecification/${encodeURIComponent(spec.id)}`
      const priceUrl = `${catalogUrl}/productOfferingPrice`
      const apiRequest = (method: string, url: string, body?: object, failOnStatusCode = true) => cy.request({
        method, url, body, failOnStatusCode: false, log: false,
        headers: Cypress._.pick(request.headers, ['authorization', 'x-organization']),
      }).then(response => {
        if (failOnStatusCode) {
          expect(response.status, `${method} ${url}: ${JSON.stringify(response.body)}`).to.be.within(200, 299)
        }
        return response
      })
      const [removed, retained] = spec.productSpecCharacteristic
      expect(removed.id).to.be.a('string').and.not.be.empty
      expect(retained.id).to.be.a('string').and.not.eq(removed.id)
      const valueUse = (char: any, value: string) => ({
        id: char.id, name: char.name,
        productSpecCharacteristicValue: [{ value, valueType: 'string' }],
      })
      const postPrice = (body: any) => apiRequest('POST', priceUrl, {
        lifecycleStatus: 'Active', isBundle: false, ...body,
      }).then(response => {
        expect(response.status).to.eq(201)
        return response.body
      })
      postPrice({
        name: `Component ${suffix}`, priceType: 'one time', price: { value: 5, unit: 'EUR' },
        prodSpecCharValueUse: [valueUse(removed, 'Basic'), valueUse(retained, 'Basic')],
      }).then(component => {
        postPrice({
          name: `Constraint ${suffix}`, priceType: 'constraint',
          prodSpecCharValueUse: [valueUse(removed, 'Premium'), valueUse(retained, 'Premium')],
        }).then(constraint => {
          postPrice({
            name: `Plan ${suffix}`, isBundle: true,
            bundledPopRelationship: [{ id: component.id, href: component.href }],
            popRelationship: [{ id: constraint.id, href: constraint.href, relationshipType: 'constraint' }],
          }).then(plan => {
            const profileValueUses = [valueUse(retained, 'Basic')]
            const constraintRelationship = [{
              id: constraint.id, href: constraint.href, relationshipType: 'constraint',
            }]
            const invalidCombinationMessage = 'A price plan with prodSpecCharValueUse cannot reference a constraint'
            postPrice({
              name: `Profile plan ${suffix}`, isBundle: true,
              bundledPopRelationship: [{ id: component.id, href: component.href }],
              prodSpecCharValueUse: profileValueUses,
            }).then(profilePlan => {
              // The proxy must reject either way of creating the forbidden combination and preserve both plans.
              apiRequest('PATCH', `${priceUrl}/${encodeURIComponent(profilePlan.id)}`, {
                popRelationship: constraintRelationship,
              }, false).then(({ status, body }) => {
                expect(status).to.eq(422)
                expect(JSON.stringify(body)).to.include(invalidCombinationMessage)
              })
              apiRequest('GET', `${priceUrl}/${encodeURIComponent(profilePlan.id)}`).then(({ body }) => {
                expect(body.prodSpecCharValueUse).to.deep.equal(profileValueUses)
                expect(body.popRelationship || []).to.deep.equal([])
              })
              apiRequest('PATCH', `${priceUrl}/${encodeURIComponent(plan.id)}`, {
                prodSpecCharValueUse: profileValueUses,
              }, false).then(({ status, body }) => {
                expect(status).to.eq(422)
                expect(JSON.stringify(body)).to.include(invalidCombinationMessage)
              })
              apiRequest('GET', `${priceUrl}/${encodeURIComponent(plan.id)}`).then(({ body }) => {
                expect(body.prodSpecCharValueUse || []).to.deep.equal([])
                expect(body.popRelationship).to.have.length(1)
                expect(body.popRelationship[0]).to.deep.include(constraintRelationship[0])
              })
            })
            apiRequest('GET', `${catalogUrl}/catalog?name=${encodeURIComponent(HAPPY_JOURNEY.catalog.name)}`).then(({ body }) => {
              const catalog = body.find((item: any) => item.name === HAPPY_JOURNEY.catalog.name)
              expect(catalog, 'run the happy journey first').to.exist
              apiRequest('POST', `${catalogUrl}/catalog/${encodeURIComponent(catalog.id)}/productOffering`, {
                name: `Removal offer ${suffix}`, description: 'Characteristic reference cleanup',
                lifecycleStatus: 'Active', isBundle: false, version: '1.0',
                productSpecification: { id: spec.id, href: spec.href },
                productOfferingPrice: [{ id: plan.id, href: plan.href }],
                productOfferingTerm: [{ name: 'License', description: 'E2E terms' }, { name: 'procurement', description: 'automatic' }],
              }).its('status').should('eq', 201)
              apiRequest('PATCH', specUrl, {
                productSpecCharacteristic: [removed, { ...retained, id: removed.id }],
              }, false).its('status').should('eq', 422)
              apiRequest('GET', specUrl).its('body.productSpecCharacteristic').should('deep.equal', spec.productSpecCharacteristic)
              apiRequest('PATCH', specUrl, { productSpecCharacteristic: [retained] })
                .its('status').should('be.oneOf', [200, 204])
              apiRequest('GET', specUrl).its('body.productSpecCharacteristic').should('deep.equal', [retained])
              const assertPrices = () => {
                ;[[component, 'Basic'], [constraint, 'Premium']].forEach(([price, value]) => {
                  apiRequest('GET', `${priceUrl}/${encodeURIComponent(price.id)}`).then(({ body }) => {
                    expect(body.prodSpecCharValueUse).to.deep.equal([valueUse(retained, value)])
                  })
                })
              }
              assertPrices()
              // Repeating the same removal must leave the retained references intact.
              apiRequest('PATCH', specUrl, { productSpecCharacteristic: [retained] })
                .its('status').should('be.oneOf', [200, 204])
              assertPrices()
              apiRequest('PATCH', specUrl, { lifecycleStatus: 'Launched' })
                .its('status').should('be.oneOf', [200, 204])
              apiRequest('PATCH', specUrl, { productSpecCharacteristic: [] }, false).then(({ status, body }) => {
                expect(status).to.eq(422)
                expect(JSON.stringify(body)).to.include('Product specification characteristics can only be removed from active product specifications')
              })
              apiRequest('GET', specUrl).its('body.productSpecCharacteristic').should('deep.equal', [retained])
              assertPrices()
            })
          })
        })
      })
    })
  })
})
