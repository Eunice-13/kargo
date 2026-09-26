import type { BatchItem } from "@/types"
import { DEMO_RATINGS, demoProfileId } from "./reviews"

// Batches carry no rating of their own. `rating` / `ratingCount` are filled in
// from DEMO_RATINGS at the bottom of this file, so a seller's score on a batch
// card is the same computed aggregate their shop page and profile show. It is
// `null` — not 0, not 5 — for a seller with no reviews yet.
const BASE_BATCHES_SEED: Omit<BatchItem, "rating" | "ratingCount" | "sellerId">[] =
  [
    {
      id: 1,

      live: true,

      locked: false,

      title: "Japan Trip — March 2026",

      seller: "Maria Santos",

      trips: "Mar 10–18, 2026",

      items: 24,

      claimed: 19,

      category: "Food",
      reserveHours: 48,

      notes:
        "Trip runs Mar 10–18. Items will be ordered by Mar 3. All prices are in PHP and include local sourcing cost. QR/BDO preferred.",

      products: [
        {
          name: "Tokyo Banana",

          price: 480,

          qty: 6,

          claimed: 6,

          waitlist: 2,

          locked: false,
        },

        {
          name: "KitKat Sakura",

          price: 320,

          qty: 8,

          claimed: 5,

          waitlist: 0,

          locked: false,
        },

        {
          name: "Shiseido Sunscreen",

          price: 1650,

          qty: 4,

          claimed: 4,

          waitlist: 3,

          locked: false,
        },

        {
          name: "Meiji Chocolate",

          price: 290,

          qty: 6,

          claimed: 4,

          waitlist: 0,

          locked: false,
        },
      ],
    },

    {
      id: 2,

      live: false,

      locked: false,

      title: "Korea Haul — April 2026",

      seller: "Ana Reyes",

      trips: "Apr 3–12, 2026",

      items: 31,

      claimed: 22,

      category: "Skincare",

      reserveHours: 48,

      products: [
        {
          name: "Laneige Lip Mask",

          price: 950,

          qty: 10,

          claimed: 10,

          waitlist: 5,

          locked: false,
        },

        {
          name: "COSRX Snail Cream",

          price: 780,

          qty: 8,

          claimed: 6,

          waitlist: 0,

          locked: false,
        },

        {
          name: "Korean Skincare Set",

          price: 2400,

          qty: 5,

          claimed: 4,

          waitlist: 1,

          locked: false,
        },

        {
          name: "Paldo Bibimmyeon",

          price: 380,

          qty: 8,

          claimed: 2,

          waitlist: 0,

          locked: false,
        },
      ],
    },

    {
      id: 3,

      live: false,

      locked: false,

      title: "US Pasabuy — May 2026",

      seller: "Paolo Garcia",

      trips: "May 5–20, 2026",

      items: 18,

      claimed: 9,

      category: "Grocery & Snacks",

      reserveHours: 48,

      products: [
        {
          name: "Trader Joe's Snacks",

          price: 1200,

          qty: 10,

          claimed: 8,

          waitlist: 0,

          locked: false,
        },

        {
          name: "Muji Skincare",

          price: 890,

          qty: 8,

          claimed: 1,

          waitlist: 0,

          locked: false,
        },
      ],
    },

    {
      id: 4,

      live: false,

      locked: false,

      title: "HK Beauty Run — June 2026",

      seller: "Liza Mendoza",

      trips: "Jun 14–20, 2026",

      items: 15,

      claimed: 4,

      category: "Beauty",

      reserveHours: 48,

      products: [
        {
          name: "Muji Skincare",

          price: 890,

          qty: 8,

          claimed: 3,

          waitlist: 0,

          locked: false,
        },

        {
          name: "Shiseido Sunscreen",

          price: 1650,

          qty: 7,

          claimed: 1,

          waitlist: 0,

          locked: false,
        },
      ],
    },

    {
      id: 5,

      live: true,

      locked: false,

      title: "Bangkok Haul — June 2026",

      seller: "Kristine Aquino",

      trips: "Jun 2–8, 2026",

      items: 20,

      claimed: 11,

      category: "Mixed",

      reserveHours: 48,

      notes:
        "Bangkok haul — snacks and skincare mainly. Trustworthy sellers only. If item is OOS, full refund processed within 48h.",

      products: [
        {
          name: "Thai Snack Box",

          price: 650,

          qty: 10,

          claimed: 7,

          waitlist: 0,

          locked: false,
        },

        {
          name: "Mistine Sunscreen",

          price: 420,

          qty: 10,

          claimed: 4,

          waitlist: 0,

          locked: false,
        },
      ],
    },

    {
      id: 6,

      live: false,

      locked: false,

      title: "Dubai Pasabuy — July 2026",

      seller: "Mark Villanueva",

      trips: "Jul 10–18, 2026",

      items: 12,

      claimed: 3,

      category: "Luxury",

      reserveHours: 48,

      products: [
        {
          name: "Nars Blush",

          price: 2800,

          qty: 6,

          claimed: 2,

          waitlist: 0,

          locked: false,
        },

        {
          name: "MAC Lipstick Set",

          price: 3200,

          qty: 6,

          claimed: 1,

          waitlist: 0,

          locked: false,
        },
      ],
    },

    {
      id: 7,

      live: false,

      locked: false,

      title: "UK Trip — August 2026",

      seller: "Ella Torres",

      trips: "Aug 5–18, 2026",

      items: 22,

      claimed: 8,

      category: "Grocery & Snacks",

      reserveHours: 48,

      products: [
        {
          name: "Cadbury Hamper",

          price: 980,

          qty: 12,

          claimed: 6,

          waitlist: 0,

          locked: false,
        },

        {
          name: "Boots Skincare",

          price: 1450,

          qty: 10,

          claimed: 2,

          waitlist: 0,

          locked: false,
        },
      ],
    },

    {
      id: 8,

      live: true,

      locked: false,

      title: "Taiwan Finds — July 2026",

      seller: "Rico Santos",

      trips: "Jul 20–28, 2026",

      items: 16,

      claimed: 6,

      category: "Food",
      reserveHours: 48,

      products: [
        {
          name: "85°C Pastries",

          price: 560,

          qty: 8,

          claimed: 5,

          waitlist: 1,

          locked: false,
        },

        {
          name: "Dr. Wu Serum",

          price: 1100,

          qty: 8,

          claimed: 1,

          waitlist: 0,

          locked: false,
        },
      ],
    },

    {
      id: 9,

      live: false,

      locked: false,

      title: "Singapore Haul — Aug 2026",

      seller: "Jade Bautista",

      trips: "Aug 20–27, 2026",

      items: 19,

      claimed: 14,

      category: "Skincare",

      reserveHours: 48,

      products: [
        {
          name: "SK-II Essence",

          price: 4800,

          qty: 6,

          claimed: 6,

          waitlist: 4,

          locked: false,
        },

        {
          name: "Hada Labo Serum",

          price: 780,

          qty: 8,

          claimed: 5,

          waitlist: 0,

          locked: false,
        },

        {
          name: "Innisfree Sheet Mask",

          price: 390,

          qty: 5,

          claimed: 3,

          waitlist: 0,

          locked: false,
        },
      ],
    },

    {
      id: 10,

      live: false,

      locked: false,

      title: "Australia Run — Sep 2026",

      seller: "Maria Santos",

      trips: "Sep 1–10, 2026",

      items: 14,

      claimed: 4,

      category: "Grocery & Snacks",

      reserveHours: 48,

      products: [
        {
          name: "Tim Tam Assorted",

          price: 720,

          qty: 8,

          claimed: 3,

          waitlist: 0,

          locked: false,
        },

        {
          name: "Aesop Hand Cream",

          price: 2600,

          qty: 6,

          claimed: 1,

          waitlist: 0,

          locked: false,
        },
      ],
    },

    {
      id: 11,

      live: false,

      locked: false,

      title: "France Luxury — Oct 2026",

      seller: "Ana Reyes",

      trips: "Oct 5–15, 2026",

      items: 10,

      claimed: 2,

      category: "Luxury",

      reserveHours: 48,

      products: [
        {
          name: "L'Occitane Set",

          price: 3800,

          qty: 5,

          claimed: 1,

          waitlist: 0,

          locked: false,
        },

        {
          name: "Lancôme Serum",

          price: 5200,

          qty: 5,

          claimed: 1,

          waitlist: 0,

          locked: false,
        },
      ],
    },

    {
      id: 12,

      live: false,

      locked: false,

      title: "Vietnam Haul — May 2026",

      seller: "Paolo Garcia",

      trips: "May 22–28, 2026",

      items: 18,

      claimed: 7,

      category: "Food",
      reserveHours: 48,

      products: [
        {
          name: "Lacvert Sheet Mask",

          price: 290,

          qty: 10,

          claimed: 5,

          waitlist: 0,

          locked: false,
        },

        {
          name: "X-Men Serum",

          price: 420,

          qty: 8,

          claimed: 2,

          waitlist: 0,

          locked: false,
        },
      ],
    },
  ]

