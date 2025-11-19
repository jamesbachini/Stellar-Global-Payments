import fetch, { Response } from "node-fetch";
import { appConfig } from "../config.js";
import { NetworkError, UnauthorizedError, ValidationError } from "../errors.js";
import type { SoroswapQuote } from "../types.js";

class SoroswapClient {
  private readonly apiKey = appConfig.forex.soroswap.apiKey;
  private readonly baseUrl = appConfig.forex.soroswap.baseUrl;
  private readonly network = appConfig.forex.soroswap.network;
  private readonly protocols = appConfig.forex.soroswap.protocols;

  private async apiRequest<T>(endpoint: string, payload: unknown): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    url.searchParams.set("network", this.network);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      throw new NetworkError(
        `Failed to reach Soroswap API: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }

    let data: any = null;
    try {
      data = await response.json();
    } catch (error) {
      throw new NetworkError(
        `Failed to parse Soroswap API response: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }

    if (!response.ok) {
      const baseMessage =
        (data && (data.message || data.error || data.details)) ||
        `Soroswap API request to ${endpoint} failed`;

      const networkHint =
        this.network === "mainnet"
          ? "Please confirm that Soroswap currently has liquidity for this pair."
          : "Set SOROSWAP_QUOTE_NETWORK=mainnet and ensure shared/config/accounts.mainnet.json exists (run ./deploy.sh) to fetch quotes from mainnet while contracts stay on testnet.";

      const message =
        baseMessage.toLowerCase().includes("quote failed") ||
        baseMessage.toLowerCase().includes("no quote")
          ? `${baseMessage}. ${networkHint}`
          : baseMessage;

      if (response.status === 401 || response.status === 403) {
        throw new UnauthorizedError(
          `${message}. Please verify the SOROSWAP_API_KEY environment variable.`
        );
      }

      if (response.status >= 400 && response.status < 500) {
        throw new ValidationError(message);
      }

      throw new NetworkError(message);
    }

    return data as T;
  }

  async getQuote(
    assetIn: string,
    assetOut: string,
    amount: string,
    tradeType: "EXACT_IN" | "EXACT_OUT" = "EXACT_IN"
  ): Promise<SoroswapQuote> {
    return this.apiRequest<SoroswapQuote>("/quote", {
      assetIn,
      assetOut,
      amount,
      tradeType,
      protocols: this.protocols,
    });
  }
}

export const soroswapClient = new SoroswapClient();
