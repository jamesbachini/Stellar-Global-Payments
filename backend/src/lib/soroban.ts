import {
  Address,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
} from "@stellar/stellar-sdk";
import bigInt from "big-integer";
import { appConfig } from "../config.js";
import { AccountLabel, TransactionResult, BalanceMap } from "../types.js";
import { TRANSACTION_CONFIG } from "../constants.js";
import { TransactionError, BalanceFetchError, ValidationError } from "../errors.js";
import { toI128, fromI128 } from "../utils/currency.js";
import { stellarClient } from "./stellar.js";

function getContractAddress(label: AccountLabel): string {
  const address = appConfig.accounts[label];
  if (!address) {
    throw new ValidationError(`Contract address not found for account ${label}`);
  }
  return address;
}

function createExplorerUrl(hash: string): string {
  return `${appConfig.explorerBaseUrl}${hash}`;
}

async function buildBaseTransaction(): Promise<TransactionBuilder> {
  const sourceAccount = await stellarClient.getAccount(stellarClient.getAdminPublicKey());

  return new TransactionBuilder(sourceAccount, {
    fee: TRANSACTION_CONFIG.FEE,
    networkPassphrase: stellarClient.networkPassphrase,
  }).setTimeout(TRANSACTION_CONFIG.TIMEOUT);
}

async function prepareAndSendTransaction(
  txBuilder: TransactionBuilder
): Promise<TransactionResult> {
  let tx = txBuilder.build();

  tx = await stellarClient.prepareTransaction(tx);
  tx.sign(stellarClient.getAdminKeypair());

  const response = await stellarClient.sendTransaction(tx);

  if (!response.hash) {
    throw new TransactionError("Transaction was sent but no hash was returned");
  }

  return {
    hash: response.hash,
    explorerUrl: createExplorerUrl(response.hash),
  };
}

async function fetchAccountBalance(label: AccountLabel): Promise<string> {
  try {
    const contractAddress = getContractAddress(label);
    const usdcContract = new Contract(appConfig.usdcContractId);

    const builder = await buildBaseTransaction();
    const txBuilder = builder.addOperation(
      usdcContract.call(
        "balance",
        nativeToScVal(Address.fromString(contractAddress), { type: "address" })
      )
    );

    let tx = txBuilder.build();
    tx = await stellarClient.prepareTransaction(tx);

    const simulation = await stellarClient.simulateTransaction(tx);

    if ("result" in simulation && simulation.result?.retval) {
      const native = scValToNative(simulation.result.retval);
      const balanceBigInt = bigInt(native.toString());
      return fromI128(balanceBigInt);
    }

    throw new Error("No balance returned from simulation");
  } catch (error) {
    console.error(`Failed to fetch balance for account ${label}:`, error);
    return "0";
  }
}

export async function fetchBalances(): Promise<BalanceMap> {
  try {
    const labels: AccountLabel[] = ["A", "B", "C", "D"];

    const balancePromises = labels.map(async (label) => ({
      label,
      balance: await fetchAccountBalance(label),
    }));

    const results = await Promise.all(balancePromises);

    const balances: BalanceMap = {
      A: "0",
      B: "0",
      C: "0",
      D: "0",
    };

    results.forEach(({ label, balance }) => {
      balances[label] = balance;
    });

    return balances;
  } catch (error) {
    throw new BalanceFetchError(
      `Failed to fetch balances: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

export async function submitTransfer(
  from: AccountLabel,
  to: AccountLabel,
  amount: string
): Promise<TransactionResult> {
  try {
    const fromContract = new Contract(getContractAddress(from));
    const toAddress = Address.fromString(getContractAddress(to));
    const amountI128 = toI128(amount);

    const txBuilder = (await buildBaseTransaction()).addOperation(
      fromContract.call(
        "execute_transfer",
        nativeToScVal(toAddress, { type: "address" }),
        nativeToScVal(amountI128.toString(), { type: "i128" })
      )
    );

    return await prepareAndSendTransaction(txBuilder);
  } catch (error) {
    if (error instanceof TransactionError) {
      throw error;
    }
    throw new TransactionError(
      `Transfer failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

export async function submitAdminWithdraw(
  from: AccountLabel,
  amount: string
): Promise<TransactionResult> {
  try {
    const fromContract = new Contract(getContractAddress(from));
    const amountI128 = toI128(amount);

    const txBuilder = (await buildBaseTransaction()).addOperation(
      fromContract.call(
        "admin_withdraw",
        nativeToScVal(amountI128.toString(), { type: "i128" })
      )
    );

    return await prepareAndSendTransaction(txBuilder);
  } catch (error) {
    if (error instanceof TransactionError) {
      throw error;
    }
    throw new TransactionError(
      `Admin withdrawal failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
