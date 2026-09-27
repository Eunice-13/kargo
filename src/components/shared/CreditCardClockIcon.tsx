import { Clock3, CreditCard } from "lucide-react"

type CreditCardClockIconProps = {
    size?: number
    strokeWidth?: number
}

export default function CreditCardClockIcon({
    size = 24,
    strokeWidth = 2,
}: CreditCardClockIconProps) {
    const clockSize = Math.max(9, Math.round(size * 0.42))
    const badgeSize = Math.max(14, Math.round(size * 0.58))

    return (
        <span
            aria-hidden="true"
            className="relative inline-block shrink-0"
            style={{ width: size, height: size }}
        >
            <CreditCard size={size} strokeWidth={strokeWidth} />
            <span
                className="absolute -bottom-1 -right-1 grid place-items-center rounded-full bg-white text-[#191BA9] shadow-sm"
                style={{ width: badgeSize, height: badgeSize }}
            >
                <Clock3 size={clockSize} strokeWidth={2.2} />
            </span>
        </span>
    )
}