const ADDITIONAL_BATCH_DEFINITIONS = [
  [
    13,
    "Osaka Street Food — October 2026",
    "Maria Santos",
    "Oct 14–21, 2026",
    "Food",
    "Osaka Takoyaki Kit",
    680,
    18,
    5,
  ],
  [
    14,
    "Seoul Glow Edit — November 2026",
    "Ana Reyes",
    "Nov 2–10, 2026",
    "Skincare",
    "Round Lab Sunscreen",
    980,
    20,
    8,
  ],
  [
    15,
    "California Pantry Run — November 2026",
    "Paolo Garcia",
    "Nov 8–18, 2026",
    "Grocery & Snacks",
    "Trader Joe's Cookie Box",
    850,
    24,
    11,
  ],
  [
    16,
    "Bangkok Beauty Picks — November 2026",
    "Kristine Aquino",
    "Nov 20–27, 2026",
    "Beauty",
    "Cathy Doll Lip Set",
    720,
    16,
    7,
  ],
  [
    17,
    "Singapore Luxe Finds — December 2026",
    "Jade Bautista",
    "Dec 5–12, 2026",
    "Luxury",
    "TWG Tea Gift Box",
    2450,
    12,
    4,
  ],
  [
    18,
    "Tokyo Variety Run — December 2026",
    "Maria Santos",
    "Dec 18–27, 2026",
    "Mixed",
    "Don Quijote Favorites",
    1250,
    20,
    9,
  ],
  [
    19,
    "Jeju Local Flavors — January 2027",
    "Ana Reyes",
    "Jan 4–11, 2027",
    "Food",
    "Jeju Tangerine Sweets",
    560,
    22,
    6,
  ],
  [
    20,
    "Busan Barrier Care — January 2027",
    "Ana Reyes",
    "Jan 13–21, 2027",
    "Skincare",
    "Etude SoonJung Set",
    1580,
    15,
    10,
  ],
  [
    21,
    "New York Snack Drop — January 2027",
    "Paolo Garcia",
    "Jan 17–28, 2027",
    "Grocery & Snacks",
    "Whole Foods Snack Bag",
    1180,
    18,
    7,
  ],
  [
    22,
    "Phuket Beauty Market — February 2027",
    "Kristine Aquino",
    "Feb 2–9, 2027",
    "Beauty",
    "Srichand Powder Duo",
    640,
    20,
    12,
  ],
  [
    23,
    "Singapore Designer Edit — February 2027",
    "Jade Bautista",
    "Feb 8–16, 2027",
    "Luxury",
    "Charles & Keith Wallet",
    2950,
    10,
    3,
  ],
  [
    24,
    "Kyoto Seasonal Mix — February 2027",
    "Maria Santos",
    "Feb 12–20, 2027",
    "Mixed",
    "Kyoto Market Bundle",
    1380,
    18,
    8,
  ],
  [
    25,
    "Nagoya Food Finds — February 2027",
    "Maria Santos",
    "Feb 22–Mar 2, 2027",
    "Food",
    "Nagoya Miso Snack Set",
    740,
    20,
    13,
  ],
  [
    26,
    "Incheon Skincare Run — March 2027",
    "Ana Reyes",
    "Mar 3–11, 2027",
    "Skincare",
    "Anua Heartleaf Kit",
    1490,
    16,
    5,
  ],
  [
    27,
    "Seattle Grocery Haul — March 2027",
    "Paolo Garcia",
    "Mar 7–18, 2027",
    "Grocery & Snacks",
    "Seattle Coffee Sampler",
    1320,
    18,
    9,
  ],
  [
    28,
    "Chiang Mai Beauty Finds — March 2027",
    "Kristine Aquino",
    "Mar 12–20, 2027",
    "Beauty",
    "Oriental Princess Set",
    890,
    14,
    6,
  ],
  [
    29,
    "Orchard Road Luxury — March 2027",
    "Jade Bautista",
    "Mar 18–27, 2027",
    "Luxury",
    "Bacha Coffee Gift Set",
    2650,
    12,
    7,
  ],
  [
    30,
    "Japan Spring Mix — April 2027",
    "Maria Santos",
    "Apr 2–12, 2027",
    "Mixed",
    "Sakura Lifestyle Box",
    1680,
    20,
    10,
  ],
] as const

