#!/bin/bash

source .env_keys

echo $OIDC_KEY

echo -e "\033[35mResetting all services (down + volumes + up)...\033[0m"

# Stop and remove all containers with volumes
echo -e "\033[35mStopping and removing all containers with volumes...\033[0m"

cd scorpiodb
docker compose down -v
cd ..

cd charging-docker
docker compose down -v
cd ..

cd proxy-docker
docker compose down -v
cd ..

# Remove database data directories
echo -e "\033[35mRemoving database data directories...\033[0m"

if [ -d "proxy-docker/proxy-data" ]; then
    rm -rf proxy-docker/proxy-data
fi

if [ -d "charging-docker/charging-data" ]; then
    rm -rf charging-docker/charging-data
fi

# Now start everything back up
echo -e "\033[35mStarting all services...\033[0m"

docker network create main 2>/dev/null || true

# Start Scorpio
echo -e "\033[35mStarting Scorpio...\033[0m"
cd scorpiodb
docker compose up -d
cd ..

# Wait for Charging customerBill API to be ready
echo -e "\033[35mWaiting for Charging customerBill API (port 8645)...\033[0m"
until curl -s -o /dev/null -w "%{http_code}" http://localhost:8633/tmf-api/customerBillManagement/v4/customerBill | grep -qE "^(200|404)$"; do
  echo "  CustomerBill API not ready yet, retrying in 5s..."
  sleep 5
done
echo -e "\033[35mCharging customerBill API is ready.\033[0m"

# Start Charging
echo -e "\033[35mStarting Charging...\033[0m"
cd charging-docker
docker compose up -d
cd ..

# Start Proxy
echo -e "\033[35mStarting Proxy...\033[0m"
cd proxy-docker
docker compose up -d
cd ..

echo -e "\033[35mReset completed! All services are running with fresh databases.\033[0m"
