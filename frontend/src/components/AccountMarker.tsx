import type { AccountMeta } from "../types";

type Props = {
  meta: AccountMeta;
  balance: string;
  onSelect: (label: AccountMeta["label"]) => void;
};

export function AccountMarker({ meta, balance, onSelect }: Props) {
  const formattedBalance = parseFloat(balance).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
  const assetLabel = meta.asset ?? "USDC";
  const buttonLabel = meta.ctaLabel ?? `SEND ${assetLabel}`;

  return (
    <div
      className={`account-marker ${meta.kind ?? "wallet"}`}
      style={{ top: meta.position.top, left: meta.position.left, borderColor: meta.accent }}
    >
      <span className="account-label" style={{ background: meta.accent }}>
        {meta.label}
      </span>
      <strong>{meta.title}</strong>
      <span className="account-balance">
        {formattedBalance} {assetLabel}
      </span>
      <span className="account-region">{meta.region}</span>
      <button className="send-action" type="button" onClick={() => onSelect(meta.label)}>
        {buttonLabel}
      </button>
    </div>
  );
}
