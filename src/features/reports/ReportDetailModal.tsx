import { Clock3, Search, CheckCircle2 } from "lucide-react"
import type { ReportRow } from "@/types"
import { CREAM, CYAN_L, SKY } from "@/constants/theme"
import { Modal, PrimaryBtn } from "@/components/shared"
import ReportBadge from "./ReportBadge"

export default function ReportDetailModal({
  report,
  onClose,
}: {
  report: ReportRow
  onClose: () => void
}) {
  return (
    <Modal title={`Report ${report.id}`} onClose={onClose} width={480}>
      <div className="space-y-4">
        <div
          style={{ background: CREAM, borderRadius: 8, padding: "12px 16px" }}
          className="space-y-2"
        >
          {([
            ["Order", report.order],
            ["Product", report.product],
            ["Seller", report.seller],
            ["Issue", report.issue],
            ["Filed On", report.date],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k} className="flex items-start justify-between gap-4">
              <span
                style={{
                  fontSize: 12,
                  color: "#9CA3AF",
                  fontWeight: 600,
                  minWidth: 80,
                }}
              >
                {k}
              </span>
              <span
                style={{ fontSize: 12, color: "#374151", textAlign: "right" }}
              >
                {v}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
            Status
          </span>
          <ReportBadge status={report.status} />
        </div>
        {report.description && (
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#374151",
                marginBottom: 4,
              }}
            >
              Description
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#6B7280",
                lineHeight: 1.6,
                background: CREAM,
                borderRadius: 8,
                padding: "10px 12px",
              }}
            >
              {report.description}
            </div>
          </div>
        )}
        {report.status === "Open" && (
          <div
            style={{
              background: "#FEF3C7",
              border: "1px solid #FDE68A",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 12,
              color: "#92400E",
              display: "flex",
              gap: 8,
            }}
          >
            <Clock3 size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
            <span>This report is awaiting admin review. You'll be notified of
            updates.</span>
          </div>
        )}
        {report.status === "Under Review" && (
          <div
            style={{
              background: CYAN_L,
              border: `1px solid ${SKY}`,
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 12,
              color: "#0369A1",
              display: "flex",
              gap: 8,
            }}
          >
            <Search size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
            <span>A moderator is actively reviewing this report.</span>
          </div>
        )}
        {report.status === "Resolved" && (
          <div
            style={{
              background: "#D4F5EA",
              border: "1px solid #6EE7B7",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 12,
              color: "#065F46",
              display: "flex",
              gap: 8,
            }}
          >
            <CheckCircle2 size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
            <span>This report has been resolved.</span>
          </div>
        )}
        <PrimaryBtn
          style={{ width: "100%", display: "flex", justifyContent: "center" }}
          onClick={onClose}
        >
          Close
        </PrimaryBtn>
      </div>
    </Modal>
  )
}
