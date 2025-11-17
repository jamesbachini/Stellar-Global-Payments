import { useState, useEffect } from "react";
import { AccountMarker } from "./components/AccountMarker";
import { TransferModal } from "./components/TransferModal";
import { useAccounts } from "./hooks/useAccounts";
import { useForexBalances } from "./hooks/useForexBalances";
import { useMultisigState } from "./hooks/useMultisigState";
import { ForexModal } from "./components/ForexModal";
import { MultisigModal } from "./components/MultisigModal";
import type { AccountMeta, AccountLabel, ForexLocation } from "./types";

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

type TabKey = "payments" | "forex" | "multisig";

const paymentAccountMetas: AccountMeta[] = [
  { label: "A", title: "New York", region: "North America", position: { top: "33%", left: "25%" }, accent: "#ff7b72" },
  { label: "B", title: "London", region: "Europe", position: { top: "23%", left: "46%" }, accent: "#f4d35e" },
  { label: "C", title: "Buenos Aires", region: "LatAm", position: { top: "73%", left: "32%" }, accent: "#8ecae6" },
  { label: "D", title: "Singapore", region: "APAC", position: { top: "50%", left: "77%" }, accent: "#c77dff" },
];

const forexAccountMetas: AccountMeta[] = [
  {
    label: "A",
    title: "New York",
    region: "North America",
    position: { top: "33%", left: "30%" },
    accent: "#4cc9f0",
    asset: "USDC",
    ctaLabel: "FX TRANSFER",
  },
  {
    label: "B",
    title: "London",
    region: "Europe",
    position: { top: "23%", left: "55%" },
    accent: "#f4d35e",
    asset: "EURC",
    ctaLabel: "FX TRANSFER",
  },
];

const forexLocationByLabel: Partial<Record<AccountLabel, ForexLocation>> = {
  A: "NEW_YORK",
  B: "LONDON",
};

const tabs: { id: TabKey; label: string }[] = [
  { id: "payments", label: "Payments" },
  { id: "forex", label: "Forex" },
  { id: "multisig", label: "Multisig" },
];

export default function App() {
  const { balances, loading, error, refresh } = useAccounts();
  const {
    balances: forexBalances,
    loading: forexLoading,
    error: forexError,
    refresh: refreshForex,
  } = useForexBalances();
  const [activeAccount, setActiveAccount] = useState<AccountLabel | null>(null);
  const [activeForexLocation, setActiveForexLocation] = useState<ForexLocation | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("payments");
  const [showMultisigModal, setShowMultisigModal] = useState<boolean>(false);
  const isPortrait = useOrientation();
  const {
    state: multisigState,
    loading: multisigLoading,
    error: multisigError,
    refresh: refreshMultisig,
  } = useMultisigState();

  useEffect(() => {
    setActiveAccount(null);
    setActiveForexLocation(null);
    setShowMultisigModal(false);
  }, [activeTab]);

  const refreshForTab = () => {
    refresh();
    if (activeTab === "multisig") {
      refreshMultisig();
    }
  };

  const renderPayments = () => (
    <>
      {loading && <div className="loading">Refreshing balances…</div>}
      {error && <div className="error-banner">{error}</div>}
      {paymentAccountMetas.map((meta) => (
        <AccountMarker
          key={meta.label}
          meta={meta}
          balance={balances[meta.label]}
          onSelect={(label) => setActiveAccount(label)}
        />
      ))}
    </>
  );

  const renderForex = () => (
    <>
      {forexLoading && <div className="loading">Refreshing forex balances…</div>}
      {forexError && <div className="error-banner">{forexError}</div>}
      {forexAccountMetas.map((meta) => (
        <AccountMarker
          key={meta.label}
          meta={meta}
          balance={
            meta.label === forexBalances.newYork.account
              ? forexBalances.newYork.balance
              : meta.label === forexBalances.london.account
              ? forexBalances.london.balance
              : "0"
          }
          onSelect={(label) => {
            const location = forexLocationByLabel[label];
            if (location) {
              setActiveForexLocation(location);
            }
          }}
        />
      ))}
    </>
  );

  const renderMultisig = () => (
    <>
      {(loading || multisigLoading) && (
        <div className="loading">Refreshing treasury balances…</div>
      )}
      {error && <div className="error-banner">{error}</div>}
      {multisigError && <div className="error-banner">{multisigError}</div>}
      {paymentAccountMetas.map((meta) => (
        <AccountMarker
          key={meta.label}
          meta={meta}
          balance={balances[meta.label]}
          onSelect={(label) => setActiveAccount(label)}
        />
      ))}
      <AccountMarker
        key="multisig"
        meta={{
          label: "MULTISIG",
          title: multisigState.label,
          region: "Global Treasury",
          position: { top: "82%", left: "48%" },
          accent: "#14b8a6",
          asset: "USDC",
          ctaLabel: "OPEN MULTISIG",
          kind: "multisig",
        }}
        balance={multisigState.balance}
        onSelect={() => setShowMultisigModal(true)}
      />
    </>
  );

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
        <div className="tab-container">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab ${tab.id === activeTab ? "active" : ""}`}
              type="button"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "payments" && renderPayments()}
        {activeTab === "forex" && renderForex()}
        {activeTab === "multisig" && renderMultisig()}
      </div>
      <TransferModal
        from={activeAccount}
        mode={activeTab === "multisig" ? "multisig" : "payments"}
        onClose={() => setActiveAccount(null)}
        refresh={refreshForTab}
      />
      <ForexModal
        origin={activeForexLocation}
        onClose={() => setActiveForexLocation(null)}
        refresh={refreshForex}
      />
      <MultisigModal
        open={showMultisigModal}
        state={multisigState}
        onClose={() => setShowMultisigModal(false)}
        refresh={async () => {
          await refreshMultisig();
          await refresh();
        }}
      />
    </main>
  );
}
