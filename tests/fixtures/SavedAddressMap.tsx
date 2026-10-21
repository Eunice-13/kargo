export default function SavedAddressMap({ value }: { value: { lat?: number; lng?: number } }) {
  return <div aria-label="Existing interactive map" data-lat={value.lat} data-lng={value.lng} />;
}
