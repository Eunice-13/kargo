import type { LucideIcon } from "lucide-react"

import ProductThumb from "./ProductThumb"

export default function SummaryBlock({
  title,
  product,
  icon: Icon,
  details,
}: {
  title: string
  product?: string
  icon?: LucideIcon
  details?: string[]
}) {
  return (
    <section className="kargo-summary-block" aria-label={title}>
      {product ? (
        <ProductThumb name={product} />
      ) : Icon ? (
        <span className="kargo-summary-block__icon">
          <Icon size={17} aria-hidden="true" />
        </span>
      ) : null}
      <div>
        <strong>{title}</strong>
        {details?.map((detail) => <span key={detail}>{detail}</span>)}
      </div>
    </section>
  )
}
