import { useMemo, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import type { ToPayRow } from "@/types"
import { Modal, PrimaryBtn, ProductThumb, SecondaryBtn } from "@/components/shared"
import PaymentSubmitModal from "./PaymentSubmitModal"
import { getSellerPaymentDetails } from "./sellerPaymentDetails"
import type { BuyerPaymentMethod } from "./buyerPaymentMethods"

export default function BatchCheckoutModal({
    items,
    contactPrefill,
    onSubmit,
    onClose,
    savedMethods = [],
}: {
    items: ToPayRow[]
    contactPrefill?: string
    onSubmit: (item: ToPayRow, method: string, refNo: string, receipt?: File) => void
    onClose: () => void
    savedMethods?: BuyerPaymentMethod[]
}) {
    const [payTarget, setPayTarget] = useState<ToPayRow | null>(null)
    const groups = useMemo(() => {
        const grouped = new Map<string, ToPayRow[]>()
        for (const item of items) {
            grouped.set(item.seller, [...(grouped.get(item.seller) ?? []), item])
        }
        return [...grouped.entries()]
    }, [items])

    return (
        <>
            <Modal title="Batch Checkout" onClose={onClose} width={680}>
                <div className="space-y-4">
                    <div style={{ fontSize: 12, color: "#6B7280" }}>
                        Payments are separated by seller so each proof is sent against the correct account.
                    </div>
                    {groups.map(([seller, sellerItems]) => {
                        const details = getSellerPaymentDetails(seller)
                        const subtotal = sellerItems.reduce((sum, item) => sum + item.amount, 0)
                        return (
                            <section key={seller} style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: 16 }}>
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{seller}</div>
                                        <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                                            {sellerItems.length} item{sellerItems.length === 1 ? "" : "s"}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div style={{ fontSize: 11, color: "#9CA3AF" }}>Subtotal</div>
                                        <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>
                                            ₱{subtotal.toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-3 space-y-2">
                                    {sellerItems.map((item) => (
                                        <div key={item.id} className="flex items-center gap-3" style={{ background: "#F9FAFB", borderRadius: 7, padding: "8px 10px" }}>
                                            <ProductThumb name={item.product} />
                                            <div className="flex-1">
                                                <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{item.product}</div>
                                                <div style={{ fontSize: 11, color: "#6B7280" }}>₱{item.amount.toLocaleString()}</div>
                                            </div>
                                            <PrimaryBtn size="sm" onClick={() => setPayTarget(item)}>Submit Proof</PrimaryBtn>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center gap-3 mt-3" style={{ background: "#EEF0FF", borderRadius: 7, padding: 10 }}>
                                    <QRCodeSVG
                                        value={`${details.name}|${details.methods.GCash.number}|${details.qrCode}`}
                                        size={68}
                                        level="M"
                                        bgColor="#FFFFFF"
                                        fgColor="#111827"
                                        aria-label={`Payment QR code for ${seller}`}
                                    />
                                    <div style={{ fontSize: 11, color: "#374151" }}>
                                        <div style={{ fontWeight: 700, marginBottom: 4 }}>Payment details</div>
                                        <div>GCash: {details.methods.GCash.number}</div>
                                        <div>Maya: {details.methods.Maya.number}</div>
                                        <div>Bank: {details.methods["Bank Transfer"].number}</div>
                                    </div>
                                </div>
                            </section>
                        )
                    })}
                    <div className="flex justify-end">
                        <SecondaryBtn onClick={onClose}>Close</SecondaryBtn>
                    </div>
                </div>
            </Modal>
            {payTarget && (
                <PaymentSubmitModal
                    item={payTarget}
                    contactPrefill={contactPrefill}
                    savedMethods={savedMethods}
                    onConfirm={(method, refNo, receipt) => {
                        onSubmit(payTarget, method, refNo, receipt)
                        setPayTarget(null)
                    }}
                    onClose={() => setPayTarget(null)}
                />
            )}
        </>
    )
}