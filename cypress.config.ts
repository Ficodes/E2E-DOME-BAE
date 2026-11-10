import { defineConfig } from 'cypress'
import { pluginTasks } from './cypress/plugins/tasks'

const suite = process.env.E2E_SUITE || 'all'
if (!['all', 'dpas', 'redsys', 'plugins', 'core'].includes(suite)) throw new Error(`Unknown E2E_SUITE: ${suite}`)
// Keep core as a compatibility alias for existing local commands.
const nonPluginSuite = ['dpas', 'redsys', 'core'].includes(suite)
const specPattern = suite === 'plugins' ? 'cypress/e2e/plugins/**/*.cy.ts'
  : suite === 'redsys' ? 'cypress/e2e/{01-happy-journey,04-billing-and-payment-scheduler}.cy.ts'
  : 'cypress/e2e/**/*.cy.ts'

export default defineConfig({
  e2e: {
    viewportWidth: 1920,
    viewportHeight: 1080,
    baseUrl: 'http://localhost:4200',
    supportFile: 'cypress/support/e2e.ts',
    specPattern,
    excludeSpecPattern: nonPluginSuite ? ['cypress/e2e/plugins/**/*.cy.ts'] : [],
    setupNodeEvents(on, config) {
      // Suite boundaries also apply when CYPRESS_specPattern is inherited from CI.
      if (['dpas', 'redsys', 'plugins'].includes(suite)) config.specPattern = specPattern
      if (nonPluginSuite) config.excludeSpecPattern = ['cypress/e2e/plugins/**/*.cy.ts']
      if (suite === 'all' || suite === 'plugins') on('task', pluginTasks())
      return config
    },
    video: true,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 200000,
    requestTimeout: 200000,
    responseTimeout: 200000,
    env: {
      PAYMENT_METHOD: ['dpas', 'redsys'].includes(suite) ? suite : process.env.BAE_CB_PAYMENT_METHOD || 'dpas',
      REDSYS_ORIGIN: process.env.BAE_CB_REDSYS_ORIGIN || 'https://sis-t.redsys.es:25443',
      REDSYS_AUTH_ORIGIN: process.env.BAE_CB_REDSYS_AUTH_ORIGIN || 'https://sis-d.redsys.es'
    }
  }
})
