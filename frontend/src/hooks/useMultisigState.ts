import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import type { MultisigState, MultisigStateResponse } from "../types";

const defaultState: MultisigState = {
  balance: "0",
  label: "Treasury Multisig",
  threshold: 3,
  signers: ["A", "B", "C", "D"],
  requests: [],
};

export function useMultisigState() {
  const [state, setState] = useState<MultisigState>(defaultState);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axios.get<MultisigStateResponse>("/api/multisig/state");
      if (!data.success) {
        throw new Error("Unable to fetch multisig state");
      }
      setState(data.data);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 15000);
    return () => clearInterval(interval);
  }, [fetchState]);

  return { state, loading, error, refresh: fetchState };
}
