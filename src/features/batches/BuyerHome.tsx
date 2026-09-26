import { useMemo, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  FileText,
  Heart,
} from "lucide-react"
import { Avatar } from "@/components/shared"
import {
  BATCH_CATEGORIES,
  batchImage,
  categoryImage,
} from "@/constants/categories"
import type { BatchType } from "@/types"

const PAGE_SIZE = 10

function circularPage<T>(items: T[], start: number, count: number) {
  if (items.length <= count) return items
  return Array.from(
    { length: count },
    (_, index) => items[(start + index) % items.length],
  )
}

function BatchCard({
  batch,
  favorited,
  reactionCount,
  reactionPending,
  onFavorite,
  onOpen,
}: {
  batch: BatchType
  favorited: boolean
  reactionCount: number
  reactionPending: boolean
  onFavorite: () => void
  onOpen: () => void
}) {
  const percentage = Math.min(
    100,
    Math.round((batch.claimed / Math.max(1, batch.items)) * 100),
  )
  const progressColor =
    percentage >= 80 ? "#ef466f" : percentage >= 50 ? "#f2c94c" : "#42c9a5"

  return (
    <article
      className="buyer-batch-card"
      role="button"
      tabIndex={0}
      aria-label={`Open ${batch.title}`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen()
        }
      }}
    >
      <div className="buyer-batch-card__image-wrap">
        <img
          src={batchImage(batch.category, batch.id)}
          alt=""
          className="buyer-batch-card__image"
        />
        <span className="buyer-batch-card__category">{batch.category}</span>
        <button
          type="button"
          className={`buyer-batch-card__favorite${
            favorited ? " is-favorite" : ""
          }`}
          aria-label={
            favorited
              ? `Remove ${batch.title} from favorites`
              : `Add ${batch.title} to favorites`
          }
          aria-pressed={favorited}
          disabled={reactionPending}
          onClick={(event) => {
            event.stopPropagation()
            onFavorite()
          }}
        >
          <Heart
            size={22}
            strokeWidth={2.2}
            fill={favorited ? "currentColor" : "transparent"}
          />
          <span>{reactionCount}</span>
        </button>
      </div>
      <div className="buyer-batch-card__body">
        <h3>{batch.title}</h3>
        <div className="buyer-batch-card__seller">
          <Avatar name={batch.seller} size={21} />
          <span>{batch.seller}</span>
        </div>
        <div className="buyer-batch-card__date">
          <CalendarDays size={12} aria-hidden="true" />
          <span>{batch.trips}</span>
        </div>
        <div className="buyer-batch-card__progress-label">
          <span>
            {batch.claimed}/{batch.items} claimed
          </span>
          <strong style={{ color: progressColor }}>{percentage}%</strong>
        </div>
        <div className="buyer-batch-card__track" aria-hidden="true">
          <span
            style={{ width: `${percentage}%`, background: progressColor }}
          />
        </div>
      </div>
    </article>
  )
}

function CarouselControls({
  onPrevious,
  onNext,
  label,
}: {
  onPrevious: () => void
  onNext: () => void
  label: string
}) {
  return (
    <div className="buyer-carousel-controls" aria-label={`${label} navigation`}>
      <button
        type="button"
        aria-label={`Previous ${label}`}
        onClick={onPrevious}
      >
        <ArrowLeft size={20} strokeWidth={2.8} />
      </button>
      <button type="button" aria-label={`Next ${label}`} onClick={onNext}>
        <ArrowRight size={20} strokeWidth={2.8} />
      </button>
    </div>
  )
}

function BatchSection({
  title,
  batches,
  start,
  onPrevious,
  onNext,
  reactionPending,
  onToggleFavorite,
  onOpenBatch,
}: {
  title: string
  batches: BatchType[]
  start: number
  onPrevious: () => void
  onNext: () => void
  reactionPending: Set<number>
  onToggleFavorite: (batch: BatchType) => void
  onOpenBatch: (batch: BatchType) => void
}) {
  const visible = circularPage(batches, start, PAGE_SIZE)
  return (
    <section className="buyer-home-section">
      <div className="buyer-home-section__heading">
        <h2>{title}</h2>
        <CarouselControls
          label={title}
          onPrevious={onPrevious}
          onNext={onNext}
        />
      </div>
      {visible.length > 0 ? (
        <div className="buyer-batch-grid">
          {visible.map((batch) => (
            <BatchCard
              key={batch.id}
              batch={batch}
              favorited={Boolean(batch.reactedByCurrentUser)}
              reactionCount={batch.reactionCount ?? 0}
              reactionPending={reactionPending.has(batch.id)}
              onFavorite={() => onToggleFavorite(batch)}
              onOpen={() => onOpenBatch(batch)}
            />
          ))}
        </div>
      ) : (
        <div className="buyer-home-empty">No batches match these filters.</div>
      )}
    </section>
  )
}

