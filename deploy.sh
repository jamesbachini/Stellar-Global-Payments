#!/usr/bin/env bash

# Stellar Soroban Remittance Deployment Script (Testnet)
# Builds the remittance smart-account contract, deploys four labeled
# instances (A-D), and initializes them with the OpenZeppelin policy.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SOURCE_ACCOUNT="james"
ADMIN_PUBLIC_KEY="GBQ7FCMEP3Q455HVHI74XELBTEYSECT7QO2VYIBC6WCW7VVB6WXZ6KL4"
RPC_URL="https://soroban-testnet.stellar.org"
NETWORK="testnet"
WASM_PATH="./contracts/target/wasm32v1-none/release/remittance_accounts.wasm"
USDC_CONTRACT_ID="CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"

CONTRACT_DIR="./contracts"
CONFIG_DIR="./shared/config"
OUTPUT_CONFIG="$CONFIG_DIR/accounts.local.json"
LABELS=(A B C D)
declare -A CONTRACT_IDS

check_cli() {
  if ! command -v stellar &> /dev/null; then
    echo -e "${RED}stellar CLI not installed. Follow https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli${NC}"
    exit 1
  fi
}

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
