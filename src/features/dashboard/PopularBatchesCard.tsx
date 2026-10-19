import { Heart } from "lucide-react";
import { Card } from "@/components/shared";
import type { BatchType } from "@/types";

const reactionCount = (batch: BatchType) => batch.reactionCount ?? 0;

export default function PopularBatchesCard({
  batches,
  sellerName,
  onOpenBatch,
}: {
  batches: BatchType[];
  sellerName: string;
  onOpenBatch: (batch: BatchType) => void;
}) {
  const mine = batches.filter((batch) => batch.seller === sellerName);
  const top = mine
    .filter((batch) => reactionCount(batch) > 0)
    .sort((a, b) => reactionCount(b) - reactionCount(a) || b.id - a.id)
    .slice(0, 3);
  const totalReactions = mine.reduce((sum, batch) => sum + reactionCount(batch), 0);

  return (
    <Card className="seller-popular-batches">
      <div className="seller-popular-batches__header">
        <h2>
          <Heart size={16} aria-hidden="true" /> Popular Batches
        </h2>
      </div>

      {top.length > 0 ? (
        <div className="seller-popular-batches__list">
          {top.map((batch, index) => {
            const count = reactionCount(batch);
            return (
              <button
                type="button"
                className="seller-popular-batches__row"
                key={batch.id}
                aria-label={`Open ${batch.title} — ${count} reactions`}
                onClick={() => onOpenBatch(batch)}
              >
                <span className="seller-popular-batches__rank">{index + 1}</span>
                <strong>{batch.title}</strong>
                <span className="seller-popular-batches__count">
                  <Heart size={12} strokeWidth={2.2} fill="currentColor" aria-hidden="true" />
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="seller-waitlist-empty">
          {mine.length > 0
            ? "No reactions yet. Buyers tap the heart on your batches to show interest."
            : "Publish a batch to start collecting reactions."}
        </p>
      )}

      {top.length > 0 && (
        <p className="seller-popular-batches__total">{totalReactions} total reactions</p>
      )}
    </Card>
  );
}
