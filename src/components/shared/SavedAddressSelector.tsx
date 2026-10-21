import { useEffect, useId, useRef, useState } from "react";
import type { LocationPinValue } from "./LocationPinPicker";
import useBuyerAddresses from "./useBuyerAddresses";
import { requestAddressSettings } from "@/state/navIntent";
import { savedAddressPin, defaultAddressAutofill } from "./savedAddressSelection";
export default function SavedAddressSelector({
  value,
  onChange,
  onManage,
}: {
  value: LocationPinValue;
  onChange: (value: LocationPinValue) => void;
  onManage: () => void;
}) {
  const { addresses, loading, error } = useBuyerAddresses();
  const [selected, setSelected] = useState("");
  const initialized = useRef(false);
  const id = useId();
  useEffect(() => {
    if (loading || initialized.current) return;
    initialized.current = true;
    const next = defaultAddressAutofill(value, addresses);
    if (next) {
      setSelected(next.id);
      onChange(savedAddressPin(next));
    }
  }, [loading, addresses, value, onChange]);
  const current = addresses.find((a) => a.id === selected);
  const selection =
    current &&
    current.pin_lat === value.lat &&
    current.pin_lng === value.lng &&
    current.address_text === value.address
      ? selected
      : "";
  return (
    <div className="space-y-2 text-xs text-[var(--kargo-muted)]">
      {loading ? (
        <p role="status">Loading saved addresses…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : addresses.length ? (
        <label htmlFor={id} className="block font-semibold text-[var(--kargo-ink-soft)]">
          Saved delivery address
          <select
            id={id}
            value={selection}
            onChange={(e) => {
              setSelected(e.target.value);
              const address = addresses.find((a) => a.id === e.target.value);
              onChange(address ? savedAddressPin(address) : {});
            }}
            className="mt-1 min-h-11 w-full rounded-lg border border-[var(--kargo-line)] bg-[var(--kargo-surface)] px-2 focus-visible:outline-2 focus-visible:outline-[var(--kargo-focus)]"
          >
            <option value="">One-time custom address</option>
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
                {a.is_default ? " (Default)" : ""} — {a.address_text}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div>
          <p className="font-semibold text-[var(--kargo-ink)]">No saved address yet</p>
          <p>
            You can enter a delivery address below, or save one in Settings for faster future
            reservations.
          </p>
        </div>
      )}
      {!loading && (
        <button
          type="button"
          className="min-h-11 text-left font-semibold text-[var(--kargo-navy)] underline focus-visible:outline-2 focus-visible:outline-[var(--kargo-focus)]"
          onClick={() => {
            requestAddressSettings();
            onManage();
          }}
        >
          Manage Addresses in Settings
        </button>
      )}
      {selection && <p>Changes below apply only to this reservation, not your saved address.</p>}
    </div>
  );
}
