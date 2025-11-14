import { AccountLabel } from "../types.js";
import { ValidationError } from "../errors.js";
import { ACCOUNT_LABELS } from "../constants.js";

export function isAccountLabel(value: unknown): value is AccountLabel {
  return typeof value === "string" && ACCOUNT_LABELS.includes(value as AccountLabel);
}

export function validateAccountLabel(value: unknown, fieldName: string): AccountLabel {
  if (!isAccountLabel(value)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${ACCOUNT_LABELS.join(", ")}. Received: ${value}`
    );
  }
  return value;
}

export function validateAmount(amount: unknown): string {
  if (typeof amount !== "string") {
    throw new ValidationError("Amount must be a string");
  }

  if (amount.trim() === "") {
    throw new ValidationError("Amount cannot be empty");
  }

  const amountRegex = /^\d+(\.\d+)?$/;
  if (!amountRegex.test(amount)) {
    throw new ValidationError(
      "Amount must be a valid positive number (e.g., '1.5', '100', '0.01')"
    );
  }

  const numericAmount = parseFloat(amount);

  if (numericAmount <= 0) {
    throw new ValidationError("Amount must be greater than zero");
  }

  if (numericAmount > 1e15) {
    throw new ValidationError("Amount is too large");
  }

  const decimalParts = amount.split(".");
  if (decimalParts.length === 2 && decimalParts[1].length > 7) {
    throw new ValidationError("Amount cannot have more than 7 decimal places");
  }

  return amount;
}

export function validateDifferentAccounts(from: AccountLabel, to: AccountLabel): void {
  if (from === to) {
    throw new ValidationError("Source and destination accounts must be different");
  }
}

export function validateAuthToken(provided: string, expected: string): void {
  if (!provided || provided.trim() === "") {
    throw new ValidationError("Authorization token is required");
  }

  if (provided !== expected) {
    throw new ValidationError("Invalid authorization token");
  }
}
