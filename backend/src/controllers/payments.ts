import { Request, Response } from "express";
import {
  ApiSuccessResponse,
  TransactionResult,
  BalanceMap,
  TransferRequest,
  AdminWithdrawRequest,
} from "../types.js";
import { fetchBalances, submitAdminWithdraw, submitTransfer } from "../lib/soroban.js";
import {
  validateAccountLabel,
  validateAmount,
  validateDifferentAccounts,
} from "../utils/validation.js";

export async function handleBalances(
  _req: Request,
  res: Response<ApiSuccessResponse<{ balances: BalanceMap }>>
) {
  const balances = await fetchBalances();
  res.json({ success: true, data: { balances } });
}

export async function handleTransfer(
  req: Request<unknown, unknown, TransferRequest>,
  res: Response<ApiSuccessResponse<TransactionResult>>
) {
  const from = validateAccountLabel(req.body.from, "from");
  const to = validateAccountLabel(req.body.to, "to");
  const amount = validateAmount(req.body.amount);

  validateDifferentAccounts(from, to);

  const result = await submitTransfer(from, to, amount);

  res.json({ success: true, data: result });
}

export async function handleAdminWithdraw(
  req: Request<unknown, unknown, AdminWithdrawRequest>,
  res: Response<ApiSuccessResponse<TransactionResult>>
) {
  const from = validateAccountLabel(req.body.from, "from");
  const amount = validateAmount(req.body.amount);

  const result = await submitAdminWithdraw(from, amount);

  res.json({ success: true, data: result });
}
