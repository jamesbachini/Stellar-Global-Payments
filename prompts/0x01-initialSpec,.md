You are an expert Stellar Soroban, Rust, and TypeScript/React full-stack engineer.

Your task: generate a complete demo application that showcases Stellar payments using OpenZeppelin’s Stellar smart-account library.

The demo requirements are:

HIGH-LEVEL DESCRIPTION
----------------------
We want a “remittance” / “payments” demo we can embed on a product page.

Concept:
- There are 4 smart accounts (A, B, C, D) on Stellar, implemented using OpenZeppelin’s `accounts` package for Soroban.
- These 4 smart accounts each hold USDC balances.
- From the front end, a user can trigger a remittance: sending USDC from one of the 4 smart accounts to any of the other 3, but **never to any other address**.
- There is also an admin-only path to withdraw funds from each of the 4 smart accounts back to a single admin account.
- The user never has direct access to any secret keys; transactions are executed by a backend “hot wallet” / server that controls the smart accounts (or calls a relayer).
- The front end shows the 4 accounts on a world map (different countries), animates transfers, shows a loading bar while the transaction is pending, and, on success, shows a link to a blockchain explorer for that transaction.

STACK & PROJECT STRUCTURE
-------------------------
Use this stack:

- Smart contracts:
  - Language: Rust
  - Framework: Soroban SDK
  - Library: OpenZeppelin Stellar contracts (accounts package)
  - Target: Soroban / Stellar contracts compatible with the 0.5.x OpenZeppelin release line
- Backend:
  - Node.js (TypeScript)
  - Framework: Express (or minimal HTTP server) that exposes REST endpoints for:
    - Triggering a transfer from Account X to Account Y
    - Admin withdrawals back to an admin account
- Frontend:
  - React + TypeScript
  - Build tool: Vite
  - Styling: simple CSS or Tailwind, your choice (keep it lightweight)

Project structure (monorepo):

- `contracts/`
  - Soroban smart contracts + Cargo.toml
- `backend/`
  - Node.js/TypeScript Express server
- `frontend/`
  - React + Vite app

Output all code as a multi-file project using this format:

- For each file, start with a header line:
  `--- FILE: relative/path/from/repo/root ---`
- Then the full contents of that file.
- Do this for all important files: Cargo.toml, Rust sources, package.json, tsconfig, vite config, React components, server code, etc.
- At the end, include a `--- FILE: README.md ---` with instructions.

SMART ACCOUNT DESIGN
--------------------
Use OpenZeppelin’s Stellar `accounts` package (smart account framework) to implement 4 smart accounts that:

- Are “smart accounts” implementing `CustomAccountInterface` as per OZ docs.
- Hold USDC balances using a standard Soroban fungible token (assume an existing USDC token contract; accept its contract ID as a config parameter).
- Enforce the following rules:

  1. Each of the 4 smart accounts (A, B, C, D) can only:
     - Initiate `transfer` calls on the USDC token contract
     - With `to` restricted to be **one of the other 3 smart account addresses** (no other recipients allowed).
  2. No outgoing transfer is allowed to any arbitrary address other than the 4 smart accounts (for the regular user flow).
  3. There is an **admin withdraw mechanism** that allows an admin account to withdraw funds from each smart account back to a single admin G-address.

Implementation details:

- Use OZ’s context rules / policies model for smart accounts:
  - Define context rules so that the only permitted token call from each smart account is `transfer` on the USDC contract to a restricted set of destinations `[A, B, C, D]`.
  - For admin withdrawal, define a separate context / policy that:
    - Only the admin signer (a specific G-address) can invoke.
    - Allows the admin to trigger a sweep or partial withdrawal to the admin G-address.

- Provide a small “manager / deployment” script (Rust or TypeScript) that:
  - Deploys the smart account code.
  - Instantiates 4 smart account instances (A, B, C, D).
  - Configures their allowed destination sets.
  - Stores their contract IDs in a JSON config used by the backend and frontend.

