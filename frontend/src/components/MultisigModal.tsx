import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import type {
  AccountLabel,
  MultisigActionResponse,
  MultisigApprovalPayload,
  MultisigState,
  MultisigWithdrawPayload,
} from "../types";

type Props = {
  open: boolean;
  state: MultisigState;
  onClose: () => void;
  refresh: () => Promise<void> | void;
};

const cityNames: Record<AccountLabel, string> = {
  A: "New York",
  B: "London",
  C: "Buenos Aires",
  D: "Singapore",
};

const MULTISIG_LABEL = "Treasury Multisig";
const MIN_TX_DURATION_MS = 5000;

type TxContext = {
  title: string;
  fromLabel: string;
  toLabel: string;
  amount?: string;
};

const waitForMinimumAnimation = async (startTime: number) => {
  const elapsed = Date.now() - startTime;
  const remaining = Math.max(0, MIN_TX_DURATION_MS - elapsed);
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
};

export function MultisigModal({ open, state, onClose, refresh }: Props) {
  const [localState, setLocalState] = useState<MultisigState>(state);
  const [initiator, setInitiator] = useState<AccountLabel>("A");
  const [destination, setDestination] = useState<AccountLabel>("B");
  const [amount, setAmount] = useState<string>("0.01");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [approvalTarget, setApprovalTarget] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [txStatus, setTxStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txContext, setTxContext] = useState<TxContext | null>(null);
  const [txExplorerUrl, setTxExplorerUrl] = useState<string>("");
  const [txModalMessage, setTxModalMessage] = useState<string>("");

  useEffect(() => {
    setLocalState(state);
  }, [state]);

  useEffect(() => {
    if (!localState.signers.includes(initiator)) {
      setInitiator(localState.signers[0] ?? "A");
    }
    if (!localState.signers.includes(destination)) {
      setDestination(localState.signers[1] ?? localState.signers[0] ?? "A");
    }
  }, [localState, initiator, destination]);

  useEffect(() => {
    if (initiator === destination) {
      const fallback = localState.signers.find((label) => label !== initiator);
      if (fallback) {
        setDestination(fallback);
      }
    }
  }, [initiator, destination, localState.signers]);

  const pendingRequests = useMemo(
    () => localState.requests.filter((req) => !req.executed),
    [localState.requests]
  );

  const completedRequests = useMemo(
    () => localState.requests.filter((req) => req.executed),
    [localState.requests]
  );

  useEffect(() => {
    if (!open) {
      setTxStatus("idle");
      setTxContext(null);
      setTxExplorerUrl("");
      setTxModalMessage("");
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const resetTxModal = () => {
    setTxStatus("idle");
    setTxContext(null);
    setTxExplorerUrl("");
    setTxModalMessage("");
  };

  const handleModalClose = async () => {
    await refresh();
    resetTxModal();
    onClose();
  };

  const handleOverlayClose = async () => {
    await refresh();
    resetTxModal();
  };

  const beginTransactionFlow = (context: TxContext) => {
    setTxContext(context);
    setTxStatus("pending");
    setTxExplorerUrl("");
    setTxModalMessage("");
  };

  const runWithdraw = async () => {
    const startTime = Date.now();
    try {
      setSubmitting(true);
      setMessage("");
      setError("");
      beginTransactionFlow({
        title: `Submitting proposal from ${cityNames[initiator]}`,
        fromLabel: cityNames[initiator],
        toLabel: cityNames[destination],
        amount,
      });
      const payload: MultisigWithdrawPayload = {
        initiator,
        to: destination,
        amount,
      };
      const { data } = await axios.post<MultisigActionResponse>("/api/multisig/withdraw", payload);
      if (!data.success) {
        const errMessage =
          typeof data.error === "string" ? data.error : data.error?.message || "Request failed";
        throw new Error(errMessage);
      }
      setLocalState(data.data.state);
      setMessage("Withdrawal proposal created.");
      await refresh();
      await waitForMinimumAnimation(startTime);
      setTxExplorerUrl(data.data.result.explorerUrl || "");
      setTxModalMessage("Proposal submitted!");
      setTxStatus("success");
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : "Unable to create request";
      setError(errMessage);
      await waitForMinimumAnimation(startTime);
      setTxModalMessage(errMessage);
      setTxStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  const runApproval = async (signer: AccountLabel, requestId: number) => {
    const request = localState.requests.find((req) => req.id === requestId);
    const startTime = Date.now();
    try {
      setApprovalTarget(`${signer}-${requestId}`);
      setMessage("");
      setError("");
      beginTransactionFlow({
        title: `Signer ${cityNames[signer]} approving`,
        fromLabel: cityNames[signer],
        toLabel: request ? cityNames[request.to] : MULTISIG_LABEL,
        amount: request?.amount,
      });
      const payload: MultisigApprovalPayload = { signer, requestId };
      const { data } = await axios.post<MultisigActionResponse>("/api/multisig/approve", payload);
      if (!data.success) {
        const errMessage =
          typeof data.error === "string" ? data.error : data.error?.message || "Approval failed";
        throw new Error(errMessage);
      }
      setLocalState(data.data.state);
      setMessage(`Signature from ${cityNames[signer]} recorded.`);
      await refresh();
      await waitForMinimumAnimation(startTime);
      setTxExplorerUrl(data.data.result.explorerUrl || "");
      setTxModalMessage(`Signature by ${cityNames[signer]} recorded.`);
      setTxStatus("success");
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : "Unable to approve request";
      setError(errMessage);
      await waitForMinimumAnimation(startTime);
      setTxModalMessage(errMessage);
      setTxStatus("error");
    } finally {
      setApprovalTarget(null);
    }
  };

  const renderRequest = (requestId: number) => {
    const request = localState.requests.find((req) => req.id === requestId);
    if (!request) return null;
    const signatureCount = request.approvals.length;
    const signatureTarget = `${signatureCount}/${localState.threshold}`;

    return (
      <div key={request.id} className={`request-card ${request.executed ? "executed" : ""}`}>
        <div className="request-header">
          <div>
            <h4>Request #{request.id}</h4>
            <p>
              {request.executed ? "Released" : "Pending"} · Initiated by {cityNames[request.initiator]}
            </p>
          </div>
          <span className={`status-chip ${request.executed ? "status-complete" : ""}`}>
            {request.executed ? "Released" : `${signatureTarget} Signatures`}
          </span>
        </div>
        <div className="request-body">
          <div className="request-amount">
            <strong>${request.amount} USDC</strong>
            <span>Destination · {cityNames[request.to]}</span>
          </div>
          <div className="signature-grid">
            {localState.signers.map((label) => {
              const signed = request.approvals.includes(label);
              const isComplete = request.executed;
              const buttonKey = `${label}-${request.id}`;
              return (
                <button
                  key={buttonKey}
                  type="button"
                  className={`signature-pill ${signed ? "signed" : ""}`}
                  disabled={signed || isComplete || approvalTarget === buttonKey}
                  onClick={() => runApproval(label, request.id)}
                >
                  <span>{cityNames[label]}</span>
                  {signed ? (
                    <svg viewBox="0 0 24 24">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="signature-action">
                      {approvalTarget === buttonKey ? "Signing…" : "Sign"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="modal multisig-modal">
        <div className="modal-content">
          <header>
            <h3>{localState.label}</h3>
            <button
              onClick={() => {
                void handleModalClose();
              }}
            >
              ×
            </button>
          </header>

          <section className="multisig-overview">
            <div>
              <p>Balance</p>
              <h2>${parseFloat(localState.balance).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC</h2>
            </div>
            <div>
              <p>Threshold</p>
              <h2>
                {localState.threshold} of {localState.signers.length} Signers
              </h2>
            </div>
            <div>
              <p>Locations</p>
              <div className="signer-tags">
                {localState.signers.map((label) => (
                  <span key={label}>{cityNames[label]}</span>
                ))}
              </div>
            </div>
          </section>

          <section className="multisig-form">
            <h4>Propose Withdrawal</h4>
            <div className="form-grid">
              <label>
                <span>Initiating Wallet</span>
                <select
                  value={initiator}
                  onChange={(event) => setInitiator(event.target.value as AccountLabel)}
                >
                  {localState.signers.map((label) => (
                    <option key={label} value={label}>
                      {cityNames[label]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Release To</span>
                <select
                  value={destination}
                  onChange={(event) => setDestination(event.target.value as AccountLabel)}
                >
                  {localState.signers.map((label) => (
                    <option key={label} value={label} disabled={label === initiator}>
                      {cityNames[label]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Amount (USDC)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="primary"
                disabled={submitting}
                onClick={runWithdraw}
              >
                {submitting ? "Submitting…" : "Submit Proposal"}
              </button>
            </div>
            {message && <p className="info-text">{message}</p>}
            {error && <p className="error-text">{error}</p>}
          </section>

          <section className="multisig-requests">
            <h4>Pending Approvals</h4>
            {pendingRequests.length === 0 && <p className="empty-state">No pending withdrawals.</p>}
            {pendingRequests.map((request) => renderRequest(request.id))}
          </section>

          <section className="multisig-requests">
            <h4>Recent Releases</h4>
            {completedRequests.length === 0 && <p className="empty-state">No completed withdrawals yet.</p>}
            {completedRequests.slice(0, 3).map((request) => (
              <div key={request.id} className="request-card executed">
                <div className="request-header">
                  <div>
                    <h4>Request #{request.id}</h4>
                    <p>Released to {cityNames[request.to]}</p>
                  </div>
                  <span className="status-chip status-complete">Released</span>
                </div>
                <div className="request-body">
                  <div className="request-amount">
                    <strong>${request.amount} USDC</strong>
                    <span>
                      Signers · {request.approvals.map((label) => cityNames[label]).join(", ")}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>

      {txStatus === "pending" && txContext && (
        <div className="modal multisig-tx-modal">
          <div className="modal-content loading-screen">
            <div className="signature-animation">
              <div className="signature-canvas">
                <div className="signature-guide" />
                <svg className="signature-svg" viewBox="0 0 220 90" aria-hidden="true">
                  <path d="M10 60 Q 40 25 70 60 T 130 60 T 190 55" />
                </svg>
                <div className="signature-pen">
                  <svg viewBox="0 0 64 64" className="pen-icon" aria-hidden="true">
                    <path
                      d="M46 4L60 18c2 2 2 5 0 7L26 59l-17 3 4-17L46 4z"
                      fill="#f8fbff"
                      opacity="0.9"
                    />
                    <path d="M26 59l-8-8" stroke="#050b18" strokeWidth="3" strokeLinecap="round" />
                    <path d="M30 16l18 18" stroke="#050b18" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
              <p className="signature-caption">
                {txContext.amount ? `Proposal: $${txContext.amount} USDC` : "Collecting approvals"}
              </p>
            </div>
            <div className="loading-content">
              <h3>{txContext.amount ? `$${txContext.amount} USDC` : "Tx Processing..."}</h3>
              <p>{txContext.title}</p>
              <div className="progress-bar">
                <div className="progress-fill" />
              </div>
            </div>
          </div>
        </div>
      )}

      {txStatus === "success" && txContext && (
        <div className="modal multisig-tx-modal">
          <div className="modal-content success-screen">
            <div className="fireworks">
              <div className="firework" />
              <div className="firework" />
              <div className="firework" />
            </div>
            <div className="success-content">
              <svg className="success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              <h2>{txModalMessage || "Transaction complete!"}</h2>
              <p className="success-details">
                {txContext.fromLabel} → {txContext.toLabel}
              </p>
              {txExplorerUrl && (
                <a className="explorer-button" href={txExplorerUrl} target="_blank" rel="noreferrer">
                  View on Stellar.Expert
                </a>
              )}
              <button
                className="close-button"
                onClick={() => {
                  void handleOverlayClose();
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {txStatus === "error" && (
        <div className="modal multisig-tx-modal">
          <div className="modal-content error-screen">
            <div className="error-icon">!</div>
            <h3>Transaction Failed</h3>
            <p>{txModalMessage || "Unable to process transaction."}</p>
            <button
              className="close-button"
              onClick={() => {
                void handleOverlayClose();
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
