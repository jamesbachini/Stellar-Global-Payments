import { config as loadEnv } from "dotenv";

loadEnv();

type AccountLabel = "A" | "B" | "C" | "D";

type AccountMapping = Record<AccountLabel, string>;

const required = [
  "NETWORK",
  "SOROBAN_RPC_URL",
  "ADMIN_PUBLIC_KEY",
  "ADMIN_SECRET_KEY",
  "USDC_CONTRACT_ID",
  "ADMIN_AUTH_TOKEN"
];

for (const key of required) {
  if (!process.env[key]) {
    console.warn(`Missing env var ${key}. Some functionality may not work until it is provided.`);
  }
}

export const appConfig = {
  port: Number(process.env.PORT || 4000),
  network: (process.env.NETWORK || "TESTNET") as "TESTNET" | "MAINNET" | "FUTURENET" | "LOCALNET",
  rpcUrl: process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org",
  adminPublicKey: process.env.ADMIN_PUBLIC_KEY || "",
  adminSecretKey: process.env.ADMIN_SECRET_KEY || "",
  adminAuthToken: process.env.ADMIN_AUTH_TOKEN || "",
  usdcContractId: process.env.USDC_CONTRACT_ID || "",
  explorerBaseUrl: process.env.EXPLORER_BASE_URL || "https://stellar.expert/explorer/testnet/tx/",
  accounts: {
    A: process.env.SMART_ACCOUNT_A || "",
    B: process.env.SMART_ACCOUNT_B || "",
    C: process.env.SMART_ACCOUNT_C || "",
    D: process.env.SMART_ACCOUNT_D || "",
  } satisfies AccountMapping,
};

export type AccountLabel = \"A\" | \"B\" | \"C\" | \"D\";

export type TransferRequest = {
  from: AccountLabel;
  to: AccountLabel;
  amount: string;
};

export type AdminWithdrawRequest = {
  from: AccountLabel;
  amount: string;
  adminAuthToken: string;
};
