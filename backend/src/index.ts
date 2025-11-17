import express from "express";
import cors from "cors";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { appConfig } from "./config.js";
import { handleAdminWithdraw, handleBalances, handleTransfer } from "./controllers/payments.js";
import {
  handleForexBalances,
  handleForexQuote,
  handleForexSwap,
} from "./controllers/forex.js";
import {
  handleMultisigApprove,
  handleMultisigState,
  handleMultisigWithdraw,
} from "./controllers/multisig.js";
import { errorHandler, asyncHandler } from "./middleware/errorHandler.js";
import { requireAdminAuth } from "./middleware/auth.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    network: appConfig.network,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/balances", asyncHandler(handleBalances));

app.post("/api/transfer", asyncHandler(handleTransfer));

app.post("/api/admin/withdraw", requireAdminAuth, asyncHandler(handleAdminWithdraw));

app.get("/api/forex/balances", asyncHandler(handleForexBalances));
app.post("/api/forex/quote", asyncHandler(handleForexQuote));
app.post("/api/forex/swap", asyncHandler(handleForexSwap));

app.get("/api/multisig/state", asyncHandler(handleMultisigState));
app.post("/api/multisig/withdraw", asyncHandler(handleMultisigWithdraw));
app.post("/api/multisig/approve", asyncHandler(handleMultisigApprove));

// Serve static frontend files
const frontendDistPath = join(__dirname, "../../frontend/dist");
app.use(express.static(frontendDistPath));

// SPA fallback - serve index.html for all non-API routes
app.get("*", (_req, res) => {
  res.sendFile(join(frontendDistPath, "index.html"));
});

app.use(errorHandler);

const server = app.listen(appConfig.port, () => {
  console.log(`✓ Backend running on port ${appConfig.port}`);
  console.log(`✓ Network: ${appConfig.network}`);
  console.log(`✓ RPC URL: ${appConfig.rpcUrl}`);
});

process.on("SIGTERM", () => {
  console.log("\nReceived SIGTERM, shutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("\nReceived SIGINT, shutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
