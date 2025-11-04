# DOME Testing

Automated testing system for the DOME ecosystem.

## Usage

### Run system tests

To deploy the complete system and run the tests:

```bash
./testing-local.sh <proxy_branch> <proxy_repo> <charging_branch> <charging_repo> <frontend_branch> <frontend_repo> <tm_version>
```

**Example:**
```bash
./testing-local.sh master sluFicodes/business-ecosystem-logic-proxy master sluFicodes/business-ecosystem-charging-backend slu/test sluFicodes/BAE-Frontend 1.3.18
```

This command:
1. Clones the specified repositories on the indicated branches (It doesn't overwrite existing directories, to change repo/branch, it is required to remove the frontend/proxy/charging repo previously)
2. Builds the necessary Docker images
3. Deploys all services (proxy, charging, frontend, IDM, TMForum APIs, etc.)
4. Runs end-to-end tests with Cypress

### Clean and restart

To empty the database and start over:

```bash
./cleanup.sh
```

## Requirements

- Docker and Docker Compose
- Node.js and npm
- Python 3
- Git

**Note:** The script automatically detects if you're on macOS or Linux and adjusts dependency installation accordingly.
