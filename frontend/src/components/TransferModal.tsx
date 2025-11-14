import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import type { AccountLabel, TransferResponse } from "../types";

type Props = {
  from: AccountLabel | null;
  onClose: () => void;
  refresh: () => Promise<void> | void;
};

const labels: AccountLabel[] = ["A", "B", "C", "D"];

const cityNames: Record<AccountLabel, string> = {
  A: "New York",
  B: "London",
  C: "Buenos Aires",
  D: "Singapore",
};

export function TransferModal({ from, onClose, refresh }: Props) {
  const [to, setTo] = useState<AccountLabel>("B");
  const [amount, setAmount] = useState<string>("0.01");
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

  useEffect(() => {
    if (!from) {
      // Reset state when modal closes
      setStatus("idle");
      setMessage("");
      setExplorerUrl("");
      setAmount("0.01");
    }
  }, [from]);

  if (!from) return null;

  const submit = async () => {
    try {
      setStatus("pending");
      setMessage("");

      const startTime = Date.now();
      const { data } = await axios.post<any>("/api/transfer", { from, to, amount });
      if (!data.success) throw new Error(data.error || "Transfer failed");

      await refresh();

      // Ensure at least 5 seconds have passed for the animation
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, 5000 - elapsed);
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }

      setStatus("success");
      setExplorerUrl(data.data?.explorerUrl || "");
      setMessage("Transfer complete!");
    } catch (err) {
      const error = err instanceof Error ? err.message : "Transfer failed";
      setStatus("error");
      setMessage(error);
    }
  };

  if (status === "pending") {
    return (
      <div className="modal">
        <div className="modal-content loading-screen">
          <div className="transfer-animation">
            <div className="location-marker start-marker">
              <div className="marker-pin"></div>
              <span className="marker-label">{cityNames[from]}</span>
            </div>
            <div className="transfer-path">
              <div className="path-line"></div>
              <div className="coin-container">
                <svg className="dollar-coin" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="1.5" fill="#8ecae6"/>
                  <text x="12" y="17" fontSize="14" fontWeight="bold" textAnchor="middle" fill="#050b18">$</text>
                </svg>
              </div>
            </div>
            <div className="location-marker end-marker">
              <div className="marker-pin"></div>
              <span className="marker-label">{cityNames[to]}</span>
            </div>
          </div>
          <div className="loading-content">
            <h3>Sending ${amount} USDC</h3>
            <p>Processing transaction on Stellar network...</p>
            <div className="progress-bar">
              <div className="progress-fill"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="modal">
        <div className="modal-content success-screen">
          <div className="fireworks">
            <div className="firework"></div>
            <div className="firework"></div>
            <div className="firework"></div>
          </div>
          <div className="success-content">
            <svg className="success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <h2>Transfer Complete!</h2>
            <p className="success-details">
              ${amount} USDC sent from {cityNames[from]} to {cityNames[to]}
            </p>
            <a className="explorer-button" href={explorerUrl} target="_blank" rel="noreferrer">
              View Transaction on Stellar.Expert
            </a>
            <button className="close-button" onClick={async () => {
              await refresh();
              onClose();
            }}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal">
      <div className="modal-content">
        <header>
          <h3>Send USDC from {cityNames[from]}</h3>
          <button onClick={onClose}>×</button>
        </header>
        <label>
          <span>To</span>
          <select value={to} onChange={(event) => setTo(event.target.value as AccountLabel)}>
            {destinations.map((label) => (
              <option key={label} value={label}>
                {cityNames[label]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Amount</span>
          <div className="amount-input">
            <span className="currency-prefix">$</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <span className="currency-suffix">USDC</span>
          </div>
        </label>
        <button className="primary" disabled={status === "pending"} onClick={submit}>
          {status === "pending" ? "Sending..." : "Send"}
        </button>
        {status === "pending" && <div className="progress" />}
        {status === "error" && message && (
          <p className="error">{message}</p>
        )}
      </div>
    </div>
  );
}
