import {
  Address,
  Contract,
  Keypair,
  Networks,
  SorobanRpc,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
} from "@stellar/stellar-sdk";
import bigInt, { BigInteger } from "big-integer";
import { appConfig, AccountLabel } from "../config.js";

type TransferParams = {
  from: AccountLabel;
  to: AccountLabel;
  amount: string;
};

type WithdrawParams = { from: AccountLabel; amount: string };

type HashResult = { hash: string; explorerUrl: string };

const decimals = 7;
const TEN = bigInt(10);

const toI128 = (amount: string): BigInteger => {
  if (!amount) return bigInt.zero;
  const [whole, frac = ""] = amount.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return bigInt(whole || "0").multiply(TEN.pow(decimals)).add(bigInt(fracPadded));
};

const fromI128 = (value: BigInteger): string => {
  const raw = value.toString();
  const negative = raw.startsWith("-");
  const digits = negative ? raw.slice(1) : raw;
  const padded = digits.padStart(decimals + 1, "0");
  const integer = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, "");
  const formatted = fraction ? `${integer}.${fraction}` : integer;
  return negative ? `-${formatted}` : formatted;
};

const toExplorerUrl = (hash: string) => `${appConfig.explorerBaseUrl}${hash}`;

const labelToAccount = (label: AccountLabel) => {
  const id = appConfig.accounts[label];
  if (!id) throw new Error(`Missing contract ID for account ${label}`);
  return id;
};

const networkPassphrase = (() => {
  switch (appConfig.network) {
    case "MAINNET":
      return Networks.PUBLIC;
    case "FUTURENET":
      return "Test SDF Future Network ; October 2022";
    case "LOCALNET":
      return "Standalone Network ; February 2017";
    case "TESTNET":
    default:
      return Networks.TESTNET;
  }
})();

const rpc = new SorobanRpc.Server(appConfig.rpcUrl, {
  allowHttp: appConfig.rpcUrl.startsWith("http://"),
});

const adminKeypair = (() => {
  if (!appConfig.adminSecretKey) {
    throw new Error("ADMIN_SECRET_KEY missing");
  }
  return Keypair.fromSecret(appConfig.adminSecretKey);
})();

const usdcContract = new Contract(appConfig.usdcContractId);

async function buildBaseTransaction() {
  const sourceAccount = await rpc.getAccount(adminKeypair.publicKey());
  return new TransactionBuilder(sourceAccount, {
    fee: "60000",
    networkPassphrase,
  }).setTimeout(120);
}

async function prepareAndSend(txBuilder: TransactionBuilder): Promise<HashResult> {
  let tx = txBuilder.build();
  tx = await rpc.prepareTransaction(tx);
  tx.sign(adminKeypair);
  const sendResponse = await rpc.sendTransaction(tx);
  if (sendResponse.errorResult) {
    throw new Error(sendResponse.errorResult);
  }
  const hash = sendResponse.hash as string;
  return { hash, explorerUrl: toExplorerUrl(hash) };
}

export async function fetchBalances() {
  const balances: Record<AccountLabel, string> = {
    A: "0",
    B: "0",
    C: "0",
    D: "0",
  };

  for (const label of Object.keys(balances) as AccountLabel[]) {
    const account = labelToAccount(label);
    const builder = await buildBaseTransaction();
    const txBuilder = builder.addOperation(
      usdcContract.call(
        "balance",
        nativeToScVal(Address.fromString(account), { type: "address" })
      )
    );
    let tx = txBuilder.build();
    tx = await rpc.prepareTransaction(tx);
    const sim = await rpc.simulateTransaction(tx);
    const scVal = sim.result?.retval;
    if (scVal) {
      const native = scValToNative(scVal);
      const big = bigInt(native.toString());
      balances[label] = fromI128(big);
    }
  }

  return balances;
}

export async function submitTransfer({ from, to, amount }: TransferParams) {
  if (from === to) throw new Error("Source and destination must differ");
  const fromContract = new Contract(labelToAccount(from));
  const toAddress = Address.fromString(labelToAccount(to));
  const txBuilder = (await buildBaseTransaction()).addOperation(
    fromContract.call(
      "execute_transfer",
      nativeToScVal(toAddress, { type: "address" }),
      nativeToScVal(toI128(amount).toString(), { type: "i128" })
    )
  );
  return prepareAndSend(txBuilder);
}

export async function submitAdminWithdraw({ from, amount }: WithdrawParams) {
  const fromContract = new Contract(labelToAccount(from));
  const txBuilder = (await buildBaseTransaction()).addOperation(
    fromContract.call(
      "admin_withdraw",
      nativeToScVal(toI128(amount).toString(), { type: "i128" })
    )
  );
  return prepareAndSend(txBuilder);
}
