import { appConfig } from "../config.js";
import { NetworkError } from "../errors.js";
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
      const message =
        (data && (data.message || data.error || data.details)) ||
        `Soroswap API request to ${endpoint} failed`;
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
