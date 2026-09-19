import { useState } from "react"
import type { ReportRow, SharedState } from "@/types"
import { INDIGO, CREAM, TODAY } from "@/constants/theme"
import { Modal, Card, PrimaryBtn, SecondaryBtn, Avatar, ProductThumb } from "@/components/shared"
import ReportBadge from "./ReportBadge"
import ReportDetailModal from "./ReportDetailModal"

export default function Reports({ reports, setReports, orders, role }: SharedState) {
  const buyerIssueTypes = [
    "Item not as described",
    "Missing items",
    "Late delivery",
    "Wrong item received",
    "Refund not processed",
    "Seller unresponsive",
  ]

  const [showModal, setShowModal] = useState(false)
  const [viewReport, setViewReport] = useState<ReportRow | null>(null)
  const [selOrder, setSelOrder] = useState(orders[0]?.id || "")
  const [issueType, setIssueType] = useState("")
  const [desc, setDesc] = useState("")

  const submitReport = () => {
    if (!issueType) return
    const ord = orders.find((o) => o.id === selOrder)
    const newReport: ReportRow = {
      id: `RPT-${String(reports.length + 1).padStart(3, "0")}`,
      order: selOrder,
      product: ord?.product || "Unknown",
      seller: ord?.seller || "Unknown",
      issue: issueType,
      date: TODAY,
      status: "Open",
      description: desc || undefined,
    }
    setReports((prev) => [newReport, ...prev])
    setShowModal(false)
    setIssueType("")
    setDesc("")
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2
            style={{
              fontFamily: "'Plus Jakarta Sans',sans-serif",
              fontSize: 16,
              fontWeight: 700,
              color: "#111827",
            }}
          >
            Filed Reports
          </h2>
          <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
            Track and manage your dispute reports
          </p>
        </div>
        <PrimaryBtn
          onClick={() => setShowModal(true)}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M6 1v10M1 6h10"
              stroke="#fff"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          File a Report
        </PrimaryBtn>
      </div>
      <Card className="!p-0 overflow-hidden">
        <div style={{ overflowX: "auto" }}>
        <table className="w-full text-[13px]">
          <thead style={{ background: CREAM }}>
            <tr>
              {[
                "Report ID",
                "Order",
                "Product",
                "Seller",
                "Issue",
                "Filed On",
                "Status",
                "Actions",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    color: "#9CA3AF",
                    fontWeight: 600,
                    fontSize: 11,
                    padding: "10px 14px",
                    textAlign: "left",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reports.map((r, i) => (
              <tr
                key={r.id}
                style={{
                  borderTop: "1px solid #F3F4F6",
                  background: i % 2 ? "#FAFAFA" : "#fff",
                }}
                className="hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => setViewReport(r)}
              >
                <td style={{ padding: "12px 14px" }}>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 11,
                      color: INDIGO,
                      fontWeight: 600,
                    }}
                  >
                    {r.id}
                  </span>
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 11,
                      color: "#374151",
                    }}
                  >
                    {r.order}
                  </span>
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <div className="flex items-center gap-2">
                    <ProductThumb name={r.product} />
                    <span
                      style={{
                        fontWeight: 500,
                        color: "#111827",
                        fontSize: 12,
                      }}
                    >
                      {r.product}
                    </span>
                  </div>
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <div className="flex items-center gap-1.5">
                    <Avatar name={r.seller} size={18} />
                    <span style={{ fontSize: 12, color: "#374151" }}>
                      {r.seller}
                    </span>
                  </div>
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    fontSize: 12,
                    color: "#374151",
                  }}
                >
                  {r.issue}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    fontSize: 12,
                    color: "#9CA3AF",
                  }}
                >
                  {r.date}
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <ReportBadge status={r.status} />
                </td>
                <td
                  style={{ padding: "12px 14px" }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setViewReport(r)
                  }}
                >
                  <SecondaryBtn>View</SecondaryBtn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
      {showModal && (
        <Modal
          title="File a Report"
          onClose={() => setShowModal(false)}
          width={520}
        >
          <div className="space-y-4">
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#374151",
                  display: "block",
                  marginBottom: 5,
                }}
              >
                Select Order
              </label>
              <select
                value={selOrder}
                onChange={(e) => setSelOrder(e.target.value)}
                style={{
                  width: "100%",
                  fontSize: 13,
                  border: "1px solid #E5E7EB",
                  borderRadius: 7,
                  padding: "9px 12px",
                  outline: "none",
                  color: "#374151",
                }}
              >
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id} — {o.product}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#374151",
                  display: "block",
                  marginBottom: 5,
                }}
              >
                Issue Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {buyerIssueTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setIssueType(type)}
                    style={{
                      border: `1px solid ${
                        issueType === type ? INDIGO : "#E5E7EB"
                      }`,
                      background: issueType === type ? "#EEF0FF" : "#fff",
                      color: issueType === type ? INDIGO : "#374151",
                      borderRadius: 7,
                      padding: "8px 12px",
                      fontSize: 12,
                      fontWeight: 500,
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {issueType === type ? "✓ " : ""}
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#374151",
                  display: "block",
                  marginBottom: 5,
                }}
              >
                Description
              </label>
              <textarea
                rows={4}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Describe the issue in detail…"
                style={{
                  width: "100%",
                  fontSize: 13,
                  border: "1px solid #E5E7EB",
                  borderRadius: 7,
                  padding: "9px 12px",
                  outline: "none",
                  resize: "none",
                  color: "#374151",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
                className="placeholder:text-gray-400"
              />
            </div>
            <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
              <SecondaryBtn
                style={{ flex: 1, justifyContent: "center", display: "flex" }}
                onClick={() => setShowModal(false)}
              >
                Cancel
              </SecondaryBtn>
              <PrimaryBtn
                style={{ flex: 1, justifyContent: "center", display: "flex" }}
                disabled={!issueType}
                onClick={submitReport}
              >
                Submit Report
              </PrimaryBtn>
            </div>
          </div>
        </Modal>
      )}
      {viewReport && (
        <ReportDetailModal
          report={viewReport}
          onClose={() => setViewReport(null)}
        />
      )}
    </div>
  )
}
