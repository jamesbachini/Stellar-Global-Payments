import { useState } from "react";
import axios from "axios";
import { useAccounts } from "../hooks/useAccounts";
import type { AccountLabel, TransferResponse } from "../types";

const labels: AccountLabel[] = ["A", "B", "C", "D"];

export default function Admin() {
  const { balances, refresh } = useAccounts();
  const [from, setFrom] = useState<AccountLabel>("A");
  const [amount, setAmount] = useState("1");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [explorerUrl, setExplorerUrl] = useState("");

  const submit = async () => {
    try {
      setStatus("pending");
      setMessage("");
      const { data } = await axios.post<TransferResponse>("/api/admin/withdraw", {
        from,
        amount,
        adminAuthToken: token,
      });
      if (!data.success) throw new Error(data.error || "Withdraw failed");
      setExplorerUrl(data.explorerUrl || "");
      setStatus("success");
      setMessage("Withdrawal submitted");
      await refresh();
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unable to withdraw";
      setStatus("error");
      setMessage(error);
    }
  };

  return (
    <div className="admin-page">
      <section className="panel">
        <h2>Admin Withdraw</h2>
        <label>
          <span>From Account</span>
          <select value={from} onChange={(event) => setFrom(event.target.value as AccountLabel)}>
            {labels.map((label) => (
              <option key={label} value={label}>
                Account {label} (Balance: {balances[label]} USDC)
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Amount</span>
          <input value={amount} onChange={(event) => setAmount(event.target.value)} />
        </label>
        <label>
          <span>Admin Auth Token</span>
          <input value={token} onChange={(event) => setToken(event.target.value)} />
        </label>
        <button onClick={submit} disabled={status === "pending"}>
          {status === "pending" ? "Submitting..." : "Withdraw"}
        </button>
        {status === "pending" && <div className="progress" />}
        {message && <p className={status === "error" ? "error" : "success"}>{message}</p>}
        {explorerUrl && (
          <a href={explorerUrl} target="_blank" rel="noreferrer">
            View on Explorer
          </a>
        )}
      </section>
    </div>
  );
}
