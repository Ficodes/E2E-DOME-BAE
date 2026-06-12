import { HAPPY_JOURNEY } from '../support/happy-journey-constants'
import {
  updateOffering,
  clickLoadMoreUntilGone,
} from '../support/form-helpers'

/**
 * Test Edge Case: Billing Scheduler Period Coverage
 *
 * Verifies that the billing scheduler creates ACBRs with correct
 * period coverage (Stripe-style subscription alignment: start + period - 1 second)
 * for an offering with three price components:
 *   - 1-month recurring (10 EUR/month)
 *   - 1-week recurring  (5 EUR/week)
 *   - usage             (1 EUR/min, billed monthly)
 *
 * After each billing scheduler run, also triggers the payment scheduler
 * cron job and verifies that the resulting CustomerBill ends up 'settled'
 * once the recurring charge against the stored Stripe payment method succeeds.
 *
 * Requires BAE_CB_BILLING_HTTP_ENABLED=true in the charging container.
 */
const CHARGING_URL = 'http://localhost:8006'
const TMF_URL = 'http://localhost:8633'
const BILLING_SERVER_URL = 'http://localhost:4201'

const runPaymentScheduler = () => {
  cy.request({ url: `${CHARGING_URL}/charging/api/test/paymentScheduler`, method: 'POST' }).then((res) => {
    expect(res.status).to.eq(200)
  })
}

const expectCustomerBillState = (billId: string, expectedState: string) => {
  cy.request({
    url: `${TMF_URL}/tmf-api/customerBillManagement/v4/customerBill/${billId}`,
    method: 'GET',
  }).then((res) => {
    expect(res.status).to.eq(200)
    expect(res.body.state, `CustomerBill ${billId} state`).to.eq(expectedState)
  })
}

