import {
  Address,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
} from "@stellar/stellar-sdk";
import bigInt from "big-integer";
import { appConfig } from "../config.js";
import {
  AccountLabel,
  TransactionResult,
  BalanceMap,
  ForexBalanceMap,
  ForexQuoteDirection,
  TransferDestination,
  MultisigState,
  MultisigRequestRecord,
} from "../types.js";
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

function resolveDestinationAddress(label: TransferDestination): string {
  if (label === "MULTISIG") {
    return appConfig.multisig.contractId;
  }
  return getContractAddress(label);
}

function getLabelForAddress(address: string): AccountLabel | null {
  const entry = Object.entries(appConfig.accounts).find(([, id]) => id === address);
  return entry ? (entry[0] as AccountLabel) : null;
}

function normalizeSnapshotEntry(entry: unknown): Record<string, unknown> | null {
  if (!entry) {
    return null;
  }
  if (entry instanceof Map) {
    return Object.fromEntries(entry);
  }
  if (Array.isArray(entry)) {
    const [
      id,
      to,
      amount,
      approvals,
      executed,
      initiator,
      createdAt,
      completedAt,
    ] = entry;
    return {
      id,
      to,
      amount,
      approvals,
      executed,
      initiator,
      created_at: createdAt,
      completed_at: completedAt,
    };
  }
  if (typeof entry === "object") {
    return entry as Record<string, unknown>;
  }
  return null;
}

function toStringValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return value.toString();
  }
  if (value && typeof value === "object" && "toString" in value) {
    try {
      return (value as { toString: () => string }).toString();
    } catch {
      return null;
    }
  }
  return null;
}