- Config:
  - Make network (testnet vs mainnet), RPC URL, USDC contract ID, admin account, and smart account IDs configurable via environment variables or a JSON config file (for the demo you can assume testnet by default).

BACKEND API
-----------
Create a simple Node.js/TypeScript backend in `backend/` with:

- `package.json`, `tsconfig.json`, and a simple Express app.
- Environment variables in `.env` for:
  - `NETWORK` (e.g. `TESTNET`)
  - `SOROBAN_RPC_URL`
  - `ADMIN_SECRET_KEY` (secret key with permission to manage / call the smart accounts or an account that acts as a relayer)
  - Smart account IDs for A, B, C, D
  - USDC contract ID

Expose endpoints like:

1. `POST /api/transfer`
   - Request body: `{ from: "A" | "B" | "C" | "D", to: "A" | "B" | "C" | "D", amount: string }`
   - Server will:
     - Validate that `from` != `to` and both are among A,B,C,D.
     - Build a transaction that:
       - Uses the relevant smart account as the `from` address, calling the USDC `transfer` function to the destination smart account.
       - Uses the admin / relayer account to submit the transaction and satisfy the smart account’s authorization (using OZ’s smart account invocation pattern).
     - Submit the transaction via Soroban RPC.
     - Return JSON response `{ success: boolean, txHash?: string, explorerUrl?: string, error?: string }`.

2. `POST /api/admin/withdraw`
   - Request body: `{ from: "A" | "B" | "C" | "D", amount: string, adminAuthToken: string }`
   - Simple admin auth:
     - Require `adminAuthToken` to match some secret in environment variables for demo purposes.
   - On success, build and submit a transaction that:
     - Calls the smart account to transfer USDC from that account to the admin G-address, using the admin withdrawal context/policy.
   - Return JSON with tx hash and explorer URL.

Implementation details:

- Use official Stellar / Soroban JS SDKs to:
  - Build and submit transactions.
  - Call simulated functions as necessary.
- Handle basic error cases and serialize them for the frontend.

FRONTEND UI
-----------
Build a React + TypeScript app in `frontend/` with Vite, including:

General:
- A landing page that shows:
  - A stylized world map background (CSS image or simple SVG – no need for complex map libraries).
  - Four account markers (A, B, C, D) positioned in different “countries” (e.g., US, EU, LatAm, APAC) for visual effect.
  - Each marker shows:
    - Account label (A, B, C, D)
    - Current USDC balance (fetched from rpc node).

Transfer flow:
- When the user clicks on an account that has a positive balance:
  - Open a panel/modal labeled “Send USDC from Account X”.
  - UI elements:
    - “From” (readonly: A/B/C/D, depending on which was clicked).
    - “To” dropdown containing only the other 3 accounts.
    - Amount input (default to `1` USDC; allow user to change).
    - “Send” button.

- On clicking “Send”:
  - Call `POST /api/transfer` with `{ from, to, amount }`.
  - Show a loading bar / animated progress indicator while waiting.
  - Disable the form while the transaction is pending.

- On success:
  - Show a success message such as “Transfer complete!”
  - Provide a link button: “View on Explorer” that opens `explorerUrl` in a new tab.
  - Refresh the displayed balances (call rpc node again).

- On error:
  - Show a user-friendly error message (e.g., “Transaction failed: ${error}”).
  - Allow retry.

Admin page:
- Route `/admin` (e.g., via React Router or a simple conditional on a query param).
- Simple form:
  - Select `from` account (A/B/C/D).
  - Input `amount`.
  - Input `adminAuthToken`.
  - Button “Withdraw to Admin”.
- On submit:
  - Call `POST /api/admin/withdraw`.
  - Show status, loading bar, and explorer link just like the main flow.

Other UI requirements:
- Keep UI visually appealing but simple.
- Use responsive layout so it can be embedded inside an iframe or CMS block.
