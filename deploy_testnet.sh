#!/usr/bin/env bash

# Stellar Soroban Remittance Deployment Script (Testnet)
# Builds the remittance smart-account contract, deploys four labeled
# instances (A-D), and initializes them with the OpenZeppelin policy.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SOURCE_ACCOUNT="${SOURCE_ACCOUNT:-james}"
ADMIN_SIGNER="${ADMIN_SIGNER:-$SOURCE_ACCOUNT}"
ADMIN_PUBLIC_KEY="${ADMIN_PUBLIC_KEY:-}"
RPC_URL="https://soroban-testnet.stellar.org"
NETWORK="testnet"
WASM_PATH="./contracts/target/wasm32v1-none/release/project.wasm"
MULTISIG_DIR="./contracts/multisig"
MULTISIG_WASM_PATH="$MULTISIG_DIR/target/wasm32v1-none/release/multisig_treasury.wasm"
USDC_CONTRACT_ID="CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"
EURC_CONTRACT_ID=""
SOROSWAP_CONTRACT_ID=""
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
MULTISIG_THRESHOLD="${MULTISIG_THRESHOLD:-3}"
MULTISIG_LABEL="${MULTISIG_LABEL:-Global Treasury (Testnet)}"

CONTRACT_DIR="./contracts"
CONFIG_DIR="./shared/config"
OUTPUT_CONFIG="$CONFIG_DIR/accounts.local.json"
LABELS=(A B C D)
declare -A CONTRACT_IDS
MULTISIG_CONTRACT_ID=""

check_cli() {
  if ! command -v stellar &> /dev/null; then
    echo -e "${RED}stellar CLI not installed. Follow https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli${NC}"
    exit 1
  fi
}

export STELLAR_RPC_URL="$RPC_URL"
export STELLAR_NETWORK="$NETWORK"

check_cli

derive_public_key_for_signer() {
  local signer="$1"
  if [[ "$signer" =~ ^G[A-Z0-9]{55}$ ]]; then
    echo "$signer"
    return 0
  fi

  if [[ "$signer" =~ ^S[A-Z0-9]{55}$ ]]; then
    echo -e "${RED}ADMIN_PUBLIC_KEY must be set when ADMIN_SIGNER is provided as a secret key${NC}"
    exit 1
  fi

  stellar keys public-key "$signer"
}

if [[ -z "$ADMIN_PUBLIC_KEY" ]]; then
  ADMIN_PUBLIC_KEY=$(derive_public_key_for_signer "$ADMIN_SIGNER")
fi

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

pushd "$MULTISIG_DIR" >/dev/null
  echo -e "${YELLOW}Step 3: Building multisig contract${NC}"
  cargo clean
  stellar contract build
popd >/dev/null

if [[ ! -f "$MULTISIG_WASM_PATH" ]]; then
  echo -e "${RED}Compiled multisig WASM not found at $MULTISIG_WASM_PATH${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Build ready (${WASM_PATH})${NC}"

echo -e "${YELLOW}Step 4: Deploying contract instances${NC}"
for label in "${LABELS[@]}"; do
  echo "Deploying smart account $label..."
  deploy_output=$(stellar contract deploy \
    --wasm "$WASM_PATH" \
    --source-account "$SOURCE_ACCOUNT" \
    --network "$NETWORK" \
    --network-passphrase "$NETWORK_PASSPHRASE"
  )
  contract_id=$(echo "$deploy_output" | awk '/Contract Id/ {print $NF}' | tail -n1)
  if [[ -z "$contract_id" ]]; then
    contract_id=$(echo "$deploy_output" | grep -Eo 'C[A-Z0-9]{55}' | tail -n1 || true)
  fi
  if [[ -z "$contract_id" ]]; then
    echo -e "${RED}Failed to parse contract id for account $label${NC}"
    echo "$deploy_output"
    exit 1
  fi
  CONTRACT_IDS[$label]=$contract_id
  echo -e "  ${GREEN}Contract ID:${NC} $contract_id"
done

