#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cp "$SCRIPT_DIR/docker-speed/Dockerfile.proxy" "$SCRIPT_DIR/proxy-repo/docker/Dockerfile"
cp "$SCRIPT_DIR/docker-speed/Dockerfile.charging" "$SCRIPT_DIR/charging-repo/docker/Dockerfile"

echo "Speeding reload.sh time suceeded"
