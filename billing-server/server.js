const express = require('express');
const app = express();
const PORT = 4201;
const jwtResponse = require('./jwtResponse')

app.use(express.json());

let successURL = 'https://www.google.com/'
let cancelURL = 'https://docs.github.com/'
let bearerToken = ''

let successURLStack = []
let cancelURLStack = []

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
  successURLStack.push(body.processSuccessUrl)
  cancelURLStack.push(body.processErrorUrl)
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
  console.log('received checkin ', successURL)
  res.redirect(successURL+'&jwt=' + jwtResponse.processedOrFailedJWT + '&token=' + bearerToken)
})

app.get('/bad-checkin', (req, res) => {
  const cancelURL = cancelURLStack.shift()
  console.log('received cancel ', cancelURL)
  res.redirect(cancelURL+ '&jwt=' + jwtResponse.processedOrFailedJWT + '&token=' + bearerToken)
})

app.get('/pending-checkin', (req, res) => {
  const successURL = successURLStack.shift()
  console.log('received cancel ', cancelURL)
  res.redirect(successURL+ '&jwt=' + jwtResponse.pendingJWT + '&token=' + bearerToken)
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Billing server running on http://0.0.0.0:${PORT}`);
  console.log('billing server mock v2.0')
});
