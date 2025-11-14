import { config as loadEnv } from "dotenv";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { NetworkType } from "./types.js";

loadEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));

type AccountMapping = {
  A: string;
  B: string;
  C: string;
  D: string;
};

type SharedConfig = {
  network: string;
  rpcUrl: string;
  usdcContractId: string;
  adminPublicKey: string;
  accounts: AccountMapping;
};

class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    throw new ConfigurationError(
      `Required environment variable ${key} is missing or empty. ` +
        `Please check your .env file and ensure all required variables are set.`
    );
  }
  return value.trim();
}

function getEnv(key: string, defaultValue: string): string {
  return process.env[key]?.trim() || defaultValue;
}

function parseNetwork(value: string): NetworkType {
  const normalized = value.toUpperCase();
  if (
    normalized === "TESTNET" ||
    normalized === "MAINNET" ||
    normalized === "FUTURENET" ||
    normalized === "LOCALNET"
  ) {
    return normalized as NetworkType;
  }
  throw new ConfigurationError(
    `Invalid NETWORK value: ${value}. Must be one of: TESTNET, MAINNET, FUTURENET, LOCALNET`
  );
}

function loadSharedConfig(): SharedConfig {
  const sharedConfigPath = join(__dirname, "../../shared/config/accounts.local.json");
  try {
    const configData = readFileSync(sharedConfigPath, "utf-8");
    return JSON.parse(configData);
  } catch (error) {
    throw new ConfigurationError(
      `Failed to load shared configuration from ${sharedConfigPath}. ` +
        `Please ensure the deploy script has been run to generate this file.`
    );
  }
}

type AppConfig = {
  port: number;
  network: NetworkType;
  rpcUrl: string;
  adminPublicKey: string;
  adminSecretKey: string;
  adminAuthToken: string;
  usdcContractId: string;
  explorerBaseUrl: string;
  accounts: AccountMapping;
};

function loadConfig(): AppConfig {
  try {
    // Load shared configuration from deploy output
    const sharedConfig = loadSharedConfig();
    const network = parseNetwork(sharedConfig.network);

    // Only secrets come from environment variables
    const adminSecretKey = requireEnv("ADMIN_SECRET_KEY");
    const adminAuthToken = requireEnv("ADMIN_AUTH_TOKEN");

    // Allow optional overrides from environment
    const rpcUrl = getEnv("SOROBAN_RPC_URL", sharedConfig.rpcUrl);
    const usdcContractId = getEnv("USDC_CONTRACT_ID", sharedConfig.usdcContractId);
    const adminPublicKey = getEnv("ADMIN_PUBLIC_KEY", sharedConfig.adminPublicKey);

    return {
      port: Number(getEnv("PORT", "80")),
      network,
      rpcUrl,
      adminPublicKey,
      adminSecretKey,
      adminAuthToken,
      usdcContractId,
      explorerBaseUrl: getEnv(
        "EXPLORER_BASE_URL",
        network === "TESTNET"
          ? "https://stellar.expert/explorer/testnet/tx/"
          : "https://stellar.expert/explorer/public/tx/"
      ),
      accounts: sharedConfig.accounts,
    };
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error("\n❌ Configuration Error:");
      console.error(error.message);
      console.error("\nPlease ensure:");
      console.error("  1. You have run ./deploy.sh to generate shared/config/accounts.local.json");
      console.error("  2. Your .env file contains ADMIN_SECRET_KEY and ADMIN_AUTH_TOKEN");
      console.error("  3. Refer to .env.example for guidance\n");
    } else {
      console.error("\n❌ Unexpected error loading configuration:", error);
    }
    process.exit(1);
  }
}

export const appConfig: AppConfig = loadConfig();
