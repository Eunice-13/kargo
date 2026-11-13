import { useEffect, useMemo, useState } from "react";
import { Check, ClipboardList, History, Printer, Search, RotateCcw } from "lucide-react";
import type { BatchType, ClaimRow } from "@/types";
import { Modal } from "@/components/shared";

const CONFIRMED = "payment_confirmed";
const STORAGE_KEY = "kargo-buying-list-checked";
const isPaymentConfirmed = (claim: ClaimRow) =>
  claim.orderStatus === CONFIRMED || claim.status === "Paid and Reserved";

type BuyingRow = { id: string; batch: string; product: string; qty: number; buyers: string[] };

export default function BatchBuyingListModal({
  batches,
  claims,
  onClose,
}: {
  batches: BatchType[];
  claims: ClaimRow[];
  onClose: () => void;
}) {
  const [batchFilter, setBatchFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [restoreConfirm, setRestoreConfirm] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"); } catch { return {}; }
  });
  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(checked)), [checked]);

  const batchNames = useMemo(() => {
    const owned = new Set(batches.map((batch) => batch.title));
    return [...new Set(claims.filter((c) => isPaymentConfirmed(c) && owned.has(c.batch)).map((c) => c.batch))].sort();
  }, [batches, claims]);
  const rows = useMemo<BuyingRow[]>(() => {
    const owned = new Set(batches.map((batch) => batch.title));
    const confirmed = claims.filter((claim) => owned.has(claim.batch) && isPaymentConfirmed(claim) && (batchFilter === "all" || claim.batch === batchFilter));
    const grouped = new Map<string, BuyingRow>();
    for (const claim of confirmed) {
      const id = `${claim.batch}:${claim.product}`;
      const row = grouped.get(id) ?? { id, batch: claim.batch, product: claim.product, qty: 0, buyers: [] };
      row.qty += claim.qty;
      // Quantity is shown once in the dedicated Qty column; keep this column
      // for the buyer names only.
      row.buyers.push(claim.buyer ?? "Buyer");
      grouped.set(id, row);
    }
    return [...grouped.values()].filter((row) => {
      const haystack = `${row.batch} ${row.product}`.toLowerCase();
      return (showHistory ? checked[row.id] : !checked[row.id]) && (!query || haystack.includes(query.toLowerCase()));
    }).sort((a, b) => a.batch.localeCompare(b.batch) || a.product.localeCompare(b.product));
  }, [batchFilter, batches, checked, claims, query, showHistory]);
  const totalUnits = rows.reduce((sum, row) => sum + row.qty, 0);

  return (
    <Modal onClose={onClose} title="Buying list" width={780}>
      <div className="buying-list-modal">
        <div className="buying-list-modal__toolbar">
          <div>
            <p className="buying-list-modal__eyebrow">Confirmed orders</p>
            <h2>{showHistory ? "Checked history" : "To buy"}</h2>
            <p>{rows.length} item{rows.length === 1 ? "" : "s"} · {totalUnits} units {showHistory ? "checked" : "to source"}</p>
          </div>
          <div className="buying-list-modal__actions">
            <button type="button" onClick={() => window.print()}><Printer size={15} /> Print</button>
          </div>
        </div>
        <div className="buying-list-modal__filters">
          <label>Batch
            <select value={batchFilter} onChange={(event) => setBatchFilter(event.target.value)}>
              <option value="all">All confirmed batches</option>
              {batchNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="buying-list-modal__search"><Search size={16} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find an item or batch" aria-label="Find an item or batch" /></label>
          <button type="button" className="buying-list-modal__history" onClick={() => setShowHistory((value) => !value)}><History size={15} /> {showHistory ? "Back to to-buy list" : "Checked history"}</button>
        </div>
        <div className="buying-list-modal__table-wrap">
          <table className="buying-list-modal__table">
            <thead><tr><th scope="col">{showHistory ? "Restore" : "Done"}</th><th scope="col">Batch</th><th scope="col">Item</th><th scope="col">Qty</th><th scope="col">Claimed by</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.id} className={checked[row.id] ? "is-checked" : undefined}>
              <td><button
                type="button"
                className={`buying-list-modal__check${selectedIds.has(row.id) ? " is-confirming" : ""}`}
                onClick={() => {
                  setSelectedIds((current) => {
                    const next = new Set(current);
                    if (next.has(row.id)) next.delete(row.id); else next.add(row.id);
                    return next;
                  });
                }}
                aria-label={showHistory ? `Restore ${row.product}` : `${selectedIds.has(row.id) ? "Unselect" : "Select"} ${row.product}`}
              >
                {showHistory ? <RotateCcw size={14} /> : <Check size={15} />}
              </button></td>
              <td>{row.batch}</td><td><strong>{row.product}</strong></td><td><strong className="buying-list-modal__qty">{row.qty}</strong></td><td>{row.buyers.join(" · ")}</td>
            </tr>)}</tbody>
          </table>
          {!rows.length && <div className="buying-list-modal__empty"><ClipboardList size={28} /><strong>{showHistory ? "No checked items" : "Nothing to buy yet"}</strong><span>{showHistory ? "Checked items will appear here for recovery." : "Only payment-confirmed claims appear in this list."}</span></div>}
        </div>
        {selectedIds.size > 0 && <button type="button" className="buying-list-modal__done" onClick={() => {
          if (showHistory) { setRestoreConfirm(true); return; }
          setChecked((current) => ({ ...current, ...Object.fromEntries([...selectedIds].map((id) => [id, true])) }));
          setSelectedIds(new Set());
        }}>{showHistory ? "Done — restore" : "Done — mark"} {selectedIds.size} item{selectedIds.size === 1 ? "" : "s"}</button>}
        <p className="buying-list-modal__note">Only orders whose database status is payment confirmed are included. Checked items are saved on this device and can be restored from Checked history.</p>
      </div>
      {restoreConfirm && <Modal onClose={() => setRestoreConfirm(false)} title="Restore checked items?" width={390}>
        <div className="buying-list-modal__confirm">
          <p>Are you sure you want to restore {selectedIds.size} item{selectedIds.size === 1 ? "" : "s"} to the To Buy list?</p>
          <div><button type="button" onClick={() => setRestoreConfirm(false)}>Cancel</button><button type="button" className="buying-list-modal__done" onClick={() => { setChecked((current) => ({ ...current, ...Object.fromEntries([...selectedIds].map((id) => [id, false])) })); setSelectedIds(new Set()); setRestoreConfirm(false); }}>Restore items</button></div>
        </div>
      </Modal>}
    </Modal>
  );
}