echo -e "${YELLOW}Step 5: Initializing accounts${NC}"
for label in "${LABELS[@]}"; do
  contract_id="${CONTRACT_IDS[$label]}"
  echo "Initializing $label ($contract_id)..."
  destinations=()
  for other in "${LABELS[@]}"; do
    if [[ "$other" != "$label" ]]; then
      destinations+=("${CONTRACT_IDS[$other]}")
    fi
  done
  destinations_json="["
  for idx in "${!destinations[@]}"; do
    if (( idx > 0 )); then
      destinations_json+=","
    fi
    destinations_json+="\"${destinations[$idx]}\""
  done
  destinations_json+="]"
  invoke_cmd=(
    stellar contract invoke
    --id "$contract_id"
    --source-account "$SOURCE_ACCOUNT"
    --sign-with-key "$ADMIN_SIGNER"
    --network "$NETWORK"
    --network-passphrase "$NETWORK_PASSPHRASE"
    -- init
    --admin "$ADMIN_PUBLIC_KEY"
    --token "$USDC_CONTRACT_ID"
    --destinations "$destinations_json"
  )
  invoke_cmd+=(--label "$label")
  "${invoke_cmd[@]}"
done

echo -e "${YELLOW}Step 6: Deploying multisig treasury${NC}"
echo "Deploying multisig wallet..."
multisig_output=$(stellar contract deploy \
  --wasm "$MULTISIG_WASM_PATH" \
  --source-account "$SOURCE_ACCOUNT" \
  --network "$NETWORK" \
  --network-passphrase "$NETWORK_PASSPHRASE"
)
MULTISIG_CONTRACT_ID=$(echo "$multisig_output" | awk '/Contract Id/ {print $NF}' | tail -n1)
if [[ -z "$MULTISIG_CONTRACT_ID" ]]; then
  MULTISIG_CONTRACT_ID=$(echo "$multisig_output" | grep -Eo 'C[A-Z0-9]{55}' | tail -n1 || true)
fi
if [[ -z "$MULTISIG_CONTRACT_ID" ]]; then
  echo -e "${RED}Failed to deploy multisig contract${NC}"
  echo "$multisig_output"
  exit 1
fi
echo -e "  ${GREEN}Multisig Contract ID:${NC} $MULTISIG_CONTRACT_ID"

signers_json="["
for idx in "${!LABELS[@]}"; do
  label=${LABELS[$idx]}
  if [[ $idx -gt 0 ]]; then
    signers_json+=","
  fi
  signers_json+="\"${CONTRACT_IDS[$label]}\""
done
signers_json+="]"

echo "Initializing multisig wallet..."
stellar contract invoke \
  --id "$MULTISIG_CONTRACT_ID" \
  --source-account "$SOURCE_ACCOUNT" \
  --sign-with-key "$ADMIN_SIGNER" \
  --network "$NETWORK" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- init \
  --admin "$ADMIN_PUBLIC_KEY" \
  --token "$USDC_CONTRACT_ID" \
  --signers "$signers_json" \
  --threshold "$MULTISIG_THRESHOLD" \
  --label "$MULTISIG_LABEL"

echo -e "${YELLOW}Step 7: Updating destinations with multisig${NC}"
for label in "${LABELS[@]}"; do
  contract_id="${CONTRACT_IDS[$label]}"
  destinations=()
  for other in "${LABELS[@]}"; do
    if [[ "$other" != "$label" ]]; then
      destinations+=("${CONTRACT_IDS[$other]}")
    fi
  done
  destinations+=("$MULTISIG_CONTRACT_ID")
  destinations_json="["
  for idx in "${!destinations[@]}"; do
    if (( idx > 0 )); then
      destinations_json+=","
    fi
    destinations_json+="\"${destinations[$idx]}\""
  done
  destinations_json+="]"
  echo "Updating destinations for $label..."
  stellar contract invoke \
    --id "$contract_id" \
    --source-account "$SOURCE_ACCOUNT" \
    --sign-with-key "$ADMIN_SIGNER" \
    --network "$NETWORK" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- update_destinations \
    --destinations "$destinations_json"
done

echo -e "${YELLOW}Step 8: Writing config to $OUTPUT_CONFIG${NC}"
mkdir -p "$CONFIG_DIR"
cat > "$OUTPUT_CONFIG" <<EOF
{
  "network": "${NETWORK^^}",
  "rpcUrl": "$RPC_URL",
  "usdcContractId": "$USDC_CONTRACT_ID",
  "eurcContractId": "$EURC_CONTRACT_ID",
  "soroswapContractId": "$SOROSWAP_CONTRACT_ID",
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
  },
  "multisig": {
    "contractId": "$MULTISIG_CONTRACT_ID",
    "label": "$MULTISIG_LABEL",
    "threshold": $MULTISIG_THRESHOLD
  }
}
EOF

echo -e "${GREEN}Deployment complete! Config written to $OUTPUT_CONFIG${NC}"
