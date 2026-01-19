#!/bin/bash
# Build the claudesmith Docker image with pre-installed tools
# This image eliminates the ~120 second startup time from apt-get install

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Building claudesmith Docker image..."
echo "Project directory: $PROJECT_DIR"

# Build the image from the project root
docker build -t claudesmith:latest -f "$PROJECT_DIR/Dockerfile" "$PROJECT_DIR"

echo ""
echo "Image built successfully: claudesmith:latest"
echo ""
echo "Verify with: docker images claudesmith:latest"
echo "Test with: docker run --rm claudesmith:latest echo 'Container ready'"
