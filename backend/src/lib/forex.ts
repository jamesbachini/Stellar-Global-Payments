import { randomUUID } from "crypto";
import bigInt from "big-integer";
import { appConfig } from "../config.js";
import { ForexQuoteDirection, ForexQuoteSummary, SoroswapQuote, TransactionResult } from "../types.js";
import { soroswapClient } from "./soroswap.js";
import { ValidationError } from "../errors.js";
import { toI128, fromI128 } from "../utils/currency.js";
import { submitForexTransfer } from "./soroban.js";

function getAssetsForDirection(direction: ForexQuoteDirection) {
  if (direction === "USDC_TO_EURC") {
    return {
      assetIn: appConfig.usdcContractId,
      assetOut: appConfig.forex.eurcContractId,
    };
  }
  return {
    assetIn: appConfig.forex.eurcContractId,
    assetOut: appConfig.usdcContractId,
  };
}

function determineDirectionFromQuote(quote: SoroswapQuote): ForexQuoteDirection {
  const { usdcContractId } = appConfig;
  const { eurcContractId } = appConfig.forex;

  if (quote.assetIn === usdcContractId && quote.assetOut === eurcContractId) {
    return "USDC_TO_EURC";
  }

  if (quote.assetIn === eurcContractId && quote.assetOut === usdcContractId) {
    return "EURC_TO_USDC";
  }

  throw new ValidationError("Quote does not match supported forex pairs");
}

function formatRate(amountIn: string, amountOut: string): string {
  const inValue = parseFloat(amountIn);
  const outValue = parseFloat(amountOut);

  if (!Number.isFinite(inValue) || inValue === 0) {
    return "0.000000";
  }

  const rate = outValue / inValue;
  return rate.toFixed(6);
}

export async function requestForexQuote(
  direction: ForexQuoteDirection,
  amount: string
): Promise<ForexQuoteSummary> {
  const { assetIn, assetOut } = getAssetsForDirection(direction);
  const atomicAmount = toI128(amount).toString();

  const quote = await soroswapClient.getQuote(assetIn, assetOut, atomicAmount);

  if (!quote.amountOut) {
    throw new ValidationError("Soroswap quote did not return an amountOut value");
  }

  const amountIn = fromI128(bigInt(quote.amountIn || atomicAmount));
  const amountOut = fromI128(bigInt(quote.amountOut));
  const quoteDirection = determineDirectionFromQuote(quote);
  const quoteId = typeof quote.id === "string" && quote.id.length > 0 ? quote.id : randomUUID();

  return {
    amountIn,
    amountOut,
    rate: formatRate(amountIn, amountOut),
    direction: quoteDirection,
    quoteId,
    expiresAt: (quote.expiresAt || quote.expiration) as string | undefined,
    quote,
  };
}

export async function submitForexSwap(quote: SoroswapQuote): Promise<TransactionResult> {
  const direction = determineDirectionFromQuote(quote);
  if (!quote.amountIn || !quote.amountOut) {
    throw new ValidationError("Quote is missing amount information");
  }

  const amountIn = fromI128(bigInt(quote.amountIn));
  const minAmountOut = fromI128(bigInt(quote.amountOut));
  const deadline = Math.floor(Date.now() / 1000) + 300;

  const fromLabel =
    direction === "USDC_TO_EURC"
      ? appConfig.forex.usdcAccountLabel
      : appConfig.forex.eurcAccountLabel;
  const toLabel =
    direction === "USDC_TO_EURC"
      ? appConfig.forex.eurcAccountLabel
      : appConfig.forex.usdcAccountLabel;

  return submitForexTransfer(fromLabel, toLabel, direction, amountIn, minAmountOut, deadline);
}
