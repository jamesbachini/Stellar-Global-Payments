# Stellar Smart-Account Remittance Demo

This monorepo contains:

- **contracts/** – Soroban smart-account contract built on top of OpenZeppelin's Stellar accounts package. Includes a deployment helper to spin up four labelled accounts (A/B/C/D).
- **backend/** – TypeScript Express server that acts as the hot-wallet / relayer. It exposes transfer + admin withdrawal APIs and a helper endpoint to surface balances.
- **frontend/** – Vite + React experience with a stylized map visualization, transfer modal, and admin panel.
- **shared/** – Common configuration artifacts (e.g., generated smart-account IDs).

## Prerequisites

- Rust toolchain with `soroban-cli`
- Node.js 18+
- Yarn or npm (examples assume npm)
- Access to Stellar Soroban RPC (default points to mainnet)

## Contracts

```bash
cd contracts
cargo build --target wasm32-unknown-unknown --release
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

## Configuration & Flow

1. Deploy the contract once, creating four OpenZeppelin smart accounts labelled A/B/C/D with restricted USDC `transfer` contexts.
2. Store the generated contract IDs + admin public key in `.env` (backend) and optionally `shared/config/accounts.local.json` for reference.
3. Start the backend; it uses the admin key as a relayer to submit Soroban transactions on behalf of the smart accounts while enforcing the configured guardrails.
4. Start the frontend to visualize balances, pick corridors on the world map, and animate transfers with pending/progress + explorer links.

## Notes

- The smart account enforces destination allowlists and exposes an admin-only withdrawal method guarded by the OpenZeppelin policy context.
- Replace the placeholder USDC contract ID with the asset you wish to showcase.
- For production usage, front the backend with proper auth, rate-limiting, and secure secrets management; the provided setup is for demo use only.
