# Changelog

## 2025-11-13 - Configuration Simplification & Responsive Frontend

### Configuration Simplification ✨

**Problem**: The backend required 11+ environment variables in `.env`, creating duplicate configuration and potential for errors during deployment.

**Solution**: Refactored backend to use `shared/config/accounts.local.json` as the single source of truth.

**Changes**:
- `backend/src/config.ts`: Now loads most config from shared file automatically
- `backend/.env.example`: Simplified to require only 2 secrets:
  - `ADMIN_SECRET_KEY` - Admin account secret key
  - `ADMIN_AUTH_TOKEN` - API authentication token
- All deployment-specific config (network, RPC, contract IDs) auto-loaded from shared file
- Optional overrides still possible via environment variables

**Benefits**:
- ✅ Single source of truth for deployment configuration
- ✅ Secrets stay in `.env` (never committed to git)
- ✅ No duplicate configuration across files
- ✅ Easier redeployment - just run `./deploy.sh` and the backend picks up new contract IDs

### Frontend Redesign 🎨

**Responsive & Iframe-Ready**

**Changes**:
- `frontend/src/styles/global.css`: Complete responsive redesign
  - Changed from `min-height: 100vh` to `width: 100%; height: 100%` for true full-screen in iframes
  - All sizing uses `clamp()` for fluid scaling across screen sizes
  - Responsive breakpoints: mobile (360px), tablet (768px), desktop (1920px+)
  - Smooth animations and transitions on all interactive elements

- `frontend/src/components/AccountMarker.tsx`: Updated button text to **"SEND USDC"**

- `frontend/iframe-test.html`: Testing page to demo responsive behavior at various sizes

**Features**:
- ✅ Full-screen map with no wasted space
- ✅ Works in any iframe size (320px to 4K displays)
- ✅ Fluid typography and spacing using CSS clamp()
- ✅ Glassmorphic design with backdrop blur
- ✅ Accessible focus states and proper contrast

### Developer Experience 🛠️

**Backend**:
- Replaced `ts-node-dev` with `tsx` for better ES module support
- Added `backend/README.md` with clear setup instructions
- Updated `CLAUDE.md` with simplified deployment flow

**Testing**:
- Backend API: http://localhost:4000/api/balances
- Frontend: http://localhost:5173
- Iframe test: Open `frontend/iframe-test.html` in browser

### Migration Guide

If you have an existing `.env` file with the old format:

**Old format (11+ variables)**:
```env
NETWORK=TESTNET
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
ADMIN_PUBLIC_KEY=GD...
ADMIN_SECRET_KEY=SA...
USDC_CONTRACT_ID=CB...
SMART_ACCOUNT_A=CA...
SMART_ACCOUNT_B=CB...
SMART_ACCOUNT_C=CC...
SMART_ACCOUNT_D=CD...
EXPLORER_BASE_URL=...
ADMIN_AUTH_TOKEN=...
```

**New format (2 required secrets)**:
```env
ADMIN_SECRET_KEY=SA...YOUR_SECRET_KEY
ADMIN_AUTH_TOKEN=your_random_secure_token
```

Everything else is auto-loaded from `shared/config/accounts.local.json` ✨
