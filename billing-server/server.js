const express = require('express');
const crypto = require('crypto');
const app = express();
const PORT = 4201;
const jwtResponse = require('./jwtResponse')
const PROCESSED = 'PROCESSED'
const PENDING= 'PENDING'

app.use(express.json());
// Stripe's Node/Python SDKs send form-encoded bodies (with bracket notation
// for nested objects/arrays), so we need the extended urlencoded parser too.
app.use(express.urlencoded({ extended: true }));

let successURL = 'https://www.google.com/'
let cancelURL = 'https://docs.github.com/'
let bearerToken = ''

let successURLStack = []
let cancelURLStack = []
let pendingNext = false

app.get('/api/product-providers/payment-gateways/count', (req, res) => {
  console.log('Received request:', req.query);
  res.json(2);
});

app.post('/clear', (req, res) => {
  console.log('clearing cache')
  successURLStack = []
  cancelURLStack = []
  res.json('OK')
})

app.post('/api/payment-start', (req, res) => {
  const body = req.body
  const authHeader = req.headers.authorization
  bearerToken = authHeader ? authHeader.replace('Bearer ', '') : ''
  console.log('received payment ref', JSON.stringify(body))
  const paymentItems = body.baseAttributes.paymentItems
  const recurring = paymentItems.some(item => item.recurring)
  console.log(`recurring: ${recurring}`)
  const state = pendingNext? PENDING: PROCESSED
  successURLStack.push({url: body.processSuccessUrl, jwt: jwtResponse.generatePaymentJWT(paymentItems, state, { productOrderId: body.baseAttributes.externalId, ...(recurring ? {} : { preAuthId: null }) })})
  cancelURLStack.push(body.processErrorUrl)
  pendingNext = false
  res.json({redirectUrl: 'http://localhost:4201/checkin'})
})

app.get('/checkin', (req, res) => {
  const successURL = successURLStack.shift()
  if (!successURL) {
    const cancelURL = cancelURLStack.shift()
    console.log('received cancel ', cancelURL)
    res.redirect(cancelURL)
    return
  }
  console.log('received checkin ', successURL.url)
  res.redirect(successURL.url+'&jwt=' + successURL.jwt + '&token=' + bearerToken)
})

app.get('/bad-checkin', (req, res) => {
  const cancelURL = cancelURLStack.shift()
  console.log('received cancel ', cancelURL)
  res.redirect(cancelURL + '&token=' + bearerToken)
})

app.get('/set-pending', (req, res) => {
  pendingNext = true
  res.json('OK')
})

// =====================================================================
// Stripe mock
//
// Implements the subset of the Stripe HTTP API used by charging-repo's
// StripeClient (BAE_CB_STRIPE_TEST_API_BASE points the stripe SDK here),
// plus a separate set of /stripe/* endpoints for cypress to drive the
// checkout flow (mirroring /clear, /checkin, /bad-checkin, /set-pending
// above, but operating on Stripe Checkout Sessions instead of DPAS).
// =====================================================================

const stripeSessions = new Map()
const paymentIntents = new Map()
let stripeCheckinQueue = []
let stripeCancelQueue = []
let stripePendingNext = false
// Status to use for the next recurring payment_intent created via charge_recurring
// (e.g. 'processing', 'succeeded', 'requires_payment_method'). Defaults to 'succeeded'.
let paymentIntentNextStatus = null

function genId(prefix) {
  return `${prefix}_${crypto.randomBytes(12).toString('hex')}`
}

app.post('/v1/checkout/sessions', (req, res) => {
  const body = req.body
  const sessionId = genId('cs_test')
  const paymentIntentId = genId('pi')

  const lineItems = (body.line_items || []).map((li) => {
    const priceData = li.price_data || {}
    const quantity = Number(li.quantity) || 1
    const unitAmount = Number(priceData.unit_amount) || 0
    return {
      id: genId('li'),
      object: 'item',
      quantity,
      metadata: li.metadata || {},
      currency: priceData.currency,
      amount_total: unitAmount * quantity,
      description: (priceData.product_data || {}).name,
    }
  })

  const isRecurring = !!(body.payment_intent_data && body.payment_intent_data.setup_future_usage)
    || body.customer_creation === 'always'
  const customerId = isRecurring ? genId('cus') : null
  const paymentMethodId = isRecurring ? genId('pm') : null

  paymentIntents.set(paymentIntentId, {
    id: paymentIntentId,
    object: 'payment_intent',
    status: 'requires_payment_method',
    customer: customerId,
    payment_method: paymentMethodId,
    amount: lineItems.reduce((sum, li) => sum + li.amount_total, 0),
    currency: lineItems[0] ? lineItems[0].currency : 'eur',
  })

  const session = {
    id: sessionId,
    object: 'checkout.session',
    client_reference_id: body.client_reference_id,
    success_url: body.success_url,
    cancel_url: body.cancel_url,
    mode: body.mode,
    payment_status: 'unpaid',
    status: 'open',
    customer: customerId,
    payment_intent: paymentIntentId,
    url: `http://localhost:${PORT}/stripe-checkout?session_id=${sessionId}`,
    line_items: lineItems,
  }
  stripeSessions.set(sessionId, session)

  const resolvedSuccessUrl = (body.success_url || '').replace('{CHECKOUT_SESSION_ID}', sessionId)
  stripeCheckinQueue.push({ sessionId, successUrl: resolvedSuccessUrl, pending: stripePendingNext })
  stripeCancelQueue.push(body.cancel_url)
  stripePendingNext = false

  console.log('created stripe checkout session', sessionId)
  res.json(session)
})

