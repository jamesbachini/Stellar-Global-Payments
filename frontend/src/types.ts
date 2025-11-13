export type AccountLabel = "A" | "B" | "C" | "D";

export type TransferPayload = {
  from: AccountLabel;
  to: AccountLabel;
  amount: string;
};

export type TransferResponse = {
  success: boolean;
  txHash?: string;
  explorerUrl?: string;
  error?: string;
};

export type BalancesResponse = {
  success: boolean;
  balances: Record<AccountLabel, string>;
  error?: string;
};

export type AccountMeta = {
  label: AccountLabel;
  title: string;
  region: string;
  position: { top: string; left: string };
  accent: string;
};
