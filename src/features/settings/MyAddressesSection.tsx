import { useRef, useState } from "react";
import { MapPin } from "lucide-react";
import Modal from "@/components/shared/Modal";
import PrimaryBtn from "@/components/shared/PrimaryBtn";
import SecondaryBtn from "@/components/shared/SecondaryBtn";
import DeliveryAddressFields from "@/components/shared/DeliveryAddressFields";
import type { LocationPinValue } from "@/components/shared/LocationPinPicker";
import useBuyerAddresses from "@/components/shared/useBuyerAddresses";
import { savedAddressPin } from "@/components/shared/savedAddressSelection";
import { saveBuyerAddress, changeBuyerAddress, type BuyerAddress } from "@/services/buyerAddresses";
export default function MyAddressesSection() {
  const { addresses, loading, error, reload } = useBuyerAddresses();
  const [editing, setEditing] = useState<BuyerAddress | "new" | null>(null);
  const [deleting, setDeleting] = useState<BuyerAddress | null>(null);
  const [pin, setPin] = useState<LocationPinValue>({});
  const [label, setLabel] = useState("Home");
  const [makeDefault, setMakeDefault] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const pending = useRef(false);
  async function perform(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setFailure("");
    try {
      await action();
      setEditing(null);
      setDeleting(null);
      await reload();
    } catch (e) {
      setFailure(
        e && typeof e === "object" && "message" in e
          ? String(e.message)
          : "Unable to save address changes.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  function edit(address: BuyerAddress | "new") {
    setFailure("");
    setEditing(address);
    setLabel(address === "new" ? "Home" : address.label);
    setPin(address === "new" ? {} : savedAddressPin(address));
    setMakeDefault(address === "new" ? addresses.length === 0 : address.is_default);
  }
  const valid = Boolean(
    label.trim() &&
    pin.address?.trim() &&
    !pin.isResolvingAddress &&
    Number.isFinite(pin.lat) &&
    Number.isFinite(pin.lng) &&
    Math.abs(pin.lat!) <= 90 &&
    Math.abs(pin.lng!) <= 180,
  );
  return (
    <section
      id="my-addresses"
      tabIndex={-1}
      className="space-y-4 text-sm text-[var(--kargo-ink-soft)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-[var(--kargo-ink)]">
            <MapPin size={18} aria-hidden="true" />
            My Addresses
          </h2>
          <p className="mt-1 text-xs text-[var(--kargo-muted)]">
            Save up to 2 delivery addresses for faster claiming.
          </p>
        </div>
        <span className="shrink-0 text-xs" aria-label={`${addresses.length} of 2 addresses saved`}>
          {addresses.length}/2
        </span>
      </div>
      {loading && <p role="status">Loading addresses…</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <SecondaryBtn onClick={() => void reload()}>Try again</SecondaryBtn>
        </div>
      )}
      {failure && !editing && !deleting && <p role="alert">{failure}</p>}
      {!loading && !error && addresses.length === 0 && (
        <p className="text-xs text-[var(--kargo-muted)]">No saved address yet.</p>
      )}
      {addresses.map((a) => (
        <article key={a.id} className="min-w-0 rounded-lg border border-[var(--kargo-line)] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold [overflow-wrap:anywhere]">{a.label}</h3>
            {a.is_default && <span className="text-xs text-[var(--kargo-muted)]">Default</span>}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-xs [overflow-wrap:anywhere]">
            {a.address_text}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <SecondaryBtn
              disabled={busy || loading}
              onClick={() => edit(a)}
              ariaLabel={`Edit ${a.label}`}
            >
              Edit
            </SecondaryBtn>
            <SecondaryBtn
              disabled={busy || loading}
              onClick={() => {
                setFailure("");
                setDeleting(a);
              }}
              ariaLabel={`Delete ${a.label}`}
            >
              Delete
            </SecondaryBtn>
            {!a.is_default && (
              <SecondaryBtn
                disabled={busy || loading}
                onClick={() => void perform(() => changeBuyerAddress("default", a.id))}
              >
                Set as Default
              </SecondaryBtn>
            )}
          </div>
        </article>
      ))}
      <div>
        <PrimaryBtn
          disabled={loading || busy || Boolean(error) || addresses.length >= 2}
          onClick={() => edit("new")}
        >
          Add Address
        </PrimaryBtn>
        {addresses.length >= 2 && (
          <p className="mt-2 text-xs text-[var(--kargo-muted)]">
            You have 2 saved addresses. Edit or delete one to add another.
          </p>
        )}
      </div>
      {editing && (
        <Modal
          title={editing === "new" ? "Add Address" : "Edit Address"}
          width={520}
          onClose={() => {
            if (!busy) setEditing(null);
          }}
        >
          <div className="space-y-4">
            <label className="block text-xs font-semibold">
              Address label
              <input
                value={label}
                maxLength={60}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Home, Work, or a custom label"
                className="mt-1 min-h-11 w-full rounded-lg border border-[var(--kargo-line)] p-2 focus-visible:outline-2 focus-visible:outline-[var(--kargo-focus)]"
              />
            </label>
            <DeliveryAddressFields value={pin} onChange={setPin} />
            <label className="flex min-h-11 items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={makeDefault}
                onChange={(e) => setMakeDefault(e.target.checked)}
              />
              Set as default address
            </label>
            {failure && (
              <p role="alert" className="text-xs text-red-700">
                {failure}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <SecondaryBtn disabled={busy} onClick={() => setEditing(null)}>
                Cancel
              </SecondaryBtn>
              <PrimaryBtn
                disabled={busy || !valid}
                loading={busy}
                onClick={() =>
                  void perform(() =>
                    saveBuyerAddress(editing === "new" ? null : editing.id, {
                      label,
                      address_text: pin.address!,
                      pin_lat: pin.lat!,
                      pin_lng: pin.lng!,
                      is_default: makeDefault,
                    }),
                  )
                }
              >
                Save Address
              </PrimaryBtn>
            </div>
          </div>
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Delete address?"
          width={420}
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
        >
          <p className="text-sm [overflow-wrap:anywhere]">
            Delete “{deleting.label}”? Existing reservations will keep their delivery details.
          </p>
          {failure && (
            <p role="alert" className="mt-2 text-xs text-red-700">
              {failure}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <SecondaryBtn disabled={busy} onClick={() => setDeleting(null)}>
              Cancel
            </SecondaryBtn>
            <PrimaryBtn
              disabled={busy}
              loading={busy}
              onClick={() => void perform(() => changeBuyerAddress("delete", deleting.id))}
            >
              Delete Address
            </PrimaryBtn>
          </div>
        </Modal>
      )}
    </section>
  );
}
