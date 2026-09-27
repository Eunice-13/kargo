import { CreditCard } from "lucide-react"

type CreditCardClockIconProps = {
    size?: number
    strokeWidth?: number
}

export default function CreditCardClockIcon({
    size = 24,
    strokeWidth = 2,
}: CreditCardClockIconProps) {
    return (
        <span
            aria-hidden="true"
            className="inline-flex shrink-0"
            style={{ width: size, height: size }}
        >
            <CreditCard size={size} strokeWidth={strokeWidth} />
        </span>
    )
}
