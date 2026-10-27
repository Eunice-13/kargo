import { HandCoins, Handshake, Landmark, Truck, WalletCards } from "lucide-react"

export default function PaymentIcon({ method, size = 20 }: { method: string; size?: number }) {
  const containerSize = Math.max(size + 36, 56)
  const logo = method === "GCash"
    ? "https://upload.wikimedia.org/wikipedia/commons/5/52/GCash_logo.svg"
    : method === "Maya"
      ? "https://upload.wikimedia.org/wikipedia/commons/e/e6/Maya_logo.svg"
      : null

  if (logo) {
    return (
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: containerSize,
          height: containerSize,
          padding: 5,
          boxSizing: "border-box",
          border: "1px solid #E5E7EB",
          borderRadius: 8,
          background: "#fff",
          boxShadow: "0 1px 3px rgba(17, 24, 39, 0.16)",
          flex: "0 0 auto",
        }}
      >
        <img
          src={logo}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      </span>
    )
  }

  const Icon = method.includes("Bank")
    ? Landmark
    : method === "Cash on Meetup"
      ? Handshake
      : method === "Cash on Delivery"
        ? Truck
        : method === "Others"
          ? WalletCards
          : HandCoins
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: containerSize,
        height: containerSize,
        boxSizing: "border-box",
        border: "1px solid #E5E7EB",
        borderRadius: 8,
        background: "#fff",
        boxShadow: "0 1px 3px rgba(17, 24, 39, 0.16)",
        color: "#344054",
        flex: "0 0 auto",
      }}
    >
      <Icon size={size} strokeWidth={1.7} />
    </span>
  )
}
