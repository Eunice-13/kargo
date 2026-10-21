import type { BuyerAddress } from "@/services/buyerAddresses";
import type { LocationPinValue } from "./LocationPinPicker";
/** Copy scalar values only: reservations never reference mutable saved-address IDs. */
export const savedAddressPin = (address: BuyerAddress): LocationPinValue => ({
  address: address.address_text,
  lat: address.pin_lat,
  lng: address.pin_lng,
});
export function defaultAddressAutofill(value: LocationPinValue, addresses: BuyerAddress[]) {
  if (value.lat != null || value.lng != null || value.address || value.isResolvingAddress)
    return undefined;
  return addresses.find((a) => a.is_default);
}
