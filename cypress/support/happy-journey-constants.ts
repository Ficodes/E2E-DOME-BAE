// Happy Journey Test Data
// Using fixed names so they can be reused across different test files
import type { Characteristic } from './form-helpers'

export const HAPPY_JOURNEY = {
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
  serviceSpec: {
      name: `E2E Service Spec Shared`,
      description: 'Test service specification with characteristics',
      characteristics: [
        {
          name: 'API Protocol',
          description: 'Supported API protocols',
          type: 'string',
          values: ['REST', 'GraphQL', 'gRPC']
        },
        {
          name: 'Max Requests',
          description: 'Maximum requests per minute',
          type: 'number',
          values: [
            { value: 1000, unit: 'req/min' },
            { value: 5000, unit: 'req/min' },
            { value: 10000, unit: 'req/min' }
          ]
        }
      ] as Characteristic[]
    },
    resourceSpec: {
      name: `E2E Resource Spec`,
      description: 'Test resource specification with characteristics',
      characteristics: [
        {
          name: 'Storage Type',
          description: 'Type of storage',
          type: 'string' as const,
          values: ['SSD', 'H∫DD', 'NVMe']
        },
        {
          name: 'Storage Capacity',
          description: 'Storage capacity range',
          type: 'range' as const,
          values: { from: 100, to: 5000, unit: 'GB' }
        }
      ] as Characteristic[]
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
