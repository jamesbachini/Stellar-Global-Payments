import { Keypair, SorobanRpc } from "@stellar/stellar-sdk";
import { appConfig } from "../config.js";
import { NETWORK_PASSPHRASES } from "../constants.js";
import { NetworkError } from "../errors.js";

export class StellarClient {
  private readonly rpc: SorobanRpc.Server;
  private readonly adminKeypair: Keypair;
  public readonly networkPassphrase: string;

  constructor() {
    this.rpc = new SorobanRpc.Server(appConfig.rpcUrl, {
      allowHttp: appConfig.rpcUrl.startsWith("http://"),
    });

    try {
      this.adminKeypair = Keypair.fromSecret(appConfig.adminSecretKey);
    } catch (error) {
      throw new NetworkError(
        `Failed to initialize admin keypair: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }

    this.networkPassphrase = NETWORK_PASSPHRASES[appConfig.network];
  }

  async getAccount(publicKey: string) {
    try {
      return await this.rpc.getAccount(publicKey);
    } catch (error) {
      throw new NetworkError(
        `Failed to fetch account ${publicKey}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async prepareTransaction(tx: any) {
    try {
      return await this.rpc.prepareTransaction(tx);
    } catch (error) {
      throw new NetworkError(
        `Failed to prepare transaction: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async simulateTransaction(tx: any) {
    try {
      return await this.rpc.simulateTransaction(tx);
    } catch (error) {
      throw new NetworkError(
        `Failed to simulate transaction: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async sendTransaction(tx: any) {
    try {
      const response = await this.rpc.sendTransaction(tx);

      if (response.status === "ERROR" || response.errorResult) {
        throw new NetworkError(
          `Transaction failed: ${response.errorResult || "Unknown error"}`
        );
      }

      return response;
    } catch (error) {
      if (error instanceof NetworkError) {
        throw error;
      }
      throw new NetworkError(
        `Failed to send transaction: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  getAdminKeypair(): Keypair {
    return this.adminKeypair;
  }

  getAdminPublicKey(): string {
    return this.adminKeypair.publicKey();
  }
}

export const stellarClient = new StellarClient();