const ADDITIONAL_BATCHES_SEED: Omit<BatchItem, "rating" | "ratingCount" | "sellerId">[] =
  ADDITIONAL_BATCH_DEFINITIONS.map(
    ([
      id,
      title,
      seller,
      trips,
      category,
      productName,
      price,
      items,
      claimed,
    ]) => ({
      id,
      live: true,
      locked: false,
      title,
      seller,
      trips,
      items,
      claimed,
      category,
      reserveHours: 48,
      products: [
        {
          name: productName,
          price,
          qty: items,
          claimed,
          waitlist: 0,
          locked: false,
        },
      ],
    }),
  )

const BATCHES_SEED = [...BASE_BATCHES_SEED, ...ADDITIONAL_BATCHES_SEED]

// A seller's rating is looked up, never authored. `DEMO_RATINGS` is computed
// from the review seed in `reviews.ts`, which is the demo stand-in for the
// `public.profile_ratings` view.
export const BATCHES_INIT: BatchItem[] = BATCHES_SEED.map((batch) => {
  const sellerId = demoProfileId(batch.seller)
  const summary = sellerId ? DEMO_RATINGS[sellerId] : undefined
  return {
    ...batch,
    sellerId,
    rating: summary?.average ?? null,
    ratingCount: summary?.count ?? 0,
  }
})
