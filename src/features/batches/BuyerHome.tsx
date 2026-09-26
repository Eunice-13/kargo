import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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

function useHorizontalCarousel(itemCount: number) {
  const trackRef = useRef<HTMLDivElement>(null)
  const drag = useRef({ active: false, moved: false, startX: 0, scrollLeft: 0 })
  const suppressClick = useRef(false)
  const [canPrevious, setCanPrevious] = useState(false)
  const [canNext, setCanNext] = useState(false)

  const updateBounds = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth)
    setCanPrevious(track.scrollLeft > 2)
    setCanNext(track.scrollLeft < maxScroll - 2)
  }, [])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    track.scrollTo({ left: 0 })
    const frame = window.requestAnimationFrame(updateBounds)
    const observer = new ResizeObserver(updateBounds)
    observer.observe(track)
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [itemCount, updateBounds])

  const scroll = (direction: -1 | 1) => {
    const track = trackRef.current
    if (!track) return
    track.scrollBy({
      left: direction * Math.max(240, track.clientWidth * 0.92),
      behavior: "smooth",
    })
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return
    const track = trackRef.current
    if (!track) return
    drag.current = {
      active: true,
      moved: false,
      startX: event.clientX,
      scrollLeft: track.scrollLeft,
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current
    if (!track || !drag.current.active) return
    const distance = event.clientX - drag.current.startX
    if (!drag.current.moved && Math.abs(distance) > 5) {
      drag.current.moved = true
      track.setPointerCapture(event.pointerId)
      track.classList.add("is-dragging")
    }
    if (drag.current.moved)
      track.scrollLeft = drag.current.scrollLeft - distance
  }

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current
    if (!track || !drag.current.active) return
    suppressClick.current = drag.current.moved
    drag.current.active = false
    if (drag.current.moved) {
      track.classList.remove("is-dragging")
      if (track.hasPointerCapture(event.pointerId)) {
        track.releasePointerCapture(event.pointerId)
      }
    }
    window.requestAnimationFrame(updateBounds)
    window.setTimeout(() => {
      suppressClick.current = false
    }, 0)
  }

  return {
    trackRef,
    canPrevious,
    canNext,
    scroll,
    trackProps: {
      onScroll: updateBounds,
      onPointerDown,
      onPointerMove,
      onPointerUp: finishDrag,
      onPointerCancel: finishDrag,
      onClickCapture: (event: React.MouseEvent<HTMLDivElement>) => {
        if (!suppressClick.current) return
        event.preventDefault()
        event.stopPropagation()
      },
    },
  }
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
          draggable={false}
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
  canPrevious,
  canNext,
  label,
}: {
  onPrevious: () => void
  onNext: () => void
  canPrevious: boolean
  canNext: boolean
  label: string
}) {
  return (
    <div className="buyer-carousel-controls" aria-label={`${label} navigation`}>
      <button
        type="button"
        aria-label={`Previous ${label}`}
        onClick={onPrevious}
        disabled={!canPrevious}
      >
        <ArrowLeft size={20} strokeWidth={2.8} />
      </button>
      <button
        type="button"
        aria-label={`Next ${label}`}
        onClick={onNext}
        disabled={!canNext}
      >
        <ArrowRight size={20} strokeWidth={2.8} />
      </button>
    </div>
  )
}

function BatchSection({
  title,
  batches,
  showControls = true,
  reactionPending,
  onToggleFavorite,
  onOpenBatch,
}: {
  title: string
  batches: BatchType[]
  showControls?: boolean
  reactionPending: Set<number>
  onToggleFavorite: (batch: BatchType) => void
  onOpenBatch: (batch: BatchType) => void
}) {
  const pages = useMemo(
    () =>
      Array.from({ length: Math.ceil(batches.length / 10) }, (_, index) =>
        batches.slice(index * 10, index * 10 + 10),
      ),
    [batches],
  )
  const carousel = useHorizontalCarousel(pages.length)
  return (
    <section className="buyer-home-section">
      <div className="buyer-home-section__heading">
        <h2>{title}</h2>
        {showControls && (
          <CarouselControls
            label={title}
            onPrevious={() => carousel.scroll(-1)}
            onNext={() => carousel.scroll(1)}
            canPrevious={carousel.canPrevious}
            canNext={carousel.canNext}
          />
        )}
      </div>
      {batches.length > 0 ? (
        <div
          ref={carousel.trackRef}
          className="buyer-batch-grid buyer-carousel-track"
          aria-label={`${title} carousel`}
          {...carousel.trackProps}
        >
          {pages.map((page, pageIndex) => (
            <div
              className="buyer-batch-page"
              key={page.map((batch) => batch.id).join("-") || pageIndex}
            >
              {page.map((batch) => (
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
  const categoryCarousel = useHorizontalCarousel(BATCH_CATEGORIES.length)

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
        .slice(0, 10),
    [filtered],
  )
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
              onPrevious={() => categoryCarousel.scroll(-1)}
              onNext={() => categoryCarousel.scroll(1)}
              canPrevious={categoryCarousel.canPrevious}
              canNext={categoryCarousel.canNext}
            />
          </div>
          <div
            ref={categoryCarousel.trackRef}
            className="buyer-category-grid buyer-carousel-track"
            aria-label="Shop by categories carousel"
            {...categoryCarousel.trackProps}
          >
            {BATCH_CATEGORIES.map((item) => (
              <button
                type="button"
                key={item}
                className={category === item ? "is-selected" : ""}
                aria-pressed={category === item}
                onClick={() =>
                  onCategoryChange(category === item ? "All" : item)
                }
              >
                <img src={categoryImage(item)} alt="" draggable={false} />
                <span>{item}</span>
              </button>
            ))}
          </div>
        </section>

        <BatchSection
          title="Latest Batches"
          batches={latest}
          reactionPending={reactionPending}
          onToggleFavorite={onToggleReaction}
          onOpenBatch={onOpenBatch}
        />
        <BatchSection
          title="Popular Batches"
          batches={popular}
          showControls={false}
          reactionPending={reactionPending}
          onToggleFavorite={onToggleReaction}
          onOpenBatch={onOpenBatch}
        />
      </div>
    </div>
  )
}
