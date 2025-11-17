import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import type {
  ForexLocation,
  ForexDirection,
  ForexQuoteResponse,
  ForexQuoteSummary,
  TransferResponse,
} from "../types";

type Props = {
  origin: ForexLocation | null;
  onClose: () => void;
  refresh: () => Promise<void> | void;
};

const locationMeta: Record<
  ForexLocation,
  { city: string; asset: "USDC" | "EURC"; next: ForexLocation; direction: ForexDirection }
> = {
  NEW_YORK: {
    city: "New York",
    asset: "USDC",
    next: "LONDON",
    direction: "USDC_TO_EURC",
  },
  LONDON: {
    city: "London",
    asset: "EURC",
    next: "NEW_YORK",
    direction: "EURC_TO_USDC",
  },
};

export function ForexModal({ origin, onClose, refresh }: Props) {
  const [fromLocation, setFromLocation] = useState<ForexLocation>("NEW_YORK");
  const [amount, setAmount] = useState("100");
  const [quote, setQuote] = useState<ForexQuoteSummary | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [explorerUrl, setExplorerUrl] = useState("");

  useEffect(() => {
    if (origin) {
      setFromLocation(origin);
      setStatus("idle");
      setMessage("");
      setQuote(null);
      setExplorerUrl("");
      setAmount("100");
    }
  }, [origin]);

  useEffect(() => {
    setQuote(null);
  }, [fromLocation]);

  if (!origin) return null;

  const toLocation = locationMeta[fromLocation].next;
  const sourceMeta = locationMeta[fromLocation];
  const destinationMeta = locationMeta[toLocation];
  const direction = sourceMeta.direction;

  const quoteExpiresAt = useMemo(() => {
    if (!quote?.expiresAt) return null;
    try {
      return new Date(quote.expiresAt).toLocaleTimeString();
    } catch {
      return null;
    }
  }, [quote]);

  const fetchQuote = async () => {
    try {
      setQuoteLoading(true);
      setStatus("idle");
      setMessage("");
      const { data } = await axios.post<ForexQuoteResponse>("/api/forex/quote", {
        direction,
        amount,
      });
      if (!data.success) {
        const errorMessage =
          typeof data.error === "string"
            ? data.error
            : data.error?.message || "Unable to fetch quote";
        throw new Error(errorMessage);
      }
      setQuote(data.data);
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unable to fetch quote";
      setQuote(null);
      setMessage(error);
    } finally {
      setQuoteLoading(false);
    }
  };

  const submitSwap = async () => {
    if (!quote) return;
    try {
      setStatus("pending");
      setMessage("");
      const start = Date.now();
      const { data } = await axios.post<TransferResponse>("/api/forex/swap", {
        quote: quote.quote,
      });
      if (!data.success) {
        const errorMessage =
          typeof data.error === "string" ? data.error : data.error?.message || "Swap failed";
        throw new Error(errorMessage);
      }
      await refresh();

      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 5000 - elapsed);
      if (remaining) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }

      setStatus("success");
      setExplorerUrl(data.data.explorerUrl);
    } catch (err) {
      const error = err instanceof Error ? err.message : "Swap failed";
      setStatus("error");
      setMessage(error);
    }
  };

  const clearModalState = () => {
    setQuote(null);
    setStatus("idle");
    setMessage("");
    setExplorerUrl("");
  };

  const handleClose = () => {
    clearModalState();
    onClose();
  };

  const resetAndClose = async () => {
    await refresh();
    clearModalState();
    onClose();
  };

  if (status === "pending" && quote) {
    return (
      <div className="modal">
        <div className="modal-content loading-screen">
          <div className="transfer-animation">
            <div className="location-marker start-marker">
              <div className="marker-pin"></div>
              <span className="marker-label">{sourceMeta.city}</span>
            </div>
            <div className="transfer-path">
              <div className="path-line"></div>
              <div className="coin-container">
                <svg className="dollar-coin" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="1.5" fill="#8ecae6" />
                  <text x="12" y="17" fontSize="14" fontWeight="bold" textAnchor="middle" fill="#050b18">
                    $
                  </text>
                </svg>
              </div>
            </div>
            <div className="location-marker end-marker">
              <div className="marker-pin"></div>
              <span className="marker-label">{destinationMeta.city}</span>
            </div>
          </div>
          <div className="loading-content">
            <h3>
              Swapping {quote.amountIn} {sourceMeta.asset}
            </h3>
            <p>Locking exchange rate at {quote.rate}</p>
            <div className="progress-bar">
              <div className="progress-fill"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === "success" && quote) {
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
            <h2>Swap Complete!</h2>
            <p className="success-details">
              {quote.amountIn} {sourceMeta.asset} → {quote.amountOut} {destinationMeta.asset}
            </p>
            <a className="explorer-button" href={explorerUrl} target="_blank" rel="noreferrer">
              View Transaction on Stellar.Expert
            </a>
            <button className="close-button" onClick={resetAndClose}>
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
            <h3>Cross-border FX Transfer</h3>
            <button onClick={handleClose}>×</button>
          </header>
        <label>
          <span>From</span>
          <select
            value={fromLocation}
            onChange={(event) => setFromLocation(event.target.value as ForexLocation)}
          >
            <option value="NEW_YORK">New York · USDC</option>
            <option value="LONDON">London · EURC</option>
          </select>
        </label>
        <label>
          <span>To</span>
          <input value={destinationMeta.city} disabled />
        </label>
        <label>
          <span>Amount ({sourceMeta.asset})</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setQuote(null);
            }}
          />
        </label>

        {!quote && (
          <button className="primary" onClick={fetchQuote} disabled={quoteLoading}>
            {quoteLoading ? "Fetching rate..." : "Get Exchange Rate"}
          </button>
        )}

        {quote && (
          <div className="quote-panel">
            <h4>Confirm Exchange Rate</h4>
            <p>
              {quote.amountIn} {sourceMeta.asset} → {quote.amountOut} {destinationMeta.asset}
            </p>
            <p>
              Rate: 1 {sourceMeta.asset} = {quote.rate} {destinationMeta.asset}
            </p>
            {quoteExpiresAt && <p className="quote-expiry">Quote valid until {quoteExpiresAt}</p>}
            <div className="quote-actions">
              <button className="primary" onClick={submitSwap}>
                Confirm Swap
              </button>
              <button className="ghost" onClick={() => setQuote(null)}>
                Refresh Quote
              </button>
            </div>
          </div>
        )}

        {message && <p className={status === "error" ? "error" : "info"}>{message}</p>}
      </div>
    </div>
  );
}
