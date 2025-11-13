import express from "express";
import cors from "cors";
import { appConfig } from "./config.js";
import { handleAdminWithdraw, handleBalances, handleTransfer } from "./controllers/payments.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, network: appConfig.network });
});

app.get("/api/balances", handleBalances);
app.post("/api/transfer", handleTransfer);
app.post("/api/admin/withdraw", handleAdminWithdraw);

app.listen(appConfig.port, () => {
  console.log(`Backend listening on port ${appConfig.port}`);
});
