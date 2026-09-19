import { Banknote, HandCoins, Smartphone } from "lucide-react"

export default function PaymentIcon({ method, size = 20 }: { method: string; size?: number }) {
  const Icon = method === "GCash" || method === "Maya"
    ? Smartphone
    : method.includes("Bank")
      ? Banknote
      : HandCoins
  return <Icon size={size} strokeWidth={1.7} aria-hidden="true" />
}
