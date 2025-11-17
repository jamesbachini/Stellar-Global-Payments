import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import type { ForexBalances, ForexBalancesResponse } from "../types";

const defaultBalances: ForexBalances = {
  newYork: { account: "A", city: "New York", asset: "USDC", balance: "0" },
  london: { account: "B", city: "London", asset: "EURC", balance: "0" },
};

export function useForexBalances() {
  const [balances, setBalances] = useState<ForexBalances>(defaultBalances);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axios.get<ForexBalancesResponse>("/api/forex/balances");
      if (!data.success) {
        throw new Error("Unable to fetch forex balances");
      }
      setBalances(data.data);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to fetch forex balances";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalances();
    const interval = setInterval(fetchBalances, 20000);
    return () => clearInterval(interval);
  }, [fetchBalances]);

  return { balances, loading, error, refresh: fetchBalances };
}
