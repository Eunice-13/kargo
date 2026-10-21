import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Flame,
  Heart,
  ListOrdered,
} from "lucide-react"
import { Avatar, Modal } from "@/components/shared"
import {
  BATCH_CATEGORIES,
  normalizeBatchCategory,
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

function useIsPhone() {
  // Read the query on the first render so a phone never paints the desktop
  // page size first and re-paginates a frame later.
  const [isPhone, setIsPhone] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 620px)").matches,
  )

  useEffect(() => {
    const query = window.matchMedia("(max-width: 620px)")
    const sync = () => setIsPhone(query.matches)

    sync()
    query.addEventListener("change", sync)
    return () => query.removeEventListener("change", sync)
  }, [])

  return isPhone
}

function batchProgress(batch: BatchType) {
  const percentage = Math.min(
    100,
    Math.round((batch.claimed / Math.max(1, batch.items)) * 100),
  )
  return {
    percentage,
    color:
      percentage >= 80 ? "#ef466f" : percentage >= 50 ? "#f2c94c" : "#42c9a5",
  }
}

function BatchCard({
  batch,
  favorited,
  reactionCount,
  reactionPending,
  rank,
  onFavorite,
  onOpen,
}: {
  batch: BatchType
  favorited: boolean
  reactionCount: number
  reactionPending: boolean
  rank?: number
  onFavorite: () => void
  onOpen: () => void
}) {
  const { percentage, color: progressColor } = batchProgress(batch)
  const rankClass =
    rank === undefined
      ? ""
      : rank <= 3
        ? ` is-ranked is-rank-${rank}`
        : " is-ranked"

  return (
    <article
      className={`buyer-batch-card${rankClass}`}
      role="button"
      tabIndex={0}
      aria-label={`Open ${batch.title}, ${normalizeBatchCategory(batch.category)}, sold by ${batch.seller}, ${batch.trips}, ${batch.claimed} of ${batch.items} claimed${
        rank === undefined ? "" : `, ranked #${rank} by buyer favorites`
      }`}
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
        <span className="buyer-batch-card__category">{normalizeBatchCategory(batch.category)}</span>
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
        {rank !== undefined && (
          <span className="buyer-batch-card__rank" aria-hidden="true">
            {rank === 1 && (
              <Flame size={12} strokeWidth={2.4} fill="currentColor" />
            )}
            <span>#{rank}</span>
          </span>
        )}
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
  // Phones show 6 batches per slide (3 across x 2 rows, see responsive.css).
  // Desktop keeps its 5 x 2 layout of 10.
  const isPhone = useIsPhone()
  const pageSize = isPhone ? 6 : 10
  const pages = useMemo(
    () =>
      Array.from({ length: Math.ceil(batches.length / pageSize) }, (_, index) =>
        batches.slice(index * pageSize, index * pageSize + pageSize),
      ),
    [batches, pageSize],
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

function PopularSection({
  batches,
  reactionPending,
  onToggleFavorite,
  onOpenBatch,
}: {
  batches: BatchType[]
  reactionPending: Set<number>
  onToggleFavorite: (batch: BatchType) => void
  onOpenBatch: (batch: BatchType) => void
}) {
  const [showTopTen, setShowTopTen] = useState(false)
  const isPhone = useIsPhone()
  // Podium reads 2 - 1 - 3 on screen; DOM order stays 1, 2, 3 so the rank
  // order survives for screen readers and keyboard users. Ranks 4-7 fan out
  // behind the podium, but only in pairs: one card per side at a time, so a
  // filtered list never leaves the deck stacked on a single edge.
  const podium = batches.slice(0, 3)
  const extraCount = Math.min(4, batches.length - podium.length)
  const pairedCount = extraCount - (extraCount % 2)
  const peeks = batches.slice(3, 3 + pairedCount).map((batch, index) => ({
    batch,
    rank: index + 4,
    side: index % 2 === 0 ? "left" : "right",
    depth: Math.floor(index / 2) + 1,
  }))
  const canExpand = batches.length > podium.length

  return (
    <section className="buyer-home-section buyer-home-section--popular">
      <div className="buyer-home-section__heading">
        <div className="buyer-home-section__title">
          <span className="buyer-hot-flame" aria-hidden="true">
            <Flame size={18} strokeWidth={2.2} fill="currentColor" />
          </span>
          <div className="buyer-hot-heading">
            <div className="buyer-hot-heading__row">
              <h2>Popular Batches</h2>
              <span className="buyer-hot-pill">
                <span className="buyer-hot-pill__dot" aria-hidden="true" />
                Hot
              </span>
            </div>
            <p className="buyer-hot-heading__note">
              Ranked by buyer favorites
            </p>
          </div>
        </div>
      </div>

      {batches.length === 0 ? (
        <div className="buyer-home-empty">No batches match these filters.</div>
      ) : (
        <>
          <div className="buyer-podium">
            {podium.map((batch, index) => (
              <div
                className={`buyer-podium__slot buyer-podium__slot--${
                  index + 1
                }`}
                key={batch.id}
              >
                <div className="buyer-podium__card">
                  <BatchCard
                    batch={batch}
                    favorited={Boolean(batch.reactedByCurrentUser)}
                    reactionCount={batch.reactionCount ?? 0}
                    reactionPending={reactionPending.has(batch.id)}
                    rank={index + 1}
                    onFavorite={() => onToggleFavorite(batch)}
                    onOpen={() => onOpenBatch(batch)}
                  />
                </div>
              </div>
            ))}
            {!isPhone &&
              peeks.map(({ batch, rank, side, depth }) => {
                const progress = batchProgress(batch)

                return (
                  <button
                    type="button"
                    className={`buyer-podium__peek buyer-podium__peek--${side}-${depth}`}
                    key={batch.id}
                    aria-label={`Open ${batch.title} by ${batch.seller}, ranked #${rank} by buyer favorites`}
                    onClick={() => onOpenBatch(batch)}
                  >
                    <span className="buyer-podium__peek-photo">
                      <img
                        src={batchImage(batch.category, batch.id)}
                        alt=""
                        draggable={false}
                      />
                      <span
                        className="buyer-podium__peek-rank"
                        aria-hidden="true"
                      >
                        #{rank}
                      </span>
                    </span>
                    <span
                      className="buyer-podium__peek-body"
                      aria-hidden="true"
                    >
                      <span className="buyer-podium__peek-title">
                        {batch.title}
                      </span>
                      <span className="buyer-podium__peek-seller">
                        {batch.seller}
                      </span>
                      <span className="buyer-podium__peek-date">
                        {batch.trips}
                      </span>
                      <span className="buyer-podium__peek-progress">
                        <span>
                          {batch.claimed}/{batch.items} claimed
                        </span>
                        <strong style={{ color: progress.color }}>
                          {progress.percentage}%
                        </strong>
                      </span>
                      <span className="buyer-podium__peek-track">
                        <span
                          style={{
                            width: `${progress.percentage}%`,
                            background: progress.color,
                          }}
                        />
                      </span>
                    </span>
                  </button>
                )
              })}
          </div>

          {canExpand && (
            <>
              <button
                type="button"
                className="buyer-toplist-toggle"
                onClick={() => setShowTopTen(true)}
              >
                See the top {batches.length}
                <ListOrdered size={16} strokeWidth={2.5} aria-hidden="true" />
              </button>

              {showTopTen && (
                <Modal
                  title={`Top ${batches.length} popular batches`}
                  onClose={() => setShowTopTen(false)}
                  width={640}
                  variant="detail"
                >
                  <p className="buyer-toplist__intro">
                    Ranked by buyer favorites.
                  </p>
                  <ol className="buyer-toplist">
                    {batches.map((batch, index) => {
                      const rank = index + 1
                      const progress = batchProgress(batch)
                      return (
                        <li key={batch.id}>
                          <div
                            className={`buyer-toplist__row${
                              rank <= 3
                                ? ` is-podium is-rank-${rank}`
                                : ""
                            }`}
                            role="button"
                            tabIndex={0}
                            aria-label={`Open ${batch.title} by ${batch.seller}, ranked #${rank} by buyer favorites, ${batch.claimed} of ${batch.items} claimed`}
                            onClick={() => {
                              setShowTopTen(false)
                              onOpenBatch(batch)
                            }}
                            onKeyDown={(event) => {
                              if (event.target !== event.currentTarget) return
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault()
                                setShowTopTen(false)
                                onOpenBatch(batch)
                              }
                            }}
                          >
                            <span
                              className="buyer-toplist__rank"
                              aria-hidden="true"
                            >
                              #{rank}
                            </span>
                            <span className="buyer-toplist__thumb">
                              <img
                                src={batchImage(batch.category, batch.id)}
                                alt=""
                                loading="lazy"
                                draggable={false}
                              />
                            </span>
                            <span className="buyer-toplist__body">
                              <span className="buyer-toplist__title">
                                {batch.title}
                              </span>
                              <span className="buyer-toplist__meta">
                                {batch.seller} ·{" "}
                                {normalizeBatchCategory(batch.category)} ·{" "}
                                {batch.claimed}/{batch.items} claimed
                              </span>
                              <span
                                className="buyer-toplist__bar"
                                aria-hidden="true"
                              >
                                <span
                                  style={{
                                    width: `${progress.percentage}%`,
                                    background: progress.color,
                                  }}
                                />
                              </span>
                            </span>
                            <button
                              type="button"
                              className={`buyer-toplist__hearts${
                                batch.reactedByCurrentUser
                                  ? " is-favorite"
                                  : ""
                              }`}
                              aria-label={
                                batch.reactedByCurrentUser
                                  ? `Remove ${batch.title} from favorites`
                                  : `Add ${batch.title} to favorites`
                              }
                              aria-pressed={Boolean(
                                batch.reactedByCurrentUser,
                              )}
                              disabled={reactionPending.has(batch.id)}
                              onClick={(event) => {
                                event.stopPropagation()
                                onToggleFavorite(batch)
                              }}
                            >
                              <Heart
                                size={13}
                                strokeWidth={2.4}
                                fill={
                                  batch.reactedByCurrentUser
                                    ? "currentColor"
                                    : "none"
                                }
                                aria-hidden="true"
                              />
                              {batch.reactionCount ?? 0}
                            </button>
                            <ChevronRight
                              className="buyer-toplist__chevron"
                              size={18}
                              strokeWidth={2.4}
                              aria-hidden="true"
                            />
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                </Modal>
              )}
            </>
          )}
        </>
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
  onOpenBatch,
  onToggleReaction,
  reactionPending,
}: {
  batches: BatchType[]
  category: string
  date: string
  onCategoryChange: (category: string) => void
  onDateChange: (date: string) => void
  onOpenBatch: (batch: BatchType) => void
  onToggleReaction: (batch: BatchType) => void
  reactionPending: Set<number>
}) {
  const categoryCarousel = useHorizontalCarousel(BATCH_CATEGORIES.length)

  const postedMonth = (createdAt?: string) => {
    if (!createdAt) return null
    const posted = new Date(createdAt)
    if (Number.isNaN(posted.getTime())) return null
    return `${posted.getFullYear()}-${String(posted.getMonth() + 1).padStart(2, "0")}`
  }
  const dates = useMemo(() => {
    const values = new Map<string, string>()
    for (const batch of batches) {
      const key = postedMonth(batch.createdAt)
      if (key) {
        values.set(key, new Date(batch.createdAt!).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        }))
      }
    }
    return [...values].sort(([a], [b]) => b.localeCompare(a))
  }, [batches])

  const filtered = useMemo(
    () =>
      batches.filter((batch) => {
        if (category !== "All" && normalizeBatchCategory(batch.category) !== category) return false
        if (
          date !== "All" &&
          postedMonth(batch.createdAt) !== date
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
            <option key={option} value={option}>{option === "All" ? "All categories" : option}</option>
          ))}
        </select>
        <select
          aria-label="Filter batches by posting month"
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
        >
          <option value="All">All months</option>
          {dates.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div className="buyer-home__content">
        <section className="buyer-home-section buyer-category-section">
          <div className="buyer-home-section__heading">
            <h2>Shop By Categories</h2>
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

        <PopularSection
          batches={popular}
          reactionPending={reactionPending}
          onToggleFavorite={onToggleReaction}
          onOpenBatch={onOpenBatch}
        />
        <BatchSection
          title="Latest Batches"
          batches={latest}
          reactionPending={reactionPending}
          onToggleFavorite={onToggleReaction}
          onOpenBatch={onOpenBatch}
        />
      </div>
    </div>
  )
}
