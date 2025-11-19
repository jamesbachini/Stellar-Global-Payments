import { config as loadEnv } from "dotenv";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { NetworkType, AccountLabel } from "./types.js";
import { ACTIVE_NETWORK } from "../../shared/config/network.js";

loadEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));

type AccountMapping = {
  A: string;
  B: string;
  C: string;
  D: string;
};

type MultisigSharedConfig = {
  contractId: string;
  label?: string;
  threshold?: number;
};

const DEFAULT_EURC_CONTRACT_ID = "CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV";

type SharedConfig = {
  network: string;
  rpcUrl: string;
  usdcContractId: string;
  eurcContractId?: string;
  soroswapContractId?: string;
  adminPublicKey: string;
  accounts: AccountMapping;
  multisig?: MultisigSharedConfig;
};

type SoroswapConfig = {
  apiKey: string;
  baseUrl: string;
  network: "mainnet" | "testnet";
  protocols: string[];
};

type ForexQuoteAssets = {
  usdcContractId: string;
  eurcContractId: string;
};

type ForexConfig = {
  eurcContractId: string;
  usdcAccountLabel: AccountLabel;
  eurcAccountLabel: AccountLabel;
  soroswap: SoroswapConfig;
  quoteAssets: ForexQuoteAssets;
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

function parseSoroswapNetwork(value: string): "mainnet" | "testnet" {
  const normalized = value.toLowerCase();
  if (normalized === "mainnet" || normalized === "testnet") {
    return normalized;
  }
  throw new ConfigurationError(
    `Invalid SOROSWAP_QUOTE_NETWORK value: ${value}. Must be "mainnet" or "testnet".`
  );
}

function loadSharedConfig(networkKey?: string): SharedConfig {
  const normalizedKey = (networkKey || ACTIVE_NETWORK).trim().toLowerCase();
  const configFileName = `accounts.${normalizedKey}.json`;
  const sharedConfigPath = join(__dirname, "../../shared/config", configFileName);
  try {
    const configData = readFileSync(sharedConfigPath, "utf-8");
    return JSON.parse(configData);
  } catch (error) {
    const helper =
      normalizedKey === "testnet"
        ? "./deploy_testnet.sh"
        : normalizedKey === "mainnet"
        ? "./deploy.sh"
        : "./deploy.sh";
    throw new ConfigurationError(
      `Failed to load shared configuration from ${sharedConfigPath}. ` +
        `Please ensure you have run the correct deployment script (${helper}) for the "${normalizedKey}" network.\n` +
        `Current ACTIVE_NETWORK setting: ${ACTIVE_NETWORK}`
    );
  }
}

function getForexAccountLabel(
  key: string,
  accounts: AccountMapping,
  fallback: AccountLabel
): AccountLabel {
  const raw = process.env[key]?.trim();
  if (!raw) {
    return fallback;
  }
  if (["A", "B", "C", "D"].includes(raw) && accounts[raw as AccountLabel]) {
    return raw as AccountLabel;
  }
  throw new ConfigurationError(
    `Invalid ${key} value "${raw}". Expected one of A, B, C, or D with a configured smart account.`
  );
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
  forex: ForexConfig;
  multisig: {
    contractId: string;
    label: string;
    threshold: number;
    signers: AccountLabel[];
  };
};

function loadConfig(): AppConfig {
  try {
    // Log active network configuration
    console.log(`\n🌐 Loading configuration for: ${ACTIVE_NETWORK.toUpperCase()}`);
    console.log(`   Config file: shared/config/accounts.${ACTIVE_NETWORK}.json\n`);

    // Load shared configuration from deploy output
    const sharedConfig = loadSharedConfig();
    const network = parseNetwork(sharedConfig.network);

    // Only secrets come from environment variables
    const adminSecretKey = requireEnv("ADMIN_SECRET_KEY");
    const adminAuthToken = requireEnv("ADMIN_AUTH_TOKEN");

    // Allow optional overrides from environment
    const rpcUrl = getEnv("SOROBAN_RPC_URL", sharedConfig.rpcUrl);
    const usdcContractId = getEnv("USDC_CONTRACT_ID", sharedConfig.usdcContractId);
    const eurcContractId = getEnv(
      "EURC_CONTRACT_ID",
      sharedConfig.eurcContractId || DEFAULT_EURC_CONTRACT_ID
    );
    const adminPublicKey = getEnv("ADMIN_PUBLIC_KEY", sharedConfig.adminPublicKey);
    const soroswapApiKey = requireEnv("SOROSWAP_API_KEY");
    const soroswapBaseUrl = getEnv("SOROSWAP_API_BASE_URL", "https://api.soroswap.finance");
    const soroswapQuoteNetwork = parseSoroswapNetwork(
      getEnv("SOROSWAP_QUOTE_NETWORK", network === "MAINNET" ? "mainnet" : "testnet")
    );
    const defaultProtocols =
      soroswapQuoteNetwork === "mainnet" ? ["soroswap", "phoenix", "aqua"] : ["soroswap"];
    const soroswapProtocolsRaw = getEnv("SOROSWAP_PROTOCOLS", "")
      .split(",")
      .map((protocol) => protocol.trim())
      .filter(Boolean);
    const soroswapProtocols =
      soroswapProtocolsRaw.length > 0 ? soroswapProtocolsRaw : defaultProtocols;

    const activeConfigKey = ACTIVE_NETWORK.trim().toLowerCase();
    const quoteConfigKey = soroswapQuoteNetwork;
    const quoteSharedConfig =
      quoteConfigKey === activeConfigKey ? sharedConfig : loadSharedConfig(quoteConfigKey);
    if (quoteConfigKey !== activeConfigKey) {
      console.log(
        `   Forex quotes: using ${quoteConfigKey.toUpperCase()} liquidity (shared/config/accounts.${quoteConfigKey}.json)`
      );
    }

    const usdcAccountLabel = getForexAccountLabel(
      "FOREX_USDC_ACCOUNT_LABEL",
      sharedConfig.accounts,
      "A"
    );
    const eurcAccountLabel = getForexAccountLabel(
      "FOREX_EURC_ACCOUNT_LABEL",
      sharedConfig.accounts,
      "B"
    );

    if (!sharedConfig.multisig?.contractId) {
      throw new ConfigurationError(
        "Shared config is missing multisig contract information. Please re-run deploy.sh."
      );
    }

    const multisigLabel = sharedConfig.multisig.label?.trim() || "Global Treasury";
    const multisigThreshold = sharedConfig.multisig.threshold ?? 3;

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
      forex: {
        eurcContractId,
        usdcAccountLabel,
        eurcAccountLabel,
        quoteAssets: {
          usdcContractId: quoteSharedConfig.usdcContractId,
          eurcContractId: quoteSharedConfig.eurcContractId || DEFAULT_EURC_CONTRACT_ID,
        },
        soroswap: {
          apiKey: soroswapApiKey,
          baseUrl: soroswapBaseUrl,
          network: soroswapQuoteNetwork,
          protocols: soroswapProtocols.length ? soroswapProtocols : ["soroswap", "phoenix", "aqua"],
        },
      },
      multisig: {
        contractId: sharedConfig.multisig.contractId,
        label: multisigLabel,
        threshold: multisigThreshold,
        signers: ["A", "B", "C", "D"] as AccountLabel[],
      },
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
