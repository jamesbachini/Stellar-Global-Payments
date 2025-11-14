import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import type { AccountLabel, BalancesResponse } from "../types";

type Balances = Record<AccountLabel, string>;

const defaultBalances: Balances = { A: "0", B: "0", C: "0", D: "0" };

export function useAccounts() {
  const [balances, setBalances] = useState<Balances>(defaultBalances);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axios.get<{ success: boolean; data: { balances: Balances } }>("/api/balances");
      if (!data.success) {
        throw new Error("Unable to fetch balances");
      }
      setBalances(data.data.balances);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalances();
    const interval = setInterval(fetchBalances, 15000);
    return () => clearInterval(interval);
  }, [fetchBalances]);

  return { balances, loading, error, refresh: fetchBalances };
}
