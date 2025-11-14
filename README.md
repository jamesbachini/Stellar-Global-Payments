# Stellar Smart-Account Remittance Demo

This monorepo contains:

- **contracts/** – Soroban smart-account contract built on top of OpenZeppelin's Stellar accounts package. Includes a deployment helper to spin up four labelled accounts (A/B/C/D).
- **backend/** – TypeScript Express server that acts as the hot-wallet / relayer. It exposes transfer + admin withdrawal APIs and a helper endpoint to surface balances.
- **frontend/** – Vite + React experience with a stylized map visualization, transfer modal, and admin panel.
- **shared/** – Common configuration artifacts (e.g., generated smart-account IDs).

## Prerequisites

- Rust toolchain with `stellar-cli` (formerly `soroban-cli`)
- Node.js 18+ (examples use Node.js 24 via nvm)
- npm (examples assume npm)
- Access to Stellar Soroban RPC (default points to mainnet)
- A funded Stellar account for deployment and as relayer/admin

## Contracts

```bash
cd contracts
cargo build --target wasm32v1-none --release
```

The resulting `remittance_accounts.wasm` is consumed by the deployment script:

```bash
# Use the automated deployment script (mainnet by default)
./deploy.sh

# Or for testnet development:
./deploy_testnet.sh
```

The script produces `shared/config/accounts.local.json` with the four smart-account IDs and metadata.

## Backend

```bash
cd backend
npm install
cp .env.example .env # adjust values (admin secret, RPC URL, account IDs, etc.)
npm run dev
```

Key endpoints:

- `POST /api/transfer` – body `{ from, to, amount }`
- `POST /api/admin/withdraw` – body `{ from, amount, adminAuthToken }`
- `GET /api/balances` – helper used by the UI to show live token balances

## Frontend

```bash
cd frontend
npm install
npm run dev
```

The app hits the backend (proxied under `/api`) to trigger transfers or query balances. Route `/admin` activates the admin console for emergency withdrawals.

## Production Deployment

This section provides step-by-step instructions for deploying to a production server.

### 1. Server Setup

```bash
# Update system packages
sudo apt update

# Install git
sudo apt install git

# Install Node.js using nvm (recommended for version management)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

# Load nvm into current session
source ~/.nvm/nvm.sh

# Install Node.js 24
nvm install 24

# Clone the repository
cd ~
git clone https://github.com/jamesbachini/Stellar-Global-Payments.git
cd Stellar-Global-Payments
```

### 2. Deploy Smart Contracts

Before deploying, ensure you have:
- Stellar CLI installed (`stellar` command)
- A funded Stellar account configured with stellar CLI
- Sufficient XLM for deployment fees

```bash
# Generate or import your admin account (if not already done)
stellar keys generate admin --network mainnet

# Fund this account with XLM from an exchange or existing wallet

# Deploy all 4 smart account contracts
./deploy.sh
```

This will:
- Build the WASM contract
- Deploy 4 smart account instances (A, B, C, D)
- Initialize each with allowed destinations
- Generate `shared/config/accounts.local.json` with all contract IDs and configuration

### 3. Fund Smart Account Contracts

After deployment, you need to send USDC to each of the 4 smart account contract addresses:

```bash
# The contract addresses are in shared/config/accounts.local.json
# Send USDC mainnet tokens to each contract address:
# - CONTRACT_A_ID
# - CONTRACT_B_ID
# - CONTRACT_C_ID
# - CONTRACT_D_ID

# You can use Stellar Laboratory, a wallet, or the CLI to send USDC
# Example using stellar CLI:
stellar contract invoke \
  --id <USDC_CONTRACT_ID> \
  --source admin \
  --network mainnet \
  -- transfer \
  --from <YOUR_ADDRESS> \
  --to <CONTRACT_A_ID> \
  --amount 10000000  # 1 USDC (7 decimals)
```

Repeat for each of the 4 contracts (A, B, C, D).

### 4. Build Frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

This creates a production build in `frontend/dist/`.

### 5. Configure and Start Backend

```bash
cd backend
npm install

# Create .env file from example
cp .env.example .env
nano .env
```

Edit `.env` and configure only these **required** secrets:
```env
ADMIN_SECRET_KEY=<your_admin_secret_key>
ADMIN_AUTH_TOKEN=<generate_with_openssl_rand_hex_32>
```

All other configuration (network, RPC URL, contract IDs) is automatically loaded from `shared/config/accounts.local.json`.

Build the backend:
```bash
npm run build
```

### 6. Configure Node.js for Port 80 (Optional)

If you want to run the backend on port 80 (default HTTP port), grant Node.js permission:

```bash
sudo setcap 'cap_net_bind_service=+ep' $(which node)
```

Then update `backend/src/index.ts` to use port 80, or set `PORT=80` in your `.env`.

### 7. Start the Backend

```bash
npm start
```

The backend will:
- Serve the frontend static files from `../frontend/dist/`
- Expose API endpoints at `/api/*`
- Run on the configured port (default: 4000, or 80 if configured)

### 8. Configure Auto-Restart (Optional)

To automatically start the server on system reboot:

```bash
npm install -g pm2
cd ~/Stellar-Global-Payments/backend
pm2 start npm --name "stellar-backend" -- start
```

Save and exit. The backend will now start automatically on server reboot.

### Verification

1. Open your browser to `http://your-server-ip` (or `http://your-server-ip:4000` if using default port)
2. You should see the world map with 4 account markers
3. Check that balances are displayed correctly
4. Test a transfer between accounts
5. Verify the transaction on the Stellar explorer

## Configuration & Flow

1. Deploy the contract once, creating four OpenZeppelin smart accounts labelled A/B/C/D with restricted USDC `transfer` contexts.
2. Store the generated contract IDs + admin public key in `.env` (backend) and optionally `shared/config/accounts.local.json` for reference.
3. Start the backend; it uses the admin key as a relayer to submit Soroban transactions on behalf of the smart accounts while enforcing the configured guardrails.
4. Start the frontend to visualize balances, pick corridors on the world map, and animate transfers with pending/progress + explorer links.

## Notes

- The smart account enforces destination allowlists and exposes an admin-only withdrawal method guarded by the OpenZeppelin policy context.
- Replace the placeholder USDC contract ID with the asset you wish to showcase.
- For production usage, front the backend with proper auth, rate-limiting, and secure secrets management; the provided setup is for demo use only.
