import { Request, Response } from "express";
import {
  ApiSuccessResponse,
  MultisigState,
  MultisigWithdrawRequest,
  MultisigApprovalRequest,
  TransactionResult,
} from "../types.js";
import {
  fetchMultisigState,
  submitMultisigWithdraw,
  submitMultisigApproval,
} from "../lib/soroban.js";
import { validateAccountLabel, validateAmount } from "../utils/validation.js";
import { ValidationError } from "../errors.js";

function validateRequestId(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new ValidationError("requestId must be a non-negative integer");
  }
  return value;
}

export async function handleMultisigState(
  _req: Request,
  res: Response<ApiSuccessResponse<MultisigState>>
) {
  const state = await fetchMultisigState();
  res.json({ success: true, data: state });
}

export async function handleMultisigWithdraw(
  req: Request<unknown, unknown, MultisigWithdrawRequest>,
  res: Response<ApiSuccessResponse<{ result: TransactionResult; state: MultisigState }>>
) {
  const initiator = validateAccountLabel(req.body.initiator, "initiator");
  const to = validateAccountLabel(req.body.to, "to");
  const amount = validateAmount(req.body.amount);

  const txResult = await submitMultisigWithdraw(initiator, to, amount);
  const state = await fetchMultisigState();

  res.json({
    success: true,
    data: {
      result: txResult,
      state,
    },
  });
}

export async function handleMultisigApprove(
  req: Request<unknown, unknown, MultisigApprovalRequest>,
  res: Response<ApiSuccessResponse<{ result: TransactionResult; state: MultisigState }>>
) {
  const signer = validateAccountLabel(req.body.signer, "signer");
  const requestId = validateRequestId(req.body.requestId);

  const txResult = await submitMultisigApproval(signer, requestId);
  const state = await fetchMultisigState();

  res.json({
    success: true,
    data: {
      result: txResult,
      state,
    },
  });
}
