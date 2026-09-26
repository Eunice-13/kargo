import type { ReactNode } from "react"
import { CAT_GRAD, batchCoverSrc } from "@/constants/theme"

// Single source of truth for a batch's banner visual, used identically by the
// Home batch card and the batch detail hero. Renders the seller's uploaded
// cover photo, or the category default photo (batchCoverSrc) when none was set,
// so a batch is never a flat color block. The category gradient sits behind the
// image only as a load placeholder.
//
// `height` sizes the banner (120 on cards, taller on the detail hero).
// `overlay` renders on top of the banner (badges, title, etc.).
export default function BatchCover({
  category,
  coverImage,
  height,
  radius = 0,
  overlay,
}: {
  category: string
  coverImage?: string
  height: number | string
  radius?: number | string
  overlay?: ReactNode
}) {
  const grad = CAT_GRAD[category] || CAT_GRAD["Mixed"]
  const src = batchCoverSrc(coverImage, category)
  return (
    <div
      style={{
        height,
        borderRadius: radius,
        position: "relative",
        overflow: "hidden",
        background: grad,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <img
        src={src}
        alt=""
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
      {overlay}
    </div>
  )
}
