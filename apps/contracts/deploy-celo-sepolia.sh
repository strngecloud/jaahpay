#!/bin/bash

# Jahpay deployment script for Celo Sepolia Testnet
# (Alfajores was sunset — this replaces deploy-testnet.sh)

set -e

echo "🚀 Deploying Jahpay contracts to Celo Sepolia Testnet..."
echo ""

if [ ! -f .env ]; then
    echo "❌ Error: .env file not found! It must contain PRIVATE_KEY."
    exit 1
fi

# Only PRIVATE_KEY is taken from .env — the other addresses in that file
# are Celo MAINNET addresses and must not leak into this deployment.
export PRIVATE_KEY=$(grep '^PRIVATE_KEY=' .env | cut -d= -f2-)

if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ Error: PRIVATE_KEY not set in .env file"
    exit 1
fi

DEPLOYER=$(cast wallet address --private-key "$PRIVATE_KEY")
BALANCE=$(cast balance "$DEPLOYER" --rpc-url celo-sepolia --ether)

echo "📋 Deployment Configuration:"
echo "  Network:  Celo Sepolia (chain id 11142220)"
echo "  Deployer: $DEPLOYER"
echo "  Balance:  $BALANCE CELO"
echo ""

if [ "$BALANCE" = "0.000000000000000000" ]; then
    echo "❌ Deployer has no CELO on Celo Sepolia."
    echo "   Fund it at https://faucet.celo.org (select Celo Sepolia): $DEPLOYER"
    exit 1
fi

echo "🔨 Compiling contracts..."
forge build

echo ""
echo "📤 Deploying to Celo Sepolia..."
forge script script/DeployCeloSepolia.s.sol:DeployCeloSepoliaScript \
  --rpc-url celo-sepolia \
  --broadcast \
  -vvv

echo ""
echo "✅ Celo Sepolia deployment complete!"
echo "   Next: copy the SpendRouter Proxy address into apps/server/.env"
echo "   (SPEND_ROUTER_ADDRESS_CELO) and the web app's contract config."