app.get('/v1/checkout/sessions/:id', (req, res) => {
  const session = stripeSessions.get(req.params.id)
  if (!session) {
    return res.status(404).json({ error: { message: 'No such checkout session', type: 'invalid_request_error' } })
  }
  const { line_items, ...sessionResponse } = session
  res.json(sessionResponse)
})

app.get('/v1/checkout/sessions/:id/line_items', (req, res) => {
  const session = stripeSessions.get(req.params.id)
  if (!session) {
    return res.status(404).json({ error: { message: 'No such checkout session', type: 'invalid_request_error' } })
  }

  const limit = parseInt(req.query.limit, 10) || 10
  let items = session.line_items
  if (req.query.starting_after) {
    const idx = items.findIndex((item) => item.id === req.query.starting_after)
    items = items.slice(idx + 1)
  }
  const page = items.slice(0, limit)

  res.json({
    object: 'list',
    url: `/v1/checkout/sessions/${req.params.id}/line_items`,
    has_more: items.length > limit,
    data: page,
  })
})

app.post('/v1/payment_intents', (req, res) => {
  const body = req.body
  const id = genId('pi')
  const status = paymentIntentNextStatus || 'succeeded'
  paymentIntentNextStatus = null
  const pi = {
    id,
    object: 'payment_intent',
    status,
    amount: Number(body.amount),
    currency: body.currency,
    customer: body.customer,
    payment_method: body.payment_method,
  }
  if (status === 'processing') {
    // Resolves to succeeded once polled again, simulating an async confirmation
    pi._resolvedStatus = 'succeeded'
  }
  paymentIntents.set(id, pi)
  res.json(pi)
})

app.get('/v1/payment_intents/:id', (req, res) => {
  const pi = paymentIntents.get(req.params.id)
  if (!pi) {
    return res.status(404).json({ error: { message: 'No such payment_intent', type: 'invalid_request_error' } })
  }
  if (pi._resolvedStatus) {
    pi.status = pi._resolvedStatus
    delete pi._resolvedStatus
  }
  res.json(pi)
})

app.post('/v1/refunds', (req, res) => {
  const body = req.body
  res.json({
    id: genId('re'),
    object: 'refund',
    payment_intent: body.payment_intent,
    status: 'succeeded',
  })
})

// ---- /stripe/* cypress-facing endpoints ----

app.post('/stripe/clear', (req, res) => {
  console.log('clearing stripe cache')
  stripeSessions.clear()
  paymentIntents.clear()
  stripeCheckinQueue = []
  stripeCancelQueue = []
  stripePendingNext = false
  paymentIntentNextStatus = null
  res.json('OK')
})

app.get('/stripe/checkin', (req, res) => {
  const entry = stripeCheckinQueue.shift()
  if (!entry) {
    const cancelUrl = stripeCancelQueue.shift()
    console.log('received stripe cancel ', cancelUrl)
    res.redirect(cancelUrl)
    return
  }
  stripeCancelQueue.shift()

  const session = stripeSessions.get(entry.sessionId)
  if (entry.pending) {
    session.payment_status = 'unpaid'
  } else {
    session.payment_status = 'paid'
    session.status = 'complete'
    const pi = paymentIntents.get(session.payment_intent)
    if (pi) {
      pi.status = 'succeeded'
    }
  }

  console.log('received stripe checkin ', entry.successUrl)
  res.redirect(entry.successUrl)
})

app.get('/stripe/bad-checkin', (req, res) => {
  stripeCheckinQueue.shift()
  const cancelUrl = stripeCancelQueue.shift()
  console.log('received stripe cancel ', cancelUrl)
  res.redirect(cancelUrl)
})

app.get('/stripe/set-pending', (req, res) => {
  stripePendingNext = true
  res.json('OK')
})

// Sets the status of the next payment_intent created via charge_recurring
// (e.g. 'processing', 'requires_payment_method'). Consumed once.
app.get('/stripe/set-recurring-status/:status', (req, res) => {
  paymentIntentNextStatus = req.params.status
  res.json('OK')
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Billing server running on http://0.0.0.0:${PORT}`);
  console.log('billing server mock v5.0')
});
