import bigInt, { BigInteger } from "big-integer";
import { USDC_DECIMALS } from "../constants.js";

const TEN = bigInt(10);
const MULTIPLIER = TEN.pow(USDC_DECIMALS);

export function toI128(amount: string): BigInteger {
  if (!amount) return bigInt.zero;

  const [whole, frac = ""] = amount.split(".");
  const fracPadded = (frac + "0".repeat(USDC_DECIMALS)).slice(0, USDC_DECIMALS);

  return bigInt(whole || "0")
    .multiply(MULTIPLIER)
    .add(bigInt(fracPadded));
}

export function fromI128(value: BigInteger): string {
  const raw = value.toString();
  const negative = raw.startsWith("-");
  const digits = negative ? raw.slice(1) : raw;
  const padded = digits.padStart(USDC_DECIMALS + 1, "0");

  const integer = padded.slice(0, -USDC_DECIMALS);
  const fraction = padded.slice(-USDC_DECIMALS).replace(/0+$/, "");

  const formatted = fraction ? `${integer}.${fraction}` : integer;
  return negative ? `-${formatted}` : formatted;
}