describe('Billing Scheduler Period Coverage', {
  viewportHeight: 1080,
  viewportWidth: 1920,
}, () => {

  beforeEach(() => {
    cy.clearBilling()
    cy.loginAsAdmin()
    cy.on('uncaught:exception', (err) => {
      console.error('Uncaught exception:', err.message)
      if (err.message.includes("Unexpected token '<'")) {
        return false
      }
    })
  })

  it('should create ACBRs with correct period coverage and price for recurring + usage components', () => {
    const catalogName = HAPPY_JOURNEY.catalog.name
    const productSpecName = HAPPY_JOURNEY.productSpec.name
    const offeringName = `Billing Scheduler Test ${Date.now()}`

    cy.intercept('POST', '**/ordering/productOrder').as('createOrder')
    cy.intercept('GET', '**/ordering/productOrder*').as('getOrders')
    cy.intercept('GET', '**/account/billingAccount*').as('getBilling')
    cy.intercept('GET', '**/shoppingCart/item/').as('cartItem')

    // ============================================
    // Verify catalog and product spec exist (from happy journey)
    // ============================================
    cy.visit('/my-offerings')
    cy.getBySel('catalogSection').click()
    cy.getBySel('catalogTable').should('be.visible')
    cy.getBySel('catalogTable').contains(catalogName).should('be.visible')

    cy.getBySel('prdSpecSection').click()
    cy.getBySel('prodSpecTable').should('be.visible')
    cy.getBySel('prodSpecTable').contains(productSpecName).should('be.visible')

    // ============================================
    // Step 1: Create Offering with 1-month recurring + 1-week recurring + usage
    // ============================================
    cy.visit('/my-offerings')
    cy.getBySel('offerSection').click()
    cy.getBySel('newOffering').click()

    cy.getBySel('offerName').should('be.visible').type(offeringName)
    cy.getBySel('textArea').type('Offering to test billing scheduler period coverage')
    cy.getBySel('offerNext').click()

    cy.getBySel('prodSpecs').contains(productSpecName).click()
    cy.getBySel('offerNext').click()

    cy.getBySel('catalogList').contains(catalogName).click()
    cy.getBySel('offerNext').click()

    cy.getBySel('offerNext').click() // Skip category

    cy.getBySel('textArea').type('Billing scheduler period coverage test')
    cy.getBySel('offerNext').click()

    // Price Plan with MONTHLY RECURRING + WEEKLY RECURRING + USAGE
    cy.intercept('GET', '**/usage/usageSpecification?*').as('usageGET')
    cy.getBySel('pricePlanType').select('paid')
    cy.getBySel('newPricePlan').click()
    cy.getBySel('pricePlanName').type('Recurring Plan')
    cy.getBySel('textArea').type('Plan with monthly, weekly recurring and usage-based components')

    // Monthly recurring: 10.00 EUR/month
    cy.getBySel('newPriceComponent').click()
    cy.getBySel('priceComponentName').type('Monthly Charge')
    cy.getBySel('priceComponentDescription').find('[data-cy="textArea"]').type('Monthly recurring charge')
    cy.getBySel('price').type('10.00')
    cy.getBySel('priceType').select('recurring')
    cy.getBySel('recurringType').select('month')
    cy.getBySel('savePriceComponent').click()

    // Weekly recurring: 5.00 EUR/week
    cy.getBySel('newPriceComponent').click()
    cy.getBySel('priceComponentName').type('Weekly Charge')
    cy.getBySel('priceComponentDescription').find('[data-cy="textArea"]').type('Weekly recurring charge')
    cy.getBySel('price').type('5.00')
    cy.getBySel('priceType').select('recurring')
    cy.getBySel('recurringType').select('week')
    cy.getBySel('savePriceComponent').click()

    // Usage: 1.00 EUR/min, billed monthly based on reported usage records
    cy.getBySel('newPriceComponent').click()
    cy.getBySel('priceComponentName').type('Usage Charge')
    cy.getBySel('priceComponentDescription').find('[data-cy="textArea"]').type('Usage-based charge per minute')
    cy.getBySel('price').type('1.00')
    cy.getBySel('priceType').select('usage')
    cy.wait('@usageGET')
    cy.getBySel('usageInput').select(HAPPY_JOURNEY.metric.name)
    cy.getBySel('usageMetric').select(HAPPY_JOURNEY.metric.metrics[0].name)
    cy.getBySel('savePriceComponent').click()

    cy.getBySel('savePricePlan').click()
    cy.getBySel('offerNext').click()

    cy.getBySel('procurement').select('automatic')
    cy.getBySel('offerNext').click()

    cy.getBySel('offerFinish').click()
    cy.closeFeedbackModalIfVisible()

    // ============================================
    // Step 2: Launch the offering
    // ============================================
    clickLoadMoreUntilGone()
    updateOffering({ name: offeringName, status: 'launched' })

    cy.getBySel('offerSection').click()
    clickLoadMoreUntilGone()
    cy.getBySel('offers').contains(offeringName).should('be.visible').parent().contains('Launched')

    // ============================================
    // Step 3: Purchase as BUYER ORG
    // ============================================
    cy.changeSessionTo('BUYER ORG')

    cy.visit('/search')
    cy.wait('@cartItem')
    clickLoadMoreUntilGone(10, true)

    cy.contains('[data-cy="baeCard"]', offeringName).within(() => {
      cy.getBySel('addToCart').first().click()
    })

    cy.contains('[data-cy="toCartDrawer"]', `Adding ${offeringName} to cart`).within(() => {
      cy.contains('Recurring Plan').click()

      // 3 price components: monthly recurring + weekly recurring + usage preview
      cy.getBySel('previewPrices').should('have.length', 3)
      cy.getBySel('previewPrices').filter(':contains("month")').should('contain.text', '12.1').and('contain.text', 'EUR')
      cy.getBySel('previewPrices').filter(':contains("week")').should('contain.text', '6.05').and('contain.text', 'EUR')

      cy.getBySel('acceptTermsCheckbox').click()
      cy.getBySel('addToCart').click()
    })

    cy.getBySel('shoppingCart').click()
    cy.getBySel('cartPurchase').click()

    cy.wait(2000)
    cy.wait('@getBilling')
    cy.wait(2000)
    cy.getBySel('checkout').should('be.visible').should('not.be.disabled').click()
    cy.wait('@createOrder')
    cy.wait('@getOrders')

    // ============================================
    // Step 4: Complete payment (activation)
    // ============================================
    cy.intercept('**/charging/api/orderManagement/orders/confirm/').as('checkin')
    cy.completePayment()
    cy.wait('@checkin')

    cy.getBySel('ordersTable').should('be.visible')
    cy.getBySel('ordersTable').find('tbody tr').first().within(() => {
      cy.contains(/completed/i)
    })

    // ============================================
    // Step 5: Get product from inventory to capture startDate
    // ============================================
    cy.visit('/product-inventory')
    clickLoadMoreUntilGone()
    cy.getBySel('productInventory').contains('[data-cy="productInventory"]', offeringName).contains('active')
    cy.contains('[data-cy="productInventory"]', offeringName).contains(offeringName).click()

    cy.url().then((url) => {
      const productId = url.split('/product-inventory/')[1]

      cy.request({
        url: `http://localhost:8633/tmf-api/productInventory/v4/product/${productId}`,
        method: 'GET',
      }).then((inventoryResponse) => {
        const startDate: string = inventoryResponse.body.startDate
        const startTime = new Date(startDate)

        cy.log(`Product startDate: ${startDate}`)

        // Expected period coverage — half-open intervals [start, end)
        // Monthly: startDate to startDate + 1 calendar month (exclusive)
        const monthlyEnd = new Date(startTime)
        monthlyEnd.setMonth(monthlyEnd.getMonth() + 1)

        // Weekly: startDate to startDate + 7 days (exclusive)
        const weeklyEnd = new Date(startTime.getTime() + 7 * 24 * 60 * 60 * 1000)

        cy.log(`Expected monthly end: ${monthlyEnd.toISOString()}`)
        cy.log(`Expected weekly end: ${weeklyEnd.toISOString()}`)

        // Billing trigger date: 35 days after activation (past both the 1-month and 1-week periods)
        const triggerDate = new Date(startTime.getTime() + 35 * 24 * 60 * 60 * 1000)
        const triggerDateStr = triggerDate.toISOString()

        // ============================================
        // Fetch usage specification ID for usage record submission
        // ============================================
        cy.request({
          url: 'http://localhost:8633/tmf-api/usageManagement/v4/usageSpecification',
          method: 'GET',
        }).then((specResponse) => {
          const usageSpecId = specResponse.body[0].id
          cy.log(`Usage spec ID: ${usageSpecId}`)

          // ============================================
          // Submit both usage records upfront so the scheduler can separate them by period
          // M1: 10 mins within month 1 → 10.00 EUR duty-free / 12.10 EUR tax-included (21% VAT)
          // M2: 15 mins within month 2 → 15.00 EUR duty-free / 18.15 EUR tax-included (21% VAT)
          // ============================================
          const usageDateM1 = new Date(startTime.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString()
          cy.request({
            url: 'http://localhost:8633/tmf-api/usageManagement/v4/usage',
            method: 'POST',
            body: {
              usageDate: usageDateM1,
              status: 'guided',
              usageSpecification: { id: usageSpecId },
              usageCharacteristic: [{ name: HAPPY_JOURNEY.metric.metrics[0].name, value: '10' }],
              ratedProductUsage: [{ productRef: { id: productId } }],
            },
          }).then((usageRes) => {
            expect(usageRes.status).to.eq(201)
            cy.log(`Usage M1 submitted: ${usageRes.body.id}`)
          })

          const usageDateM2 = new Date(monthlyEnd.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString()
          cy.request({
            url: 'http://localhost:8633/tmf-api/usageManagement/v4/usage',
            method: 'POST',
            body: {
              usageDate: usageDateM2,
              status: 'guided',
              usageSpecification: { id: usageSpecId },
              usageCharacteristic: [{ name: HAPPY_JOURNEY.metric.metrics[0].name, value: '15' }],
              ratedProductUsage: [{ productRef: { id: productId } }],
            },
          }).then((usageRes2) => {
            expect(usageRes2.status).to.eq(201)
            cy.log(`Usage M2 submitted: ${usageRes2.body.id}`)
          })

          // ============================================
          // Step 6: Set up intercept BEFORE navigating to invoices
          // ============================================
          cy.intercept('GET', '**/billing/appliedCustomerBillingRate**').as('getAcbrs')

          // ============================================
          // Step 7: Trigger billing scheduler
          // ============================================
          cy.request({
            url: 'http://localhost:8006/charging/api/test/billingScheduler',
            method: 'POST',
            body: { date: triggerDateStr },
          }).then((schedResponse) => {
            expect(schedResponse.status).to.eq(200)
            cy.log(`Billing scheduler triggered for ${triggerDateStr}: ${schedResponse.body}`)
          })

          // ============================================
          // Step 8: Navigate to invoices and open the CustomerBill
          // ============================================
          cy.visit('/product-orders')
          cy.getBySel('invoices').click()
          clickLoadMoreUntilGone()

          cy.getBySel('invoiceRow').should('have.length.greaterThan', 0).last().within(() => {
            cy.getBySel('invoiceDetails').click()
          })

          // ============================================
          // Step 9: Verify ACBR period coverage and price (3 ACBRs: monthly + weekly + usage)
          // ============================================
          cy.wait('@getAcbrs').then(({ response }) => {
            const acbrs: any[] = response!.body
            cy.log(`ACBRs: ${JSON.stringify(acbrs.map(a => ({ type: a.type, end: a.periodCoverage?.endDateTime, taxIncl: a.taxIncludedAmount?.value })))}`)

            expect(acbrs, 'Should have 3 ACBRs (monthly + weekly + usage)').to.have.length(3)

            const monthlyAcbr = acbrs.find((a) =>
              a.type === 'recurring' &&
              a.periodCoverage &&
              new Date(a.periodCoverage.endDateTime).getTime() === monthlyEnd.getTime()
            )
            const weeklyAcbr = acbrs.find((a) =>
              a.type === 'recurring' &&
              a.periodCoverage &&
              new Date(a.periodCoverage.endDateTime).getTime() === weeklyEnd.getTime()
            )
            const usageAcbr = acbrs.find((a) => a.type === 'usage')

            expect(monthlyAcbr, 'Monthly ACBR should exist').to.exist
            expect(weeklyAcbr, 'Weekly ACBR should exist').to.exist
            expect(usageAcbr, 'Usage ACBR should exist').to.exist

            // Recurring period coverage
            expect(new Date(monthlyAcbr.periodCoverage.startDateTime).getTime()).to.equal(startTime.getTime())
            expect(new Date(monthlyAcbr.periodCoverage.endDateTime).getTime()).to.equal(monthlyEnd.getTime())

            expect(new Date(weeklyAcbr.periodCoverage.startDateTime).getTime()).to.equal(startTime.getTime())
            expect(new Date(weeklyAcbr.periodCoverage.endDateTime).getTime()).to.equal(weeklyEnd.getTime())

            // Usage is billed with a monthly window (same boundaries as the monthly recurring POP)
            expect(
              new Date(usageAcbr.periodCoverage.startDateTime).getTime(),
              'Usage ACBR start = product startDate'
            ).to.equal(startTime.getTime())
            expect(
              new Date(usageAcbr.periodCoverage.endDateTime).getTime(),
              'Usage ACBR end = startDate + 1 month'
            ).to.equal(monthlyEnd.getTime())

            // Usage price: 10 units × 1.00 EUR/min = 10.00 EUR duty-free, 12.10 EUR tax-included (21% VAT)
            expect(
              parseFloat(String(usageAcbr.taxExcludedAmount.value)),
              'Usage M1 duty-free = 10.00 EUR'
            ).to.be.closeTo(10, 0.01)
            expect(
              parseFloat(String(usageAcbr.taxIncludedAmount.value)),
              'Usage M1 tax-included = 12.10 EUR'
            ).to.be.closeTo(12.1, 0.01)

            // ============================================
            // Payment scheduler: charge succeeds on the first attempt
            // ============================================
            const cbId = acbrs[0].bill.id
            runPaymentScheduler()
            expectCustomerBillState(cbId, 'settled')
          })

          // ============================================
          // Steps 10-12: Calls 2-4 — 3 weekly-only CustomerBills
          // Month 2 has not expired yet (day 35 < 2 months), usage period 2 not expired either.
          // ============================================
          const week2Start = weeklyEnd
          const week2End = new Date(startTime.getTime() + 14 * 24 * 60 * 60 * 1000)
          const week3Start = week2End
          const week3End = new Date(startTime.getTime() + 21 * 24 * 60 * 60 * 1000)
          const week4Start = week3End
          const week4End = new Date(startTime.getTime() + 28 * 24 * 60 * 60 * 1000)

          // — Week 2 —
          cy.intercept('GET', '**/billing/appliedCustomerBillingRate**').as('getWeek2Acbrs')
          cy.request({ url: 'http://localhost:8006/charging/api/test/billingScheduler', method: 'POST', body: { date: triggerDateStr } })
            .then((res) => { expect(res.status).to.eq(200) })
          cy.visit('/product-orders')
          cy.getBySel('invoices').click()
          clickLoadMoreUntilGone()
          cy.getBySel('invoiceRow').should('have.length.greaterThan', 0).last().within(() => {
            cy.getBySel('invoiceDetails').click()
          })
          cy.wait('@getWeek2Acbrs').then(({ response }) => {
            const acbrs: any[] = response!.body
            expect(acbrs, 'Week 2 CB should have 1 ACBR').to.have.length(1)
            expect(new Date(acbrs[0].periodCoverage.startDateTime).getTime()).to.equal(week2Start.getTime())
            expect(new Date(acbrs[0].periodCoverage.endDateTime).getTime()).to.equal(week2End.getTime())

            // ============================================
            // Payment scheduler: recurring charge comes back pending on the
            // first attempt, so the CB must be left untouched ('new'), then
            // settles on the next scheduler run once the charge resolves.
            // ============================================
            const cbId = acbrs[0].bill.id

            cy.request(`${BILLING_SERVER_URL}/stripe/set-recurring-status/processing`)
            runPaymentScheduler()
            expectCustomerBillState(cbId, 'new')

            runPaymentScheduler()
            expectCustomerBillState(cbId, 'settled')
          })

          // — Week 3 —
          cy.intercept('GET', '**/billing/appliedCustomerBillingRate**').as('getWeek3Acbrs')
          cy.request({ url: 'http://localhost:8006/charging/api/test/billingScheduler', method: 'POST', body: { date: triggerDateStr } })
            .then((res) => { expect(res.status).to.eq(200) })
          cy.visit('/product-orders')
          cy.getBySel('invoices').click()
          clickLoadMoreUntilGone()
          cy.getBySel('invoiceRow').should('have.length.greaterThan', 0).last().within(() => {
            cy.getBySel('invoiceDetails').click()
          })
          cy.wait('@getWeek3Acbrs').then(({ response }) => {
            const acbrs: any[] = response!.body
            expect(acbrs, 'Week 3 CB should have 1 ACBR').to.have.length(1)
            expect(new Date(acbrs[0].periodCoverage.startDateTime).getTime()).to.equal(week3Start.getTime())
            expect(new Date(acbrs[0].periodCoverage.endDateTime).getTime()).to.equal(week3End.getTime())

            const cbId = acbrs[0].bill.id
            runPaymentScheduler()
            expectCustomerBillState(cbId, 'settled')
          })

          // — Week 4 —
          cy.intercept('GET', '**/billing/appliedCustomerBillingRate**').as('getWeek4Acbrs')
          cy.request({ url: 'http://localhost:8006/charging/api/test/billingScheduler', method: 'POST', body: { date: triggerDateStr } })
            .then((res) => { expect(res.status).to.eq(200) })
          cy.visit('/product-orders')
          cy.getBySel('invoices').click()
          clickLoadMoreUntilGone()
          cy.getBySel('invoiceRow').should('have.length.greaterThan', 0).last().within(() => {
            cy.getBySel('invoiceDetails').click()
          })
          cy.wait('@getWeek4Acbrs').then(({ response }) => {
            const acbrs: any[] = response!.body
            expect(acbrs, 'Week 4 CB should have 1 ACBR').to.have.length(1)
            expect(new Date(acbrs[0].periodCoverage.startDateTime).getTime()).to.equal(week4Start.getTime())
            expect(new Date(acbrs[0].periodCoverage.endDateTime).getTime()).to.equal(week4End.getTime())

            // ============================================
            // Payment scheduler: recurring charge fails on the first attempt,
            // so the CB must be left untouched ('new'), then settles on the
            // next scheduler run once the charge succeeds.
            // ============================================
            const cbId = acbrs[0].bill.id

            cy.request(`${BILLING_SERVER_URL}/stripe/set-recurring-status/requires_payment_method`)
            runPaymentScheduler()
            expectCustomerBillState(cbId, 'new')

            runPaymentScheduler()
            expectCustomerBillState(cbId, 'settled')
          })

          // ============================================
          // Step 11: Call 5 at day 65 — Monthly month 2 + Weekly week 5 + Usage month 2
          // Both the monthly and usage "existing ACBRs" paths trigger together.
          // ============================================
          const triggerDate2Str = new Date(startTime.getTime() + 65 * 24 * 60 * 60 * 1000).toISOString()

          const month2Start = monthlyEnd
          const month2End = new Date(month2Start)
          month2End.setMonth(month2End.getMonth() + 1)

          const week5Start = week4End
          const week5End = new Date(startTime.getTime() + 5 * 7 * 24 * 60 * 60 * 1000)

          cy.intercept('GET', '**/billing/appliedCustomerBillingRate**').as('getMonth2Acbrs')

          cy.request({
            url: 'http://localhost:8006/charging/api/test/billingScheduler',
            method: 'POST',
            body: { date: triggerDate2Str },
          }).then((res) => { expect(res.status).to.eq(200) })

          cy.visit('/product-orders')
          cy.getBySel('invoices').click()
          clickLoadMoreUntilGone()

          cy.getBySel('invoiceRow').should('have.length.greaterThan', 0).last().within(() => {
            cy.getBySel('invoiceDetails').click()
          })

          cy.wait('@getMonth2Acbrs').then(({ response }) => {
            const acbrs: any[] = response!.body
            cy.log(`Month 2 ACBRs: ${JSON.stringify(acbrs.map(a => ({ type: a.type, end: a.periodCoverage?.endDateTime, taxIncl: a.taxIncludedAmount?.value })))}`)

            expect(acbrs, 'Month 2 CB should have 3 ACBRs (monthly + weekly + usage)').to.have.length(3)

            const monthly2Acbr = acbrs.find((a) =>
              a.type === 'recurring' &&
              a.periodCoverage &&
              new Date(a.periodCoverage.endDateTime).getTime() === month2End.getTime()
            )
            const weekly5Acbr = acbrs.find((a) =>
              a.type === 'recurring' &&
              a.periodCoverage &&
              new Date(a.periodCoverage.endDateTime).getTime() === week5End.getTime()
            )
            const usageM2Acbr = acbrs.find((a) => a.type === 'usage')

            expect(monthly2Acbr, 'Monthly month 2 ACBR should exist').to.exist
            expect(weekly5Acbr, 'Weekly week 5 ACBR should exist').to.exist
            expect(usageM2Acbr, 'Usage month 2 ACBR should exist').to.exist

            expect(
              new Date(monthly2Acbr.periodCoverage.startDateTime).getTime(),
              'Monthly month 2 start = month 1 end'
            ).to.equal(month2Start.getTime())
            expect(
              new Date(monthly2Acbr.periodCoverage.endDateTime).getTime(),
              'Monthly month 2 end'
            ).to.equal(month2End.getTime())

            expect(
              new Date(weekly5Acbr.periodCoverage.startDateTime).getTime(),
              'Weekly week 5 start = week 4 end'
            ).to.equal(week5Start.getTime())
            expect(
              new Date(weekly5Acbr.periodCoverage.endDateTime).getTime(),
              'Weekly week 5 end'
            ).to.equal(week5End.getTime())

            // Usage month 2: covers the same window as monthly month 2
            expect(
              new Date(usageM2Acbr.periodCoverage.startDateTime).getTime(),
              'Usage M2 start = month 1 end'
            ).to.equal(month2Start.getTime())
            expect(
              new Date(usageM2Acbr.periodCoverage.endDateTime).getTime(),
              'Usage M2 end = month 2 end'
            ).to.equal(month2End.getTime())

            // Usage price: 15 units × 1.00 EUR/min = 15.00 EUR duty-free, 18.15 EUR tax-included (21% VAT)
            expect(
              parseFloat(String(usageM2Acbr.taxExcludedAmount.value)),
              'Usage M2 duty-free = 15.00 EUR'
            ).to.be.closeTo(15, 0.01)
            expect(
              parseFloat(String(usageM2Acbr.taxIncludedAmount.value)),
              'Usage M2 tax-included = 18.15 EUR'
            ).to.be.closeTo(18.15, 0.01)

            // ============================================
            // Payment scheduler: charge succeeds on the first attempt
            // ============================================
            const cbId = monthly2Acbr.bill.id
            runPaymentScheduler()
            expectCustomerBillState(cbId, 'settled')
          })
        })
      })
    })
  })
})
