const express = require('express');
const app = express();
const PORT = 4201;
const jwtResponse = require('./jwtResponse')
const PROCESSED = 'PROCESSED'
const PENDING= 'PENDING'

app.use(express.json());

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
  console.log('received payment ref', body)
  const paymentItems = body.baseAttributes.paymentItems
  const state = pendingNext? PENDING: PROCESSED
  successURLStack.push({url: body.processSuccessUrl, jwt: jwtResponse.generatePaymentJWT(paymentItems, state)})
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Billing server running on http://0.0.0.0:${PORT}`);
  console.log('billing server mock v2.0')
});
