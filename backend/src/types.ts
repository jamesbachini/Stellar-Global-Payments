export type AccountLabel = "A" | "B" | "C" | "D";

export type NetworkType = "TESTNET" | "MAINNET" | "FUTURENET" | "LOCALNET";

export type TransferDestination = AccountLabel | "MULTISIG";

export type TransferRequest = {
  from: AccountLabel;
  to: TransferDestination;
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

export type MultisigRequestRecord = {
  id: number;
  to: AccountLabel;
  amount: string;
  approvals: AccountLabel[];
  executed: boolean;
  initiator: AccountLabel;
  createdAt: number;
  completedAt?: number;
};

export type MultisigState = {
  balance: string;
  label: string;
  threshold: number;
  signers: AccountLabel[];
  requests: MultisigRequestRecord[];
};

export type MultisigWithdrawRequest = {
  initiator: AccountLabel;
  to: AccountLabel;
  amount: string;
};

export type MultisigApprovalRequest = {
  signer: AccountLabel;
  requestId: number;
};

export type ForexBalance = {
  account: AccountLabel;
  city: "New York" | "London";
  asset: "USDC" | "EURC";
  balance: string;
};

export type ForexBalanceMap = {
  newYork: ForexBalance;
  london: ForexBalance;
};

export type ForexQuoteDirection = "USDC_TO_EURC" | "EURC_TO_USDC";

export type SoroswapQuote = {
  id: string;
  amountIn: string;
  amountOut: string;
  assetIn: string;
  assetOut: string;
  tradeType: string;
  expiresAt?: string;
  expiration?: string;
  [key: string]: unknown;
};

export type ForexQuoteRequest = {
  direction: ForexQuoteDirection;
  amount: string;
};

export type ForexSwapRequest = {
  quote: SoroswapQuote;
};

export type ForexQuoteSummary = {
  amountIn: string;
  amountOut: string;
  rate: string;
  direction: ForexQuoteDirection;
  quoteId: string;
  expiresAt?: string;
  quote: SoroswapQuote;
};

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
