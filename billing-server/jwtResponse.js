const jwt = require('jsonwebtoken');

const JWT_SECRET = 'test-billing-secret-key-2024';

/**
 * @param {Array} paymentItems - Array de customer bill IDs (strings o objetos con id)
 * @param {string} state - 'PROCESSED', 'PENDING', 'FAILED', 'CANCELLED'
 * @param {object} options
 * @returns {string} JWT
 */
function generatePaymentJWT(paymentItems, state = 'PROCESSED', options = {}) {
    const {
        productOrderId = 'urn:ngsi-ld:product-order:6209b835-90e4-45cc-bba3-0262d9f1e861',
        preAuthId = 'c995a1b2-8f04-480c-820e-21f970925675',
        paymentItemId = 207
    } = options;

    // Construir el payoutList con todos los items con el mismo estado
    const payoutList = paymentItems.map(item => ({
        state: state.toUpperCase(),
        productProviderExternalId: item.productProviderExternalId,
        gatewayExternalId: 'stripe-payment-gateway-external-id',
        amount: item.amount,
        currency: item.currency,
        paymentMethodType: 'CARD',
        paymentItemId: paymentItemId,
        paymentItemExternalId: item.paymentItemExternalId
    }));

    const payload = {
        paymentExternalId: productOrderId,
        paymentPreAuthorizationExternalId: preAuthId,
        payoutList: payoutList
    };

    console.log("build: " + JSON.stringify(payload))

    return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
}

module.exports = {
    generatePaymentJWT
};
