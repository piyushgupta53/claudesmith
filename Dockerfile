# Claudesmith Docker Image
# Pre-built image with all tools installed for fast container startup
# Build with: npm run build:docker

FROM ubuntu:24.04

# Pre-install all tools (one-time build cost)
# This eliminates the ~120 second apt-get overhead at container startup
RUN apt-get update -qq && \
    apt-get install -y -qq \
    jq \
    curl \
    git \
    python3 \
    python3-pip \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Set working directory
WORKDIR /scratch

# Default command
CMD ["/bin/bash"]
