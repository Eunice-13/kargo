import "./combinedDelivery.css";
import SecondaryBtn from "@/components/shared/SecondaryBtn";

/** Optional feature availability never replaces the surrounding reservations. */
export default function DeliveryAvailabilityNotice({
  error,
  unavailable,
  loading,
  onRetry,
}: {
  error: string;
  unavailable: boolean;
  loading: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="delivery-availability-notice mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs">
      <p
        role={unavailable ? "status" : "alert"}
        className="min-w-0 flex-1 break-words text-[var(--kargo-muted)]"
      >
        {error}
      </p>
      <SecondaryBtn disabled={loading} onClick={onRetry}>
        {unavailable ? "Check again" : "Retry"}
      </SecondaryBtn>
    </div>
  );
}
