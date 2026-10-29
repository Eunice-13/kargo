import type { BatchItem } from "@/types"

const BASE_BATCHES_SEED: Omit<BatchItem, "sellerId">[] =
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

      coverImage:
        "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&h=400&fit=crop&auto=format",

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

      category: "Beauty",

      reserveHours: 48,

      coverImage:
        "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&h=400&fit=crop&auto=format",

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

      category: "Food",

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

      category: "Others",

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

      category: "Food",

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
          name: "85\u00B0C Pastries",

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

      category: "Beauty",

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

      category: "Food",

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
    "Beauty",
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
    "Food",
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
    "Others",
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
    "Beauty",
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
    "Food",
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
    "Others",
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
    "Beauty",
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
    "Food",
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
    "Others",
    "Sakura Lifestyle Box",
    1680,
    20,
    10,
  ],
  [
    31,
    "Tokyo Streetwear Drop — April 2027",
    "Maria Santos",
    "Apr 14–22, 2027",
    "Apparel",
    "Uniqlo U Collection Tee",
    890,
    18,
    6,
  ],
  [
    32,
    "Seoul Fashion Week Finds — May 2027",
    "Ana Reyes",
    "May 5–14, 2027",
    "Apparel",
    "Korean Oversized Knit",
    1350,
    16,
    9,
  ],
  [
    33,
    "Bangkok Thrift Haul — May 2027",
    "Kristine Aquino",
    "May 18–25, 2027",
    "Apparel",
    "Chatuchak Vintage Denim",
    1180,
    20,
    7,
  ],
] as const

const ADDITIONAL_BATCHES_SEED: Omit<BatchItem, "sellerId">[] =
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

const demoSellerId = (name: string) =>
  `demo-seller-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`

// Verified direct image records for seeded listings. The IDs are unique across
// covers and products; the URL construction keeps presentation components free
// of media constants and leaves Home's category artwork untouched.
const unsplashImage = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=1200&h=800&fit=crop&auto=format`

const BATCH_COVER_IMAGE_IDS = [
  "1528360983277-13d401cdc186", "1501339847302-ac426a4a7cbb", "1488646953014-85cb44e25828", "1528181304800-259b08848526", "1519501025264-65ba15a82390", "1530789253388-582c481c54b0", "1470770841072-f978cf4d019e", "1500534314209-a25ddb2bd429", "1480714378408-67cf0d13bc1b", "1514565131-fce0801e5785", "1500530855697-b586d89ba3ee", "1542296332-2e4473faf563", "1500534623283-312aade485b7", "1452626038306-9aae5e071dd3", "1498050108023-c5249f4df085", "1531297484001-80022131f5a1", "1441986300917-64674bd600d8", "1445205170230-053b83016050", "1441984904996-e0b6ba687e04", "1483985988355-763728e1935b", "1496747611176-843222e1e57c", "1509631179647-0177331693ae", "1539008835657-9e8e9680c956", "1551488831-00ddcb6c6bd3", "1512436991641-6745cdb1723f", "1598032895397-b9472444bf93", "1556761175-b413da4baf72", "1560343090-f0409e92791a", "1576566588028-4147f3842f27", "1588405748880-12d1d2a59f75", "1594633312681-425c7b97ccd1", "1539109136881-3be0616acf4b", "1485230895905-ec40ba36b9bc",
] as const

const PRODUCT_IMAGE_IDS = [
  "1504674900247-0877df9cc836", "1515003197210-e0cd71810b5f", "1551782450-a2132b4ba21d", "1540189549336-e6e99c3679fe", "1555939594-58d7cb561ad1", "1565299624946-b28f40a0ae38", "1484723091739-30a097e8f929", "1528712306091-ed0763094c98", "1498837167922-ddd27525d352", "1482049016688-2d3e1b311543", "1505253716362-afaea1d3d1af", "1533777857889-4be7c70b33f7", "1513104890138-7c749659a591", "1565958011703-44f9829ba187", "1551218808-94e220e084d2", "1568901346375-23c9450c58cd", "1496116218417-1a781b1c416c", "1572449043416-55f4685c9bb7", "1547592180-85f173990554", "1490474418585-ba9bad8fd0ea", "1556228720-195a672e8a03", "1598440947619-2c35fc9aa908", "1571781926291-c477ebfd024b", "1596755389378-c31d21fd1273", "1596462502278-27bfdc403348", "1556228578-8c89e6adf883", "1612817288484-6f916006741a", "1631729371254-42c2892f0e6e", "1608248543803-ba4f8c70ae0b", "1547887538-e3a2f32cb1cc", "1620916566398-39f1143ab7be", "1619451334792-150fd785ee74", "1608248597279-f99d160bfcbc", "1596464716127-f2a82984de30", "1490481651871-ab68de25d43d", "1485968579580-b6d095142e6e", "1525507119028-ed4c629a60a3", "1529139574466-a303027c1d8b", "1503342217505-b0a15ec3261c", "1542291026-7eec264c27ff", "1515886657613-9f3515b0c78f", "1475180098004-ca77a66827be", "1558618666-fcd25c85cd64", "1558769132-cb1aea458c5e", "1517841905240-472988babdf9", "1515372039744-b8f02a3ae446", "1521572163474-6864f9cf17ab", "1600185365483-26d7a4cc7519", "1523779917675-b6ed3a42a561",
] as const

let productImageIndex = 0

export const BATCHES_INIT: BatchItem[] = BATCHES_SEED.map((batch) => ({
  ...batch,
  coverImage: unsplashImage(BATCH_COVER_IMAGE_IDS[batch.id - 1]),
  products: batch.products.map((product) => ({
    ...product,
    imageUrl: unsplashImage(PRODUCT_IMAGE_IDS[productImageIndex++]),
  })),
  sellerId: demoSellerId(batch.seller),
}))