function parseSnapshot(entry: unknown): MultisigRequestRecord | null {
  const snapshot = normalizeSnapshotEntry(entry);
  if (!snapshot) {
    return null;
  }

  const toAddress = toStringValue(snapshot.to);
  const initiatorAddress = toStringValue(snapshot.initiator);
  if (!toAddress || !initiatorAddress) {
    return null;
  }

  const toLabel = getLabelForAddress(toAddress);
  const initiatorLabel = getLabelForAddress(initiatorAddress);
  if (!toLabel || !initiatorLabel) {
    return null;
  }

  const approvalsRaw = Array.isArray(snapshot.approvals) ? snapshot.approvals : [];
  const approvals: AccountLabel[] = approvalsRaw
    .map((addr) => {
      const str = toStringValue(addr);
      return str ? getLabelForAddress(str) : null;
    })
    .filter((label): label is AccountLabel => Boolean(label));

  const approvalsDistinct = Array.from(new Set(approvals));

  const amountRaw = toStringValue(snapshot.amount) ?? "0";
  const amount = fromI128(bigInt(amountRaw));

  const createdAt = Number(snapshot.created_at ?? snapshot.createdAt ?? 0);
  const completedValue = Number(snapshot.completed_at ?? snapshot.completedAt ?? 0);
  const id = Number(snapshot.id ?? 0);
  const executed = Boolean(snapshot.executed ?? snapshot.is_executed ?? false);

  return {
    id,
    to: toLabel,
    amount,
    approvals: approvalsDistinct,
    executed,
    initiator: initiatorLabel,
    createdAt,
    completedAt: completedValue > 0 ? completedValue : undefined,
  };
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

async function fetchTokenBalance(contractId: string, accountAddress: string): Promise<string> {
  try {
    const tokenContract = new Contract(contractId);

    const builder = await buildBaseTransaction();
    const txBuilder = builder.addOperation(
      tokenContract.call(
        "balance",
        nativeToScVal(Address.fromString(accountAddress), { type: "address" })
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
    console.error(`Failed to fetch balance for account ${accountAddress}:`, error);
    return "0";
  }
}

async function fetchAccountBalance(
  label: AccountLabel,
  tokenContractId: string = appConfig.usdcContractId
): Promise<string> {
  const contractAddress = getContractAddress(label);
  return fetchTokenBalance(tokenContractId, contractAddress);
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

export async function fetchForexBalances(): Promise<ForexBalanceMap> {
  const [newYorkBalance, londonBalance] = await Promise.all([
    fetchAccountBalance(appConfig.forex.usdcAccountLabel, appConfig.usdcContractId),
    fetchAccountBalance(appConfig.forex.eurcAccountLabel, appConfig.forex.eurcContractId),
  ]);

  return {
    newYork: {
      account: appConfig.forex.usdcAccountLabel,
      city: "New York",
      asset: "USDC",
      balance: newYorkBalance,
    },
    london: {
      account: appConfig.forex.eurcAccountLabel,
      city: "London",
      asset: "EURC",
      balance: londonBalance,
    },
  };
}

async function fetchMultisigRequests(): Promise<MultisigRequestRecord[]> {
  try {
    const multisigContract = new Contract(appConfig.multisig.contractId);
    const txBuilder = (await buildBaseTransaction()).addOperation(
      multisigContract.call("list_requests")
    );
    let tx = txBuilder.build();
    tx = await stellarClient.prepareTransaction(tx);
    const simulation = await stellarClient.simulateTransaction(tx);
    if (!("result" in simulation) || !simulation.result?.retval) {
      return [];
    }
    const native = scValToNative(simulation.result.retval);
    if (!Array.isArray(native)) {
      return [];
    }
    const parsed = native
      .map((entry) => parseSnapshot(entry))
      .filter((entry): entry is MultisigRequestRecord => entry !== null);
    parsed.sort((a, b) => b.id - a.id);
    return parsed;
  } catch (error) {
    console.error("Failed to fetch multisig requests:", error);
    return [];
  }
}

export async function fetchMultisigState(): Promise<MultisigState> {
  const [balance, requests] = await Promise.all([
    fetchTokenBalance(appConfig.usdcContractId, appConfig.multisig.contractId),
    fetchMultisigRequests(),
  ]);

  return {
    balance,
    label: appConfig.multisig.label,
    threshold: appConfig.multisig.threshold,
    signers: appConfig.multisig.signers,
    requests,
  };
}

export async function submitTransfer(
  from: AccountLabel,
  to: TransferDestination,
  amount: string
): Promise<TransactionResult> {
  try {
    const fromContract = new Contract(getContractAddress(from));
    const toAddress = Address.fromString(resolveDestinationAddress(to));
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

export async function submitForexTransfer(
  from: AccountLabel,
  to: AccountLabel,
  direction: ForexQuoteDirection,
  amount: string,
  minAmountOut: string,
  deadline: number
): Promise<TransactionResult> {
  try {
    const fromContract = new Contract(getContractAddress(from));
    const toAddress = Address.fromString(getContractAddress(to));
    const amountI128 = toI128(amount);
    const minOutI128 = toI128(minAmountOut);
    const swapToCounter = direction === "USDC_TO_EURC";

    const txBuilder = (await buildBaseTransaction()).addOperation(
      fromContract.call(
        "execute_forex_transfer",
        nativeToScVal(toAddress, { type: "address" }),
        nativeToScVal(amountI128.toString(), { type: "i128" }),
        nativeToScVal(minOutI128.toString(), { type: "i128" }),
        nativeToScVal(deadline, { type: "u64" }),
        nativeToScVal(swapToCounter, { type: "bool" })
      )
    );

    return await prepareAndSendTransaction(txBuilder);
  } catch (error) {
    if (error instanceof TransactionError) {
      throw error;
    }
    throw new TransactionError(
      `Forex transfer failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

export async function submitMultisigWithdraw(
  initiator: AccountLabel,
  to: AccountLabel,
  amount: string
): Promise<TransactionResult> {
  try {
    const initiatorContract = new Contract(getContractAddress(initiator));
    const multisigAddress = Address.fromString(appConfig.multisig.contractId);
    const toAddress = Address.fromString(getContractAddress(to));
    const amountI128 = toI128(amount);

    const txBuilder = (await buildBaseTransaction()).addOperation(
      initiatorContract.call(
        "initiate_multisig_withdraw",
        nativeToScVal(multisigAddress, { type: "address" }),
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
      `Multisig withdrawal request failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

export async function submitMultisigApproval(
  signer: AccountLabel,
  requestId: number
): Promise<TransactionResult> {
  try {
    const signerContract = new Contract(getContractAddress(signer));
    const multisigAddress = Address.fromString(appConfig.multisig.contractId);

    const txBuilder = (await buildBaseTransaction()).addOperation(
      signerContract.call(
        "approve_multisig_withdraw",
        nativeToScVal(multisigAddress, { type: "address" }),
        nativeToScVal(requestId, { type: "u32" })
      )
    );

    return await prepareAndSendTransaction(txBuilder);
  } catch (error) {
    if (error instanceof TransactionError) {
      throw error;
    }
    throw new TransactionError(
      `Multisig approval failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
