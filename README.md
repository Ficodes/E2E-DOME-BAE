# DOME Testing

Automated E2E testing system for the DOME ecosystem.

## Architecture

![Test Structure Diagram](diagrams/test_structure.png)

The diagram above shows how all E2E tests are interacting with each others.

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

To execute the cypress tests with a graphic interface after the system is already deployed:
```bash
npx cypress open --e2e
```

### You can integrate the tests in your CI/CD
From your forked BAE-Frontend you can send a PR to the original repo (Ficodes/BAE-Frontend) with the following data
This is the minimal text you need to trigger the system testing workflow
```txt
```txt
SYSTEM_TESTING: ACTIVATE
TM_VERSION: 1.3.18
```
And this is for custom testing
```
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
