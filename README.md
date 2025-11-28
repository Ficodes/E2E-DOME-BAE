# E2E-DOME-BAE

## Table of Contents

- [Testing Strategy: Configuration-Driven Shared State](#testing-strategy-configuration-driven-shared-state)
  - [Workflow Explanation](#workflow-explanation)
- [Usage](#usage)
  - [Run system tests](#run-system-tests)
  - [Clean and restart](#clean-and-restart)
  - [Tests with UI](#execute-tests-manually-with-ui)
  - [CI/CD](#you-can-integrate-the-tests-in-your-cicd)
- [Requirements](#requirements)

## Testing Strategy: Configuration-Driven Shared State

This project uses an optimized End-to-End (E2E) testing strategy with Playwright, designed to minimize execution time and avoid redundant data creation.

Because the marketplace flow has heavy sequential dependencies (Catalog $\rightarrow$ Specs $\rightarrow$ Offering), creating fresh foundational data for every single test is highly inefficient.

Instead of re-creating data or passing data dynamically between tests, we use a **configuration-driven approach** where a predefined file acts as the single source of truth for test data identifiers.

Our strategy is visualized below:

![E2E Testing Strategy Diagram](./assets/testing-strategy.png)

### Workflow Explanation

**The Source of Truth: Predefined Configuration File**
Before any tests run, a static configuration file exists containing fixed names, and other attributes for the required Catalog, Specs, and Offering. This ensures every test knows exactly "who" corresponds to "what".

**1. Phase 1: The "Happy Journey" (Seeding the System)**
* The main, positive-flow test executes first.
* It reads the **Predefined Configuration File** to know exactly what names and attributes to use.
* It executes and tests the creation actions against the live DOME system, effectively populating the environment with the expected "gold standard" objects.

**2. Phase 2: Specific & Edge Tests (Reuse)**
* Subsequent tests execute only after Phase 1 has successfully seeded the environment.
* These tests also read the **Predefined Configuration File** to find the fixed identifiers of the objects they need to interact with.
* They **skip creation steps** and directly interact with the live system, reusing the existing Catalogs, Specs, or Offerings to perform specific verifications or test edge-case scenarios.

This ensures deep test coverage without wasting time constantly rebuilding the foundational data structures.

## Usage

### Run system tests

To deploy the complete system and run the tests:

```bash
./testing-local.sh [--headed] <proxy_branch> <proxy_repo> <charging_branch> <charging_repo> <frontend_branch> <frontend_repo> <tm_version>
```

**Optional flags:**
- `--headed` - Run Cypress tests with GUI (default: headless mode)

**Examples:**

Headless mode (default):
```bash
./testing-local.sh master FIWARE-TMForum/business-ecosystem-logic-proxy master FIWARE-TMForum/business-ecosystem-charging-backend main Ficodes/BAE-Frontend 1.3.18
```

With GUI (headed mode):
```bash
./testing-local.sh --headed master FIWARE-TMForum/business-ecosystem-logic-proxy master FIWARE-TMForum/business-ecosystem-charging-backend main Ficodes/BAE-Frontend 1.3.18
```

This command:
1. Clones the specified repositories on the indicated branches (It doesn't overwrite existing directories, to change repo/branch, it is required to remove the frontend/proxy/charging repo previously)
2. Builds the necessary Docker images
3. Deploys all services (proxy, charging, frontend, IDM, TMForum APIs, etc.)
4. Runs end-to-end tests with Cypress (headless by default, or with GUI if `--headed` flag is used)

### Clean and restart

To empty the database and start over:

```bash
./cleanup.sh
```

### Execute tests manually with UI

If the system is already deployed, you can execute this command:
```bash
npx cypress open --e2e
```

If nothing is deployed yet, use the `--headed` flag when running the testing script:
```bash
./testing-local.sh --headed master FIWARE-TMForum/business-ecosystem-logic-proxy master FIWARE-TMForum/business-ecosystem-charging-backend main Ficodes/BAE-Frontend 1.3.18
```

### You can integrate the tests in your CI/CD
From your forked BAE-Frontend you can send a PR to the original repo (Ficodes/BAE-Frontend) with the following data
This is the minimal text you need to trigger the system testing workflow
```txt
SYSTEM_TESTING: ACTIVATE
TM_VERSION: 1.3.18
```
And this is for custom testing
```txt
SYSTEM_TESTING: ACTIVATE [needed to activate the workflow]
PROXY: https://github.com/FIWARE-TMForum/business-ecosystem-logic-proxy/tree/develop [This line is optional; default it will take master branch]
CHARGING: https://github.com/FIWARE-TMForum/business-ecosystem-charging-backend/tree/develop [This line is optional; default it will take master branch]
TM_VERSION: 1.3.18
```
SYSTEM_TESTING: [needed to activate the workflow]
PROXY: [This line is optional; default it will take master branch]
CHARGING: [This line is optional; default it will take master branch]
TM_VERSION: Mandatory to se the tmforum api version

It is going to test your current Pull requested front repo@branch with the repo@branch of proxy and charging (optional) and tmforum api that you previously chose

## Requirements

- Docker and Docker Compose
- Node.js and npm
- Python 3
- Git

**Note:** The script automatically detects if you're on macOS or Linux and adjusts dependency installation accordingly.
