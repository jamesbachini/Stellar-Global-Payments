export type AccountLabel = "A" | "B" | "C" | "D";

export type ForexDirection = "USDC_TO_EURC" | "EURC_TO_USDC";

export type TransferTarget = AccountLabel | "MULTISIG";

export type TransferPayload = {
  from: AccountLabel;
  to: TransferTarget;
  amount: string;
};

export type TransactionResult = {
  hash: string;
  explorerUrl: string;
};

export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiError = {
  success: false;
  error: string | { message: string; code?: string };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export type TransferResponse = ApiResponse<TransactionResult>;

export type BalancesResponse = ApiResponse<{
  balances: Record<AccountLabel, string>;
}>;

export type MultisigRequest = {
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
  requests: MultisigRequest[];
};

export type MultisigStateResponse = ApiResponse<MultisigState>;

export type MultisigWithdrawPayload = {
  initiator: AccountLabel;
  to: AccountLabel;
  amount: string;
};

export type MultisigApprovalPayload = {
  signer: AccountLabel;
  requestId: number;
};

export type MultisigActionResponse = ApiResponse<{
  result: TransactionResult;
  state: MultisigState;
}>;

export type MarkerLabel = AccountLabel | "MULTISIG";

export type AccountMeta = {
  label: MarkerLabel;
  title: string;
  region: string;
  position: { top: string; left: string };
  accent: string;
  asset?: string;
  ctaLabel?: string;
  kind?: "wallet" | "multisig";
};

export type ForexLocation = "NEW_YORK" | "LONDON";

export type ForexBalance = {
  account: AccountLabel;
  city: "New York" | "London";
  asset: "USDC" | "EURC";
  balance: string;
};

export type ForexBalances = {
  newYork: ForexBalance;
  london: ForexBalance;
};

export type ForexBalancesResponse = ApiResponse<ForexBalances>;

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

export type ForexQuoteSummary = {
  amountIn: string;
  amountOut: string;
  rate: string;
  direction: ForexDirection;
  quoteId: string;
  expiresAt?: string;
  quote: SoroswapQuote;
};

export type ForexQuoteResponse = ApiResponse<ForexQuoteSummary>;
