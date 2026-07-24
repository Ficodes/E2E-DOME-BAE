// DSP Journey Test Data

export const DSP_JOURNEY = {
  productSpec: {
    name: 'E2E DSP Product Spec',
    brand: 'E2E DSP Brand',
    productNumber: 'DSP-001'
  },
  offering: {
    name: 'E2E DSP Offering',
    description: 'DSP test offering',
    detailedDescription: 'Detailed description for DSP offering'
  },
  pricePlan: {
    name: 'DSP Price Plan'
  },
  priceComponent: {
    name: 'DSP Price Component',
    price: 1.0,
    type: 'one time'
  },
  dspConfig: {
    endpoint: {
      name: 'dsp-connector',
      url: 'https://connector.example.com/dsp',
      description: 'Main DSP connector endpoint'
    },
    upstreamAddress: 'http://upstream.internal:8080',
    targetSpecification: '{"type": "HttpData", "baseUrl": "http://target.example.com"}',
    serviceConfiguration: '{"service": "connector", "version": "1.0"}',
    credentialsConfig: '{"credentialsId": "default-creds", "type": "oauth2"}',
    policyConfig: '{"@type": "Set", "permission": []}'
  },
  contractDefinition: {
    accessPolicy: '{"@context": {"odrl": "http://www.w3.org/ns/odrl/2/"}, "@type": "odrl:Set", "odrl:permission": []}',
    contractPolicy: '{"@context": {"odrl": "http://www.w3.org/ns/odrl/2/"}, "@type": "odrl:Set", "odrl:permission": []}'
  }
}
