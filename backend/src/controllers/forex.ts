import { Request, Response } from "express";
import {
  ApiSuccessResponse,
  ForexBalanceMap,
  ForexQuoteRequest,
  ForexQuoteSummary,
  ForexSwapRequest,
  TransactionResult,
} from "../types.js";
import { fetchForexBalances } from "../lib/soroban.js";
import { requestForexQuote, submitForexSwap } from "../lib/forex.js";
import { validateAmount, validateForexDirection } from "../utils/validation.js";
import { ValidationError } from "../errors.js";

export async function handleForexBalances(
  _req: Request,
  res: Response<ApiSuccessResponse<ForexBalanceMap>>
) {
  const balances = await fetchForexBalances();
  res.json({ success: true, data: balances });
}

export async function handleForexQuote(
  req: Request<unknown, unknown, ForexQuoteRequest>,
  res: Response<ApiSuccessResponse<ForexQuoteSummary>>
) {
  const direction = validateForexDirection(req.body.direction);
  const amount = validateAmount(req.body.amount);

  const summary = await requestForexQuote(direction, amount);
  res.json({ success: true, data: summary });
}

export async function handleForexSwap(
  req: Request<unknown, unknown, ForexSwapRequest>,
  res: Response<ApiSuccessResponse<TransactionResult>>
) {
  const { quote } = req.body;
  if (!quote || typeof quote !== "object") {
    throw new ValidationError("quote payload is required to submit a forex swap");
  }

  const result = await submitForexSwap(quote);
  res.json({ success: true, data: result });
}
