import { Networks } from "@stellar/stellar-sdk";
import { NetworkType } from "./types.js";

export const USDC_DECIMALS = 7;

export const ACCOUNT_LABELS = ["A", "B", "C", "D"] as const;

export const TRANSACTION_CONFIG = {
  FEE: "60000",
  TIMEOUT: 120,
} as const;

export const NETWORK_PASSPHRASES: Record<NetworkType, string> = {
  MAINNET: Networks.PUBLIC,
  TESTNET: Networks.TESTNET,
  FUTURENET: "Test SDF Future Network ; October 2022",
  LOCALNET: "Standalone Network ; February 2017",
};

export const DEFAULT_EXPLORER_URLS: Record<NetworkType, string> = {
  TESTNET: "https://stellar.expert/explorer/testnet/tx/",
  MAINNET: "https://stellar.expert/explorer/public/tx/",
  FUTURENET: "https://stellar.expert/explorer/futurenet/tx/",
  LOCALNET: "http://localhost:8000/tx/",
};

export const ERROR_CODES = {
  INVALID_INPUT: "INVALID_INPUT",
  UNAUTHORIZED: "UNAUTHORIZED",
  TRANSACTION_FAILED: "TRANSACTION_FAILED",
  NETWORK_ERROR: "NETWORK_ERROR",
  CONFIGURATION_ERROR: "CONFIGURATION_ERROR",
  BALANCE_FETCH_FAILED: "BALANCE_FETCH_FAILED",
} as const;
