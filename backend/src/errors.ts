import { ERROR_CODES } from "./constants.js";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string = ERROR_CODES.NETWORK_ERROR,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, ERROR_CODES.INVALID_INPUT, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, ERROR_CODES.UNAUTHORIZED, 401);
  }
}

export class TransactionError extends AppError {
  constructor(message: string, public readonly txHash?: string) {
    super(message, ERROR_CODES.TRANSACTION_FAILED, 500);
  }
}

export class NetworkError extends AppError {
  constructor(message: string) {
    super(message, ERROR_CODES.NETWORK_ERROR, 503);
  }
}

export class BalanceFetchError extends AppError {
  constructor(message: string, public readonly failedAccounts?: string[]) {
    super(message, ERROR_CODES.BALANCE_FETCH_FAILED, 500);
  }
}