export default function BuyerHome({
  batches,
  category,
  date,
  onCategoryChange,
  onDateChange,
  onRequestItem,
  onOpenBatch,
  onToggleReaction,
  reactionPending,
}: {
  batches: BatchType[]
  category: string
  date: string
  onCategoryChange: (category: string) => void
  onDateChange: (date: string) => void
  onRequestItem: () => void
  onOpenBatch: (batch: BatchType) => void
  onToggleReaction: (batch: BatchType) => void
  reactionPending: Set<number>
}) {
  const [categoryStart, setCategoryStart] = useState(0)
  const [latestStart, setLatestStart] = useState(0)
  const [popularStart, setPopularStart] = useState(0)

  const dates = useMemo(() => {
    const values = new Set<string>()
    for (const batch of batches) {
      const match = batch.trips.match(
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[^0-9]*(20\d{2})/i,
      )
      if (match) values.add(`${match[1].slice(0, 3)} ${match[2]}`)
    }
    return ["All", ...values]
  }, [batches])

  const filtered = useMemo(
    () =>
      batches.filter((batch) => {
        if (category !== "All" && batch.category !== category) return false
        if (
          date !== "All" &&
          !batch.trips.toLowerCase().includes(date.slice(0, 3).toLowerCase())
        )
          return false
        return true
      }),
    [batches, category, date],
  )

  const latest = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const createdDifference =
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime()
        return createdDifference || Number(b.id) - Number(a.id)
      }),
    [filtered],
  )
  const popular = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => {
          const reactionDifference =
            (b.reactionCount ?? 0) - (a.reactionCount ?? 0)
          if (reactionDifference !== 0) return reactionDifference
          const createdDifference =
            new Date(b.createdAt ?? 0).getTime() -
            new Date(a.createdAt ?? 0).getTime()
          if (createdDifference !== 0) return createdDifference
          return Number(b.id) - Number(a.id)
        })
        .slice(0, PAGE_SIZE),
    [filtered],
  )

  const visibleCategories = circularPage(
    [...BATCH_CATEGORIES],
    categoryStart,
    5,
  )
  const advance = (
    setter: React.Dispatch<React.SetStateAction<number>>,
    length: number,
    direction: number,
    step = 1,
  ) => {
    if (length <= 1) return
    setter((current) => (current + direction * step + length) % length)
  }
  return (
    <div className="buyer-home">
      <div className="buyer-home-filter">
        <strong>Filter:</strong>
        <select
          aria-label="Filter batches by category"
          value={category}
          onChange={(event) => onCategoryChange(event.target.value)}
        >
          {["All", ...BATCH_CATEGORIES].map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
        <select
          aria-label="Filter batches by date"
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
        >
          {dates.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
        <button
          type="button"
          className="buyer-home-filter__request"
          onClick={onRequestItem}
        >
          <FileText size={15} aria-hidden="true" /> Request Item
        </button>
      </div>

      <div className="buyer-home__content">
        <section className="buyer-home-section buyer-category-section">
          <div className="buyer-home-section__heading">
            <h2>Shop By Categories</h2>
            <CarouselControls
              label="categories"
              onPrevious={() =>
                advance(setCategoryStart, BATCH_CATEGORIES.length, -1)
              }
              onNext={() =>
                advance(setCategoryStart, BATCH_CATEGORIES.length, 1)
              }
            />
          </div>
          <div className="buyer-category-grid">
            {visibleCategories.map((item) => (
              <button
                type="button"
                key={item}
                className={category === item ? "is-selected" : ""}
                aria-pressed={category === item}
                onClick={() =>
                  onCategoryChange(category === item ? "All" : item)
                }
              >
                <img src={categoryImage(item)} alt="" />
                <span>{item}</span>
              </button>
            ))}
          </div>
        </section>

        <BatchSection
          title="Latest Batches"
          batches={latest}
          start={latestStart}
          onPrevious={() =>
            advance(setLatestStart, latest.length, -1, PAGE_SIZE)
          }
          onNext={() => advance(setLatestStart, latest.length, 1, PAGE_SIZE)}
          reactionPending={reactionPending}
          onToggleFavorite={onToggleReaction}
          onOpenBatch={onOpenBatch}
        />
        <BatchSection
          title="Popular Batches"
          batches={popular}
          start={popularStart}
          onPrevious={() =>
            advance(setPopularStart, popular.length, -1, PAGE_SIZE)
          }
          onNext={() => advance(setPopularStart, popular.length, 1, PAGE_SIZE)}
          reactionPending={reactionPending}
          onToggleFavorite={onToggleReaction}
          onOpenBatch={onOpenBatch}
        />
      </div>
    </div>
  )
}
