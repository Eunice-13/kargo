import { INDIGO, CREAM } from "@/constants/theme"
import Modal from "./Modal"

// About Us — an app-shell-level modal opened from the Header logo (#Task 15).
export default function AboutUsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="About KARGO" onClose={onClose} width={520}>
      <div className="space-y-4" style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
        <div
          style={{
            background: CREAM,
            borderRadius: 8,
            padding: "12px 14px",
            fontWeight: 600,
            color: "#111827",
          }}
        >
          KARGO is a pasabuy order-fulfillment workspace — a calm operations
          cockpit for buyers claiming items from seller-run travel batches, and
          for sellers coordinating claims, payments, and fulfillment.
        </div>

        <div>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
            For buyers
          </h4>
          <p style={{ margin: 0 }}>
            Discover live batches, see the full cost and reservation deadline up
            front, claim an item, submit payment, and always know your next
            action when something needs attention.
          </p>
        </div>

        <div>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
            For sellers
          </h4>
          <p style={{ margin: 0 }}>
            Publish batches, review claims, verify payments, and move orders
            through fulfillment stages — with a compact view of demand and
            progress that never loses context.
          </p>
        </div>

        <div>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
            How we think about trust
          </h4>
          <p style={{ margin: 0 }}>
            Trust indicators are evidence references, not guarantees. We show
            BIR verification and linked social accounts as credibility signals,
            and we explain what happens next rather than overpromise.
          </p>
        </div>

        <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>
          Amounts are in Philippine peso. KARGO is designed for short, frequent
          sessions on desktop and mobile.
        </p>

        <div style={{ textAlign: "right", paddingTop: 4 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: INDIGO,
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}
