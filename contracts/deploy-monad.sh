#!/usr/bin/env bash
# deploy-monad.sh — Deploy AgentPay contracts to Monad testnet and write addresses.
# Usage: ./deploy-monad.sh
#
# Prerequisites:
#   contracts/.env with MONAD_TESTNET_RPC and DEPLOYER_PRIVATE_KEY set.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONTRACTS_DIR="$SCRIPT_DIR"
ROOT_DIR="$(dirname "$CONTRACTS_DIR")"
BACKEND_DIR="$ROOT_DIR/backend"

source "$CONTRACTS_DIR/.env"

echo "🚀 Deploying AgentPay contracts to Monad testnet (chain ID 10143)..."

OUTPUT=$(forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$MONAD_TESTNET_RPC" \
  --broadcast \
  --legacy \
  -vvv 2>&1)

echo "$OUTPUT"

# Parse addresses from console output
REGISTRY=$(echo "$OUTPUT" | grep "AgentRegistry:" | head -1 | awk '{print $NF}')
WALLET=$(echo "$OUTPUT" | grep "AgentWallet:" | head -1 | awk '{print $NF}')
REPUTATION=$(echo "$OUTPUT" | grep "Reputation:" | head -1 | awk '{print $NF}')
MARKETPLACE=$(echo "$OUTPUT" | grep "AgentMarketplace:" | head -1 | awk '{print $NF}')

if [ -z "$REGISTRY" ] || [ -z "$WALLET" ] || [ -z "$REPUTATION" ] || [ -z "$MARKETPLACE" ]; then
  echo "❌ Failed to parse deployed addresses from output."
  exit 1
fi

# Write deployed-addresses.json
cat > "$CONTRACTS_DIR/deployed-addresses.json" <<EOF
{
  "network": "monad-testnet",
  "chainId": 10143,
  "contracts": {
    "AgentRegistry": "$REGISTRY",
    "AgentWallet": "$WALLET",
    "Reputation": "$REPUTATION",
    "AgentMarketplace": "$MARKETPLACE"
  }
}
EOF

echo ""
echo "✅ Wrote $CONTRACTS_DIR/deployed-addresses.json"

# Append/update backend .env
BACKEND_ENV="$BACKEND_DIR/.env"
touch "$BACKEND_ENV"

# Remove old contract address lines if present
for KEY in AGENT_REGISTRY_ADDRESS AGENT_WALLET_ADDRESS AGENT_MARKETPLACE_ADDRESS REPUTATION_ADDRESS; do
  sed -i.bak "/^${KEY}=/d" "$BACKEND_ENV" 2>/dev/null || true
done
rm -f "$BACKEND_ENV.bak"

cat >> "$BACKEND_ENV" <<EOF
AGENT_REGISTRY_ADDRESS=$REGISTRY
AGENT_WALLET_ADDRESS=$WALLET
AGENT_MARKETPLACE_ADDRESS=$MARKETPLACE
REPUTATION_ADDRESS=$REPUTATION
EOF

echo "✅ Wrote contract addresses to $BACKEND_ENV"
echo ""
echo "=== Deployed Addresses ==="
echo "  AgentRegistry:    $REGISTRY"
echo "  AgentWallet:      $WALLET"
echo "  Reputation:       $REPUTATION"
echo "  AgentMarketplace: $MARKETPLACE"
