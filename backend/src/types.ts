export type AccountLabel = "A" | "B" | "C" | "D";

export type NetworkType = "TESTNET" | "MAINNET" | "FUTURENET" | "LOCALNET";

export type TransferRequest = {
  from: AccountLabel;
  to: AccountLabel;
  amount: string;
};

export type AdminWithdrawRequest = {
  from: AccountLabel;
  amount: string;
};

export type TransactionResult = {
  hash: string;
  explorerUrl: string;
};

export type BalanceMap = Record<AccountLabel, string>;

export type ApiSuccessResponse<T = unknown> = {
  success: true;
  data: T;
};

export type ApiErrorResponse = {
  success: false;
  error: {
    message: string;
    code: string;
  };
};

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
