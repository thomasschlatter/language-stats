#!/bin/bash
# Build the world client for the groupifier.com deployment:
#   - served under /game/ (Vite base)
#   - connects to Colyseus over wss://groupifier.com:2567
# Run this instead of `npm run build` on the server so the endpoint/base are
# never lost. Usage: ./build-prod.sh
set -e
cd "$(dirname "$0")"
VITE_BASE=/game/ \
VITE_SERVER_URL=wss://groupifier.com:2567 \
NODE_OPTIONS=--max-old-space-size=1536 \
  npx vite build
echo "built dist/ (base=/game/, server=wss://groupifier.com:2567)"
