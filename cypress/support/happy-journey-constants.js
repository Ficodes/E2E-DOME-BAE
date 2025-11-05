// Happy Journey Test Data
// Using fixed names so they can be reused across different test files

const HAPPY_JOURNEY = {
  catalog: {
    name: 'E2E Catalog Shared',
    description: 'E2E Test Catalog for Happy Journey'
  },
  productSpec: {
    name: 'E2E Product Spec Shared',
    description: 'E2E Test Product Specification for Happy Journey',
    version: '0.1',
    brand: 'E2E Test Brand',
    productNumber: '12345'
  },
  offering: {
    name: 'E2E Offering Automatic',
    description: 'E2E Test Offering for Happy Journey',
    detailedDescription: 'Additional E2E offering description for Happy Journey',
    version: '0.1'
  },
  pricePlan : {
    name: "pp1"
  },
  priceComponent: {
    name: "pc1",
    price: 5.2,
    type: "one time"
  }
}

module.exports = {
  HAPPY_JOURNEY
}
