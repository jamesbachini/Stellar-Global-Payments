import express from "express";
import cors from "cors";
import { appConfig } from "./config.js";
import { handleAdminWithdraw, handleBalances, handleTransfer } from "./controllers/payments.js";
import { errorHandler, asyncHandler } from "./middleware/errorHandler.js";
import { requireAdminAuth } from "./middleware/auth.js";

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
