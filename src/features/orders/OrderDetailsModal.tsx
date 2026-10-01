import { useState } from "react"
import type { OrderRow, PayHistRow } from "@/types"
import { Modal, SecondaryBtn } from "@/components/shared"
import { TransactionDetailModal } from "@/features/payments"

export default function OrderDetailsModal({ order: detailOrder, payHistory, onClose }: {
  order: OrderRow
  payHistory: PayHistRow[]
  onClose: () => void
}) {
  const [detailPayment, setDetailPayment] = useState<PayHistRow | null>(null)
  const orderPayments = payHistory.filter((payment) => payment.orderId === (detailOrder.dbId ?? detailOrder.id))
  return (<>
      {detailOrder && !detailPayment && (
        <Modal title="Order Details" onClose={() => onClose()} width={480}>
          <dl className="space-y-3">
            {[
              ["Order ID", detailOrder.id],
              ["Product", detailOrder.product],
              ["Batch", detailOrder.batch || "—"],
              ["Seller", detailOrder.seller],
              ["Total", `₱${detailOrder.amount.toLocaleString()}`],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-gray-100 pb-2 text-sm">
                <dt className="text-gray-500">{label}</dt>
                <dd className="text-right font-semibold break-words min-w-0">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 space-y-3">
            <h3 className="text-sm font-semibold">Payment records</h3>
            {orderPayments.length === 0 ? (
              <p className="text-sm text-gray-500">No payment records for this order yet.</p>
            ) : orderPayments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between gap-3 text-sm">
                <span>{payment.date} · ₱{payment.amount.toLocaleString()} · {payment.status}</span>
                <SecondaryBtn onClick={() => setDetailPayment(payment)}>View payment</SecondaryBtn>
              </div>
            ))}
            <SecondaryBtn onClick={() => onClose()}>Close</SecondaryBtn>
          </div>
        </Modal>
      )}
      {detailPayment && (
        <TransactionDetailModal tx={detailPayment} onClose={() => setDetailPayment(null)} />
      )}
  </>)
}
