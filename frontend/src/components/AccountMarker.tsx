import type { AccountMeta } from "../types";

type Props = {
  meta: AccountMeta;
  balance: string;
  onSelect: (label: AccountMeta["label"]) => void;
};

export function AccountMarker({ meta, balance, onSelect }: Props) {
  return (
    <button
      className="account-marker"
      style={{ top: meta.position.top, left: meta.position.left, borderColor: meta.accent }}
      onClick={() => onSelect(meta.label)}
    >
      <span className="account-label" style={{ background: meta.accent }}>
        {meta.label}
      </span>
      <strong>{meta.title}</strong>
      <span className="account-balance">{parseFloat(balance).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC</span>
      <span className="account-region">{meta.region}</span>
    </button>
  );
}
