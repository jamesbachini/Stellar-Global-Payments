import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import type { AccountLabel, TransferResponse } from "../types";

type Props = {
  from: AccountLabel | null;
  onClose: () => void;
  refresh: () => Promise<void> | void;
};

const labels: AccountLabel[] = ["A", "B", "C", "D"];

export function TransferModal({ from, onClose, refresh }: Props) {
  const [to, setTo] = useState<AccountLabel>("B");
  const [amount, setAmount] = useState<string>("1");
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const [explorerUrl, setExplorerUrl] = useState<string>("");

  const destinations = useMemo(
    () => labels.filter((label) => label !== from),
    [from]
  );

  useEffect(() => {
    if (!from) return;
    const defaultDest = destinations[0] ?? "A";
    setTo((current) => (current === from ? defaultDest : current));
  }, [from, destinations]);

  if (!from) return null;

  const submit = async () => {
    try {
      setStatus("pending");
      setMessage("");
      const { data } = await axios.post<TransferResponse>("/api/transfer", { from, to, amount });
      if (!data.success) throw new Error(data.error || "Transfer failed");
      setStatus("success");
      setExplorerUrl(data.explorerUrl || "");
      setMessage("Transfer complete!");
      await refresh();
    } catch (err) {
      const error = err instanceof Error ? err.message : "Transfer failed";
      setStatus("error");
      setMessage(error);
    }
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <header>
          <h3>Send USDC from Account {from}</h3>
          <button onClick={onClose}>×</button>
        </header>
        <label>
          <span>From</span>
          <input value={from} readOnly />
        </label>
        <label>
          <span>To</span>
          <select value={to} onChange={(event) => setTo(event.target.value as AccountLabel)}>
            {destinations.map((label) => (
              <option key={label} value={label}>
                Account {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Amount</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <button className="primary" disabled={status === "pending"} onClick={submit}>
          {status === "pending" ? "Sending..." : "Send"}
        </button>
        {status === "pending" && <div className="progress" />}
        {message && (
          <p className={status === "error" ? "error" : "success"}>
            {message}
          </p>
        )}
        {explorerUrl && (
          <a className="link" href={explorerUrl} target="_blank" rel="noreferrer">
            View on Explorer
          </a>
        )}
      </div>
    </div>
  );
}
