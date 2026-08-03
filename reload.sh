#!/bin/bash

source .env_keys

echo $OIDC_KEY

echo -e "\033[35mRefreshing charging and proxy servers with the changes\033[0m"

cd charging-docker
docker compose down
cd ..

cd charging-repo
echo -e "\033[35mrecreating charging image\033[0m"
docker build -t charging-system-dev -f docker/Dockerfile .
cd ..

cd proxy-docker
docker compose down
cd ..

cd billing-server
docker compose down
cd ..

cd proxy-repo
echo -e "\033[35mrecreating proxy image\033[0m"
docker build -t proxy-system-dev -f docker/Dockerfile .
cd ..

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

# Start Billing Server
echo -e "\033[35mStarting Billing Server...\033[0m"
cd billing-server
docker compose up -d --build
cd ..
