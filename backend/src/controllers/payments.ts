import { Request, Response } from "express";
import { appConfig, TransferRequest, AdminWithdrawRequest, AccountLabel } from "../config.js";
import { fetchBalances, submitAdminWithdraw, submitTransfer } from "../lib/soroban.js";

type ApiResponse = {
  success: boolean;
  txHash?: string;
  explorerUrl?: string;
  error?: string;
};

const isLabel = (value: string): value is AccountLabel =>
  ["A", "B", "C", "D"].includes(value);

export async function handleTransfer(req: Request<unknown, unknown, TransferRequest>, res: Response<ApiResponse>) {
  try {
    const { from, to, amount } = req.body;
    if (!isLabel(from) || !isLabel(to)) {
      return res.status(400).json({ success: false, error: "Invalid account label" });
    }
    if (from === to) {
      return res.status(400).json({ success: false, error: "from and to must differ" });
    }
    const result = await submitTransfer({ from, to, amount });
    return res.json({ success: true, txHash: result.hash, explorerUrl: result.explorerUrl });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ success: false, error });
  }
}

export async function handleAdminWithdraw(
  req: Request<unknown, unknown, AdminWithdrawRequest>,
  res: Response<ApiResponse>
) {
  try {
    const { adminAuthToken, from, amount } = req.body;
    if (adminAuthToken !== appConfig.adminAuthToken) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    if (!isLabel(from)) {
      return res.status(400).json({ success: false, error: "Invalid account label" });
    }
    const result = await submitAdminWithdraw({ from, amount });
    return res.json({ success: true, txHash: result.hash, explorerUrl: result.explorerUrl });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ success: false, error });
  }
}

export async function handleBalances(_req: Request, res: Response) {
  try {
    const balances = await fetchBalances();
    res.json({ success: true, balances });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unable to load balances";
    res.status(500).json({ success: false, error });
  }
}
