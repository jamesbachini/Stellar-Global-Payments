# Stellar Global Payments - Backend

Node.js + TypeScript + Express backend that acts as a hot wallet/relayer for submitting transactions to Stellar smart accounts.

## Quick Start

### 1. Prerequisites

- Node.js 18+ installed
- Contracts deployed (run `../deploy.sh` from repo root)
- Admin account with secret key

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Secrets

Create a `.env` file with **only 2 required secrets**:

```bash
# Copy example and edit
cp .env.example .env
```

Then edit `.env` and set:

```env
ADMIN_SECRET_KEY=SA...YOUR_SECRET_KEY_HERE
ADMIN_AUTH_TOKEN=your_random_secure_token_here
```

Generate a secure auth token:
```bash
openssl rand -hex 32
```

### 4. Run

```bash
# Development mode (auto-restart)
npm run dev

# Production build
npm run build
npm start
```

## 5. Recover funds

Setup a trustline, change the source account

```bash
stellar tx new change-trust \
--source james \
--line USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN \
--network mainnet \
--rpc-url https://rpc.lightsail.network/ \
--network-passphrase "Public Global Stellar Network ; September 2015"
```

Then go to /admin and withdraw using the ADMIN_AUTH_TOKEN in ./backend/.env

## Configuration Architecture

The backend uses a **shared configuration file** to eliminate duplicate settings:

### Auto-Loaded from `../shared/config/accounts.local.json`:
- Network (TESTNET/MAINNET/etc)
- RPC URL
- USDC contract ID
- Admin public key
- All 4 smart account contract IDs (A, B, C, D)

### Required in `.env` (secrets only):
- `ADMIN_SECRET_KEY` - Admin account secret key
- `ADMIN_AUTH_TOKEN` - API authentication token

### Optional Overrides (in `.env`):
- `PORT` - Server port (default: 4000)
- `SOROBAN_RPC_URL` - Override RPC endpoint
- `USDC_CONTRACT_ID` - Override USDC contract
- `ADMIN_PUBLIC_KEY` - Override admin public key
- `EXPLORER_BASE_URL` - Override block explorer URL

This design ensures:
✅ Single source of truth for deployment config
✅ Secrets stay in `.env` (never committed)
✅ No duplicate configuration across files
✅ Easy to redeploy contracts without updating multiple files

## API Endpoints

### Public Endpoints

**GET /api/balances**
- Returns USDC balances for all 4 accounts

**POST /api/transfer**
- Transfer USDC between accounts A-D
- Body: `{ from: "A", to: "B", amount: "10.5" }`

### Admin Endpoints (require `X-Auth-Token` header)

**POST /api/admin/withdraw**
- Withdraw USDC from any account to admin address
- Body: `{ account: "A", amount: "5.0" }`
- Requires header: `X-Auth-Token: <ADMIN_AUTH_TOKEN>`

## Key Modules

- **`src/config.ts`** - Loads configuration from shared file + environment
- **`src/lib/soroban.ts`** - All Stellar/Soroban transaction logic
- **`src/controllers/payments.ts`** - API endpoint handlers
- **`src/index.ts`** - Express server setup

## Troubleshooting

### "Failed to load shared configuration"
- Ensure you've run `./deploy.sh` from repo root
- Check that `../shared/config/accounts.local.json` exists

### "Required environment variable ADMIN_SECRET_KEY is missing"
- Create a `.env` file based on `.env.example`
- Set both `ADMIN_SECRET_KEY` and `ADMIN_AUTH_TOKEN`

### Transaction failures
- Ensure admin account has XLM for fees
- Ensure smart accounts have USDC balance
- Check destination is in the allowed whitelist
