export const PROD_IMG: Record<string, string> = {
  "Tokyo Banana":
    "https://images.unsplash.com/photo-1587132137056-bfbf0166836e?w=60&h=60&fit=crop&auto=format",
  "Shiseido Sunscreen":
    "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=60&h=60&fit=crop&auto=format",
  "Laneige Lip Mask":
    "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=60&h=60&fit=crop&auto=format",
  "Trader Joe's Snacks":
    "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=60&h=60&fit=crop&auto=format",
  "Korean Skincare Set":
    "https://images.unsplash.com/photo-1612817288484-6f916006741a?w=60&h=60&fit=crop&auto=format",
  "Paldo Bibimmyeon":
    "https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=60&h=60&fit=crop&auto=format",
  "KitKat Sakura":
    "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=60&h=60&fit=crop&auto=format",
  "COSRX Snail Cream":
    "https://images.unsplash.com/photo-1631729371254-42c2892f0e6e?w=60&h=60&fit=crop&auto=format",
  "Muji Skincare":
    "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=60&h=60&fit=crop&auto=format",
  "Meiji Chocolate":
    "https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=60&h=60&fit=crop&auto=format",
}
export default function ProductThumb({ name }: { name: string }) {
  const url =
    PROD_IMG[name] ||
    "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=60&h=60&fit=crop&auto=format"
  return (
    // Remote thumbnails: give explicit intrinsic dimensions (the source is
    // requested at 60x60, rendered at 36px) plus lazy/async decoding so
    // off-screen thumbnails don't block the initial mobile render.
    <img
      src={url}
      alt={name}
      width={36}
      height={36}
      loading="lazy"
      decoding="async"
      className="w-9 h-9 rounded-lg object-cover bg-gray-100 flex-shrink-0"
    />
  )
}
