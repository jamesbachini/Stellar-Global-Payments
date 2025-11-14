import { useState, useEffect } from "react";
import { AccountMarker } from "./components/AccountMarker";
import { TransferModal } from "./components/TransferModal";
import { useAccounts } from "./hooks/useAccounts";
import type { AccountMeta, AccountLabel } from "./types";

function useOrientation() {
  const [isPortrait, setIsPortrait] = useState(
    window.innerHeight > window.innerWidth
  );

  useEffect(() => {
    const handleResize = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  return isPortrait;
}

const accountMetas: AccountMeta[] = [
  { label: "A", title: "New York", region: "North America", position: { top: "33%", left: "25%" }, accent: "#ff7b72" },
  { label: "B", title: "London", region: "Europe", position: { top: "23%", left: "46%" }, accent: "#f4d35e" },
  { label: "C", title: "Buenos Aires", region: "LatAm", position: { top: "73%", left: "32%" }, accent: "#8ecae6" },
  { label: "D", title: "Singapore", region: "APAC", position: { top: "50%", left: "77%" }, accent: "#c77dff" },
];

export default function App() {
  const { balances, loading, error, refresh } = useAccounts();
  const [activeAccount, setActiveAccount] = useState<AccountLabel | null>(null);
  const isPortrait = useOrientation();

  return (
    <main className="map-shell">
      {isPortrait && (
        <div className="orientation-overlay">
          <div className="orientation-content">
            <svg className="rotate-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="2" width="16" height="20" rx="2" />
              <path d="M12 18h.01" />
            </svg>
            <h2>Please rotate your device</h2>
            <p>This experience is best viewed in landscape mode</p>
          </div>
        </div>
      )}
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
