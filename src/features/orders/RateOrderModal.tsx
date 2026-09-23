import { useState } from "react"
import { Check, Star } from "lucide-react"
import type { Role } from "@/types"
import { AMBER, INDIGO } from "@/constants/theme"
import { Modal, PrimaryBtn, SecondaryBtn } from "@/components/shared"
import { RATING_STATEMENTS } from "./ratingOptions"

export default function RateOrderModal({
  subjectName,
  subjectRole,
  onRate,
  onClose,
  initialRating = 5,
  initialComment = "",
  initialStatements = [],
}: {
  subjectName: string
  subjectRole: Role
  onRate: (rating: number, comment: string, statements: string[]) => void | Promise<void>
  onClose: () => void
  initialRating?: number
  initialComment?: string
  initialStatements?: string[]
}) {
  const [stars, setStars] = useState(initialRating)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState(initialComment)
  const [statements, setStatements] = useState<string[]>(initialStatements)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const toggleStatement = (statement: string) => {
    setStatements((current) =>
      current.includes(statement)
        ? current.filter((item) => item !== statement)
        : [...current, statement],
    )
  }

  return (
    <Modal title={`Rate ${subjectRole}`} onClose={onClose} width={460}>
      <div className="space-y-5">
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>
            How was your transaction with <strong>{subjectName}</strong>?
          </div>
          <div className="flex justify-center gap-2" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((star) => {
              const active = (hovered || stars) >= star
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={stars === star}
                  aria-label={`${star} star${star === 1 ? "" : "s"}`}
                  key={star}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setStars(star)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 2,
                    color: active ? AMBER : "#D1D5DB",
                    transform: active ? "scale(1.12)" : "scale(1)",
                  }}
                >
                  <Star size={34} fill={active ? AMBER : "none"} aria-hidden="true" />
                </button>
              )
            })}
          </div>
          <div style={{ fontSize: 12, color: INDIGO, fontWeight: 700, marginTop: 7 }}>
            {stars}/5 stars
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
            Quick feedback
          </div>
          <div className="flex flex-wrap gap-2">
            {RATING_STATEMENTS[subjectRole].map((statement) => {
              const selected = statements.includes(statement)
              return (
                <button
                  type="button"
                  key={statement}
                  aria-pressed={selected}
                  onClick={() => toggleStatement(statement)}
                  style={{
                    border: `1px solid ${selected ? INDIGO : "#D1D5DB"}`,
                    background: selected ? "#EEF0FF" : "#fff",
                    color: selected ? INDIGO : "#4B5563",
                    borderRadius: 999,
                    padding: "6px 10px",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {selected && <Check size={12} aria-hidden="true" />}
                  {statement}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label htmlFor="rating-comment" style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 5 }}>
            Written review
          </label>
          <textarea
            id="rating-comment"
            rows={4}
            value={comment}
            maxLength={1000}
            onChange={(event) => setComment(event.target.value)}
            placeholder={`Share more about your experience with this ${subjectRole.toLowerCase()}…`}
            style={{ width: "100%", fontSize: 13, border: "1px solid #E5E7EB", borderRadius: 7, padding: "9px 12px", outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
          />
          <div style={{ fontSize: 10, color: "#9CA3AF", textAlign: "right", marginTop: 3 }}>
            {comment.length}/1000
          </div>
        </div>

        {error && <div role="alert" style={{ fontSize: 12, color: "#B91C1C", background: "#FEE2E2", borderRadius: 7, padding: "8px 10px" }}>{error}</div>}

        <div className="flex gap-3">
          <SecondaryBtn style={{ flex: 1, display: "flex", justifyContent: "center" }} onClick={onClose} disabled={submitting}>
            Cancel
          </SecondaryBtn>
          <PrimaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            disabled={submitting}
            onClick={async () => {
              if (statements.length < 1) {
                setError("Select at least one quick statement.")
                return
              }
              if (comment.trim().length < 10) {
                setError("Write at least 10 characters to make your review more meaningful.")
                return
              }
              setError("")
              setSubmitting(true)
              await onRate(stars, comment.trim(), statements)
              setSubmitting(false)
            }}
          >
            {submitting ? "Submitting…" : "Submit Rating"}
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}
