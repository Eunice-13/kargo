import { Pencil, Trash2 } from "lucide-react"
import Card from "./Card"
import PaymentIcon from "./PaymentIcon"

type PaymentMethodCardProps = {
    name: string
    detail: string
    color: string
    qrUrl?: string
    onEdit: () => void
    onDelete: () => void
    deleteDisabled?: boolean
    deleteTitle?: string
}

function maskDetail(detail: string) {
    if (!detail) return "0XXX-XXXX-XXXX"
    if (/[xX•]/.test(detail)) return detail
    const digits = detail.replace(/\D/g, "")
    return digits.length >= 4 ? `0XXX-XXXX-${digits.slice(-4)}` : detail
}

export default function PaymentMethodCard({
    name,
    detail,
    color,
    qrUrl,
    onEdit,
    onDelete,
    deleteDisabled = false,
    deleteTitle,
}: PaymentMethodCardProps) {
    return (
        <Card className="flex min-h-[56px] items-center gap-3 !px-3 !py-2.5">
            {qrUrl ? (
                <img
                    src={qrUrl}
                    alt={`${name} QR`}
                    className="h-9 w-9 shrink-0 rounded-md border border-[#E5E7EB] object-cover"
                />
            ) : (
                <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-md border"
                    style={{ color, borderColor: color }}
                >
                    <PaymentIcon method={name} size={19} />
                </span>
            )}
            <div className="min-w-0 flex-1">
                <div className="text-[12px] font-bold text-[#111827]">{name}</div>
                <div className="mt-0.5 truncate text-[10px] text-[#748391]">
                    {maskDetail(detail)}
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
                <button
                    type="button"
                    aria-label={`Edit ${name}`}
                    onClick={onEdit}
                    className="rounded p-1.5 text-[#68727D] transition-colors hover:bg-[#F2F4F7] hover:text-[#111827]"
                >
                    <Pencil size={14} aria-hidden="true" />
                </button>
                <button
                    type="button"
                    aria-label={`Delete ${name}`}
                    title={deleteTitle}
                    onClick={onDelete}
                    disabled={deleteDisabled}
                    className="rounded p-1.5 text-[#D43B4A] transition-colors hover:bg-[#FFF0F1] disabled:cursor-not-allowed disabled:text-[#C8CDD3]"
                >
                    <Trash2 size={14} aria-hidden="true" />
                </button>
            </div>
        </Card>
    )
}
