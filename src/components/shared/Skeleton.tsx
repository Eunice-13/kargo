export function CardSkeleton() {
  return (
    <div className="kargo-skeleton-card" aria-hidden="true">
      <span className="kargo-skeleton kargo-skeleton--avatar" />
      <div>
        <span className="kargo-skeleton" />
        <span className="kargo-skeleton is-short" />
      </div>
    </div>
  )
}

export function RowSkeleton() {
  return (
    <div className="kargo-skeleton-row" aria-hidden="true">
      <span className="kargo-skeleton" />
      <span className="kargo-skeleton is-short" />
    </div>
  )
}

export default function Skeleton() {
  return <span className="kargo-skeleton" aria-hidden="true" />
}
