import { useState } from "react";
import { AccountMarker } from "./components/AccountMarker";
import { TransferModal } from "./components/TransferModal";
import { useAccounts } from "./hooks/useAccounts";
import type { AccountMeta, AccountLabel } from "./types";

const accountMetas: AccountMeta[] = [
  { label: "A", title: "New York", region: "North America", position: { top: "35%", left: "25%" }, accent: "#ff7b72" },
  { label: "B", title: "Paris", region: "Europe", position: { top: "32%", left: "48%" }, accent: "#f4d35e" },
  { label: "C", title: "Sao Paulo", region: "LatAm", position: { top: "55%", left: "35%" }, accent: "#8ecae6" },
  { label: "D", title: "Singapore", region: "APAC", position: { top: "50%", left: "70%" }, accent: "#c77dff" },
];

export default function App() {
  const { balances, loading, error, refresh } = useAccounts();
  const [activeAccount, setActiveAccount] = useState<AccountLabel | null>(null);

  return (
    <main className="map-shell">
      <div className="map-fullscreen">
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
      <TransferModal from={activeAccount} onClose={() => setActiveAccount(null)} refresh={refresh} />
    </main>
  );
}
