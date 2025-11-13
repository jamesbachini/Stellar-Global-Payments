import { config } from "dotenv";
import {
  Address,
  Contract,
  Keypair,
  Networks,
  SorobanRpc,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { promises as fs } from "node:fs";
import path from "node:path";

type AccountLabel = "A" | "B" | "C" | "D";

type DeployConfig = {
  networkPassphrase: string;
  rpcUrl: string;
  adminSecret: string;
  usdcContractId: string;
  wasmPath: string;
  outputPath: string;
  labels: AccountLabel[];
};

config();

async function deploySmartAccounts(cfg: DeployConfig) {
  const rpc = new SorobanRpc.Server(cfg.rpcUrl, { allowHttp: cfg.rpcUrl.startsWith("http://") });
  const admin = Keypair.fromSecret(cfg.adminSecret);
  const source = await rpc.getAccount(admin.publicKey());

  const wasm = await fs.readFile(cfg.wasmPath);
  const install = TransactionBuilder.cloneFrom(source, {
    fee: "50000",
    networkPassphrase: cfg.networkPassphrase,
  })
    .addOperation(
      Contract.installContractCodeOp({ code: wasm })
    )
    .setTimeout(180)
    .build();

  install.sign(admin);
  const installTx = await rpc.sendTransaction(install);
  if (installTx.errorResult) {
    throw new Error(`Install failed: ${installTx.errorResult}`);
  }
  const wasmId = installTx.wasmId!;

  const results: Record<string, string> = {};
  for (const label of cfg.labels) {
    const instanceTx = TransactionBuilder.cloneFrom(source, {
      fee: "50000",
      networkPassphrase: cfg.networkPassphrase,
    })
      .addOperation(
        Contract.createContractOp({
          wasmId,
          address: Address.fromString(admin.publicKey()),
        })
      )
      .setTimeout(180)
      .build();

    instanceTx.sign(admin);
    const instanceResult = await rpc.sendTransaction(instanceTx);
    if (!instanceResult.contractId) {
      throw new Error(`Instance creation failed for ${label}`);
    }

    const initTx = TransactionBuilder.cloneFrom(source, {
      fee: "50000",
      networkPassphrase: cfg.networkPassphrase,
    })
      .addOperation(
        Contract.callContractFunctionOp({
          contractId: instanceResult.contractId,
          functionName: "init",
          args: [
            xdr.ScVal.scvAddress(Address.fromString(admin.publicKey()).toScAddress()),
            xdr.ScVal.scvAddress(Address.fromString(cfg.usdcContractId).toScAddress()),
            xdr.ScVal.scvVec(cfg.labels
              .filter((l) => l !== label)
              .map((dest) =>
                xdr.ScVal.scvAddress(Address.fromString(dest).toScAddress())
              )
            ),
            xdr.ScVal.scvBytes(Buffer.from(label))
          ],
        })
      )
      .setTimeout(180)
      .build();

    initTx.sign(admin);
    const initResult = await rpc.sendTransaction(initTx);
    if (initResult.errorResult) {
      throw new Error(`Init failed for ${label}: ${initResult.errorResult}`);
    }

    results[label] = instanceResult.contractId;
  }

  const output = {
    network: cfg.networkPassphrase === Networks.TESTNET ? "TESTNET" : "CUSTOM",
    rpcUrl: cfg.rpcUrl,
    usdcContractId: cfg.usdcContractId,
    adminPublicKey: admin.publicKey(),
    accounts: results,
  };

  await fs.mkdir(path.dirname(cfg.outputPath), { recursive: true });
  await fs.writeFile(cfg.outputPath, JSON.stringify(output, null, 2));
  console.log(`Wrote config to ${cfg.outputPath}`);
}

const deployConfig: DeployConfig = {
  networkPassphrase: process.env.NETWORK_PASSPHRASE || Networks.TESTNET,
  rpcUrl: process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org",
  adminSecret: process.env.ADMIN_SECRET_KEY || "",
  usdcContractId: process.env.USDC_CONTRACT_ID || "",
  wasmPath:
    process.env.WASM_PATH || path.resolve(__dirname, "../target/wasm32-unknown-unknown/release/remittance_accounts.wasm"),
  outputPath: process.env.OUTPUT_PATH || path.resolve(__dirname, "../../shared/config/accounts.local.json"),
  labels: ["A", "B", "C", "D"],
};

deploySmartAccounts(deployConfig).catch((err) => {
  console.error(err);
  process.exit(1);
});
