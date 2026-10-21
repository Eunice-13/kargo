import { useId } from "react";
import LocationPinPicker, { type LocationPinValue } from "./LocationPinPicker";
export default function DeliveryAddressFields({
  value,
  onChange,
  mapKey,
}: {
  mapKey?: number;
  value: LocationPinValue;
  onChange: (value: LocationPinValue) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-3">
      <LocationPinPicker key={mapKey} value={value} onChange={onChange} />
      <label htmlFor={id} className="block text-xs font-semibold text-[var(--kargo-ink-soft)]">
        Complete delivery address
        <textarea
          id={id}
          rows={3}
          maxLength={1000}
          value={value.address ?? ""}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
          placeholder="Include unit, building, street, city and postal code"
          className="mt-1 w-full rounded-lg border border-[var(--kargo-line)] bg-[var(--kargo-surface)] p-2 font-normal focus-visible:outline-2 focus-visible:outline-[var(--kargo-focus)]"
        />
      </label>
    </div>
  );
}
