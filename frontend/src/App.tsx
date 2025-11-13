import { useMemo, useState } from "react";
import { AccountMarker } from "./components/AccountMarker";
import { TransferModal } from "./components/TransferModal";
import { useAccounts } from "./hooks/useAccounts";
import type { AccountLabel, AccountMeta } from "./types";

const accountMetas: AccountMeta[] = [
  { label: "A", title: "New York", region: "North America", position: { top: "35%", left: "25%" }, accent: "#ff7b72" },
  { label: "B", title: "Paris", region: "Europe", position: { top: "32%", left: "48%" }, accent: "#f4d35e" },
  { label: "C", title: "Sao Paulo", region: "LatAm", position: { top: "55%", left: "35%" }, accent: "#8ecae6" },
  { label: "D", title: "Singapore", region: "APAC", position: { top: "50%", left: "70%" }, accent: "#c77dff" },
];

function getMeta(label: AccountLabel) {
  return accountMetas.find((meta) => meta.label === label)!;
}

export default function App() {
  const { balances, loading, error, refresh } = useAccounts();
  const [activeAccount, setActiveAccount] = useState<AccountLabel | null>(null);

  const cards = useMemo(
    () => accountMetas.map((meta) => ({ ...meta, balance: balances[meta.label] })),
    [balances]
  );

  return (
    <div className="app">
      <section className="hero">
        <div className="copy">
          <p className="eyebrow">OpenZeppelin Smart Accounts + Soroban</p>
          <h1>Global remittances with compliant guardrails</h1>
          <p>
            Trigger USDC payouts between pre-authorized smart accounts. The on-chain policy ensures funds only
            move between trusted corridors while admins keep full emergency controls.
          </p>
          <div className="stats">
            {cards.map(({ label, balance }) => (
              <div key={label}>
                <span>{balance} USDC</span>
                <small>Account {label}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="map">
          {loading && <div className="loading">Refreshing balances…</div>}
          {error && <div className="error">{error}</div>}
          {accountMetas.map((meta) => (
            <AccountMarker
              key={meta.label}
              meta={meta}
              balance={balances[meta.label]}
              onSelect={(label) => setActiveAccount(label)}
            />
          ))}
        </div>
      </section>
      <section className="routes">
        <h2>Preset corridors</h2>
        <div className="route-grid">
          {accountMetas.map((meta) => (
            <div key={meta.label} className="route-card">
              <header style={{ borderColor: meta.accent }}>
                <span>Account {meta.label}</span>
                <strong>{getMeta(meta.label).title}</strong>
              </header>
              <p>{meta.region}</p>
              <button onClick={() => setActiveAccount(meta.label)}>Send from {meta.label}</button>
            </div>
          ))}
        </div>
      </section>
      <TransferModal from={activeAccount} onClose={() => setActiveAccount(null)} refresh={refresh} />
    </div>
  );
}
