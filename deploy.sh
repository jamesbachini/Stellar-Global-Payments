#!/usr/bin/env bash

# Stellar Soroban Remittance Deployment Script (Testnet)
# Builds the remittance smart-account contract, deploys four labeled
# instances (A-D), and initializes them with the OpenZeppelin policy.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ROOT_DIR=$(cd "$(dirname "$0")" && pwd)
CONTRACT_DIR="$ROOT_DIR/contracts"
CONFIG_DIR="$ROOT_DIR/shared/config"
OUTPUT_CONFIG="$CONFIG_DIR/accounts.local.json"
DEFAULT_RPC="https://soroban-testnet.stellar.org"
NETWORK="testnet"
WASM_PATH="$CONTRACT_DIR/target/wasm32v1-none/release/remittance_accounts.wasm"
LABELS=(A B C D)
declare -A CONTRACT_IDS

check_env() {
  local var="$1"
  if [[ -z "${!var:-}" ]]; then
    echo -e "${RED}Missing required env var: $var${NC}"
    exit 1
  fi
}

check_cli() {
  if ! command -v stellar &> /dev/null; then
    echo -e "${RED}stellar CLI not installed. Follow https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli${NC}"
    exit 1
  fi
}

check_env "ADMIN_SECRET_KEY"
check_env "USDC_CONTRACT_ID"

SOURCE_ACCOUNT="${STELLAR_ACCOUNT:-$ADMIN_SECRET_KEY}"
RPC_URL="${SOROBAN_RPC_URL:-$DEFAULT_RPC}"
export STELLAR_RPC_URL="$RPC_URL"
export STELLAR_NETWORK="$NETWORK"

check_cli

pushd "$CONTRACT_DIR" >/dev/null
  echo -e "${YELLOW}Step 1: Cleaning previous builds${NC}"
  cargo clean

  echo -e "${YELLOW}Step 2: Building WASM binary${NC}"
  stellar contract build
popd >/dev/null

if [[ ! -f "$WASM_PATH" ]]; then
  echo -e "${RED}Compiled WASM not found at $WASM_PATH${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Build ready (${WASM_PATH})${NC}"

ADMIN_PUBLIC_KEY=$(node -e "import { Keypair } from '@stellar/stellar-sdk'; const secret = process.env.ADMIN_SECRET_KEY; if (!secret) throw new Error('ADMIN_SECRET_KEY missing'); console.log(Keypair.fromSecret(secret).publicKey());")
if [[ -z "$ADMIN_PUBLIC_KEY" ]]; then
  echo -e "${RED}Unable to derive admin public key${NC}"
  exit 1
fi

echo -e "${YELLOW}Step 3: Deploying contract instances${NC}"
for label in "${LABELS[@]}"; do
  echo "Deploying smart account $label..."
  deploy_output=$(stellar contract deploy \
    --wasm "$WASM_PATH" \
    --source-account "$SOURCE_ACCOUNT" \
    --network "$NETWORK"
  )
  contract_id=$(echo "$deploy_output" | awk '/Contract Id/ {print $NF}' | tail -n1)
  if [[ -z "$contract_id" ]]; then
    echo -e "${RED}Failed to parse contract id for account $label${NC}"
    echo "$deploy_output"
    exit 1
  fi
  CONTRACT_IDS[$label]=$contract_id
  echo -e "  ${GREEN}Contract ID:${NC} $contract_id"
done

echo -e "${YELLOW}Step 4: Initializing accounts${NC}"
for label in "${LABELS[@]}"; do
  contract_id="${CONTRACT_IDS[$label]}"
  echo "Initializing $label ($contract_id)..."
  dest_args=()
  for other in "${LABELS[@]}"; do
    if [[ "$other" != "$label" ]]; then
      dest_args+=(--destinations "${CONTRACT_IDS[$other]}")
    fi
  done
  invoke_cmd=(
    stellar contract invoke
    --id "$contract_id"
    --source-account "$SOURCE_ACCOUNT"
    --network "$NETWORK"
    -- init
    --admin "$ADMIN_PUBLIC_KEY"
    --token "$USDC_CONTRACT_ID"
  )
  invoke_cmd+=("${dest_args[@]}")
  invoke_cmd+=(--label "$label")
  "${invoke_cmd[@]}"
done

echo -e "${YELLOW}Step 5: Writing config to $OUTPUT_CONFIG${NC}"
mkdir -p "$CONFIG_DIR"
cat > "$OUTPUT_CONFIG" <<EOF
{
  "network": "${NETWORK^^}",
  "rpcUrl": "$RPC_URL",
  "usdcContractId": "$USDC_CONTRACT_ID",
  "adminPublicKey": "$ADMIN_PUBLIC_KEY",
  "accounts": {
EOF
for i in "${!LABELS[@]}"; do
  label=${LABELS[$i]}
  comma=",";
  if [[ $i -eq $((${#LABELS[@]} - 1)) ]]; then
    comma=""
  fi
  printf '    "%s": "%s"%s\n' "$label" "${CONTRACT_IDS[$label]}" "$comma" >> "$OUTPUT_CONFIG"
done
cat <<EOF >> "$OUTPUT_CONFIG"
  }
}
EOF

echo -e "${GREEN}Deployment complete! Config written to $OUTPUT_CONFIG${NC}"
