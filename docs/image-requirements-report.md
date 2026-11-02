# Required, accurate catalog images — implementation report

## Result and outstanding media

Read CLAUDE.md, AGENTS.md and DESIGN.md before implementation. The real demo catalog has **33 batches, 48 unique product names and 50 product occurrences**.

- All 33 batch covers now show their stated destination, using 23 verified local destination photos.
- 21 unique products (23 occurrences) have individually viewed, matching local product photographs.
- **27 products need manual images**. Their required string fields are explicitly empty rather than fabricated or approximate photos. The product table below lists every unresolved entry and reason. Thus the “every seed product has a photo” criterion is not fully complete.
- Every assigned cover is at least 1200px wide and approximately 2:1; every product photo is square and at least 600px in both dimensions, without upscaling. Seoul is 1280×595 (about 2.15:1). All accepted product photographs were checked watermark-free.
- Product family labels without a specified shade/model keep their original label. The exact photographed variant is disclosed in the table and manifest; unspecified bundles were not invented.
- All 44 assigned images are local files. No runtime image search, generic stock lookup, category-cover fallback, generated image, per-title override or sample gallery remains.

The complete [machine-readable manifest](./catalog-image-sources.json) records every batch and product, source page and exact image/download URL, measured dimensions, crop/encoding, visual checks, source credit, license information and SHA256. See also the [image audit](./catalog-image-sources.md).

## Behavior and enforcement

The buyer homepage previously chose generic pictures by batch ID independently of the cover resolver. It now uses the actual cover for cards, rankings and carousels, as do seller and dashboard batch views. Product thumbnails, zooms, summaries, claims, standalone/combined payments, waitlists and admin product rows use their own stored product image. Order DTOs retain the product relation image when a batch no longer appears in the public catalog. A product photo is never substituted by a batch cover.

Missing/failed media is an explicit accessible “Photo unavailable” error state with no fake photograph or empty img src. Missing-image preview actions are disabled or omitted. Category navigation is text-only, not unrelated stock art.

Creation requires a cover plus a photo on every nonempty product row. Required labels, individual inline errors and first-missing-field focus/scroll are present. Entirely empty added rows are ignored and explained in the form; partially entered rows cannot silently disappear. The optional gallery stays optional. UI and API accept only nonempty JPEG, PNG, WebP or GIF files up to 5 MiB.

The API validates the entire upload selection before any writes. It generates IDs, uploads first, then invokes one security-invoker RPC that inserts the batch and all products atomically. Failures clean up newly uploaded, unreferenced objects; an uncertain/lost database response preserves files rather than deleting photographs that a committed row may reference. Cleanup/confirmation failures are surfaced clearly. Replacement uploads preserve the previous image on failure; no removal operation was introduced.

The old live-data seed scripts lack uploaded media. They now fail **before reset/auth/profile/database mutations**, rather than destroying/rebuilding data and failing partway against the new constraints. Read-only seed validation remains available. No live-data seeder was executed.

## Database deployment and existing null rows

New migrations, in order:

1. [202611070002_required_batch_images.sql](../supabase/migrations/202611070002_required_batch_images.sql): non-null, non-whitespace CHECK constraints on batches.cover_path and **batch_products.image_path** (the actual table name), plus atomic create_batch_with_products.
2. [202611070003_admin_batch_product_images.sql](../supabase/migrations/202611070003_admin_batch_product_images.sql): adds imagePath to admin_get_batch product JSON while retaining authorization and response fields.

Chosen approach: **CHECK ... NOT VALID**, not a fabricated backfill. Deployment does not scan/reject existing null rows; all legacy rows and paths remain unchanged and readable. Every new INSERT and UPDATE must satisfy the checks, including unrelated updates to a legacy imageless row. Sellers must repair the cover/item image before such rows can be updated normally. Legacy null media maps to an empty string on reads and never a substitute photograph.

Inventory legacy rows before deployment/repair:

```sql
select id, title from public.batches
where cover_path is null or cover_path !~ '[^[:space:]]';
select id, batch_id, name from public.batch_products
where image_path is null or image_path !~ '[^[:space:]]';
```

Repair via the seller's replacement-image controls, uploading a verified real photo for each listed row. Once both inventories are empty, a later controlled migration can run:

```sql
alter table public.batches validate constraint batches_cover_path_required;
alter table public.batch_products validate constraint batch_products_image_path_required;
```

Historical admin/group-order functions were reviewed: they do not insert new batch/product catalog rows. Their future writes are also subject to the table CHECK constraints. The new creation RPC uses auth.uid(), existing seller RLS, explicit writable columns and one transaction, with execution restricted to authenticated users.

**No migrations were applied to live Supabase, and no live rows were backfilled or modified.** The frontend and its RPC migration must be released together; there is intentionally no fallback to the old, partially committed create flow.

## Verification

- Production build: PASS (existing bundle-size warning only).
- TypeScript typecheck: PASS.
- Read-only seed checks: PASS, all 33 batches.
- Local image audit: PASS, 33 verified covers, 21 verified products, 27 explicitly missing products, 44 local files.
- Full Node suite after formatting: **358 passed / 361 total**. All image/API/SQL/render/creation-UI checks passed.
- Three remaining failures are in unchanged files: the source-text expectation for loadGroupOrder(groupOrderId, true) in leaderGroupOrders.test.mjs, plus Windows filesystem mode and symlink-permission checks in localRuntimeMetadata.test.mjs. The tests and underlying GroupOrderModal/isolation files have no diff from HEAD.
- The new migrations and both SQL regression files execute under isolated PGlite PostgreSQL. Tests exercise missing/blank paths, valid writes, atomic rollback, ownership/RLS and grants, legacy-row handling and admin image JSON.
- API tests cover all missing/invalid files, the 5 MiB boundary, zero-byte/type rejection, uploads before DB writes, partial upload failure, RPC rollback, lost responses, cleanup failures and safe replacement.
- Offline browser verification: all 44 local image files decode successfully at the recorded dimensions. Homepage cards display their actual destination covers. Dubai was additionally replaced after visual QA with a brighter, verified 1600×800 Marina photo.
- The final fulfillment-image API/render regression run passes all 73 tests.
- Browser creation tests cover required labels, per-row errors and first-missing-field focus in demo and stubbed-upload modes.
- Runtime source scan finds no old fallback helpers/maps, generic fallback URL, ID-based image list or name-search thumbnail endpoints.
- The repository formatting wrapper fails on the space in this Windows username; the same installed formatter was run directly against the changed files successfully.

Reproducible local checks:

```sh
npm run build
npm run typecheck
npm run test:seed
node --experimental-strip-types scripts/verify-catalog-images.mjs
node --experimental-strip-types --import ./scripts/lib/register.mjs --test tests/*.test.ts tests/*.test.mjs
```

## Every batch cover and its source

| ID  | Batch                                   | Destination actually shown | Local asset and exact source URLs                                                                                                     |
| --- | --------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Japan Trip — March 2026                 | Tokyo                      | [Local file](../public/catalog/covers/tokyo.jpg) · [Source][cover-tokyo-source] · [Image URL][cover-tokyo-image]                      |
| 2   | Korea Haul — April 2026                 | Seoul                      | [Local file](../public/catalog/covers/seoul.jpg) · [Source][cover-seoul-source] · [Image URL][cover-seoul-image]                      |
| 3   | US Pasabuy — May 2026                   | California                 | [Local file](../public/catalog/covers/california.jpg) · [Source][cover-california-source] · [Image URL][cover-california-image]       |
| 4   | HK Beauty Run — June 2026               | Hong Kong                  | [Local file](../public/catalog/covers/hong-kong.jpg) · [Source][cover-hong-kong-source] · [Image URL][cover-hong-kong-image]          |
| 5   | Bangkok Haul — June 2026                | Bangkok                    | [Local file](../public/catalog/covers/bangkok.jpg) · [Source][cover-bangkok-source] · [Image URL][cover-bangkok-image]                |
| 6   | Dubai Pasabuy — July 2026               | Dubai                      | [Local file](../public/catalog/covers/dubai.jpg) · [Source][cover-dubai-source] · [Image URL][cover-dubai-image]                      |
| 7   | UK Trip — August 2026                   | United Kingdom             | [Local file](../public/catalog/covers/uk.jpg) · [Source][cover-uk-source] · [Image URL][cover-uk-image]                               |
| 8   | Taiwan Finds — July 2026                | Taiwan                     | [Local file](../public/catalog/covers/taiwan.jpg) · [Source][cover-taiwan-source] · [Image URL][cover-taiwan-image]                   |
| 9   | Singapore Haul — Aug 2026               | Singapore                  | [Local file](../public/catalog/covers/singapore.jpg) · [Source][cover-singapore-source] · [Image URL][cover-singapore-image]          |
| 10  | Australia Run — Sep 2026                | Australia                  | [Local file](../public/catalog/covers/australia.jpg) · [Source][cover-australia-source] · [Image URL][cover-australia-image]          |
| 11  | France Luxury — Oct 2026                | France                     | [Local file](../public/catalog/covers/france.jpg) · [Source][cover-france-source] · [Image URL][cover-france-image]                   |
| 12  | Vietnam Haul — May 2026                 | Vietnam                    | [Local file](../public/catalog/covers/vietnam.jpg) · [Source][cover-vietnam-source] · [Image URL][cover-vietnam-image]                |
| 13  | Osaka Street Food — October 2026        | Osaka                      | [Local file](../public/catalog/covers/osaka.jpg) · [Source][cover-osaka-source] · [Image URL][cover-osaka-image]                      |
| 14  | Seoul Glow Edit — November 2026         | Seoul                      | [Local file](../public/catalog/covers/seoul.jpg) · [Source][cover-seoul-source] · [Image URL][cover-seoul-image]                      |
| 15  | California Pantry Run — November 2026   | California                 | [Local file](../public/catalog/covers/california.jpg) · [Source][cover-california-source] · [Image URL][cover-california-image]       |
| 16  | Bangkok Beauty Picks — November 2026    | Bangkok                    | [Local file](../public/catalog/covers/bangkok.jpg) · [Source][cover-bangkok-source] · [Image URL][cover-bangkok-image]                |
| 17  | Singapore Luxe Finds — December 2026    | Singapore                  | [Local file](../public/catalog/covers/singapore.jpg) · [Source][cover-singapore-source] · [Image URL][cover-singapore-image]          |
| 18  | Tokyo Variety Run — December 2026       | Tokyo                      | [Local file](../public/catalog/covers/tokyo.jpg) · [Source][cover-tokyo-source] · [Image URL][cover-tokyo-image]                      |
| 19  | Jeju Local Flavors — January 2027       | Jeju                       | [Local file](../public/catalog/covers/jeju.jpg) · [Source][cover-jeju-source] · [Image URL][cover-jeju-image]                         |
| 20  | Busan Barrier Care — January 2027       | Busan                      | [Local file](../public/catalog/covers/busan.jpg) · [Source][cover-busan-source] · [Image URL][cover-busan-image]                      |
| 21  | New York Snack Drop — January 2027      | New York                   | [Local file](../public/catalog/covers/new-york.jpg) · [Source][cover-new-york-source] · [Image URL][cover-new-york-image]             |
| 22  | Phuket Beauty Market — February 2027    | Phuket                     | [Local file](../public/catalog/covers/phuket.jpg) · [Source][cover-phuket-source] · [Image URL][cover-phuket-image]                   |
| 23  | Singapore Designer Edit — February 2027 | Singapore                  | [Local file](../public/catalog/covers/singapore.jpg) · [Source][cover-singapore-source] · [Image URL][cover-singapore-image]          |
| 24  | Kyoto Seasonal Mix — February 2027      | Kyoto                      | [Local file](../public/catalog/covers/kyoto.jpg) · [Source][cover-kyoto-source] · [Image URL][cover-kyoto-image]                      |
| 25  | Nagoya Food Finds — February 2027       | Nagoya                     | [Local file](../public/catalog/covers/nagoya.jpg) · [Source][cover-nagoya-source] · [Image URL][cover-nagoya-image]                   |
| 26  | Incheon Skincare Run — March 2027       | Incheon                    | [Local file](../public/catalog/covers/incheon.jpg) · [Source][cover-incheon-source] · [Image URL][cover-incheon-image]                |
| 27  | Seattle Grocery Haul — March 2027       | Seattle                    | [Local file](../public/catalog/covers/seattle.jpg) · [Source][cover-seattle-source] · [Image URL][cover-seattle-image]                |
| 28  | Chiang Mai Beauty Finds — March 2027    | Chiang Mai                 | [Local file](../public/catalog/covers/chiang-mai.jpg) · [Source][cover-chiang-mai-source] · [Image URL][cover-chiang-mai-image]       |
| 29  | Orchard Road Luxury — March 2027        | Orchard Road, Singapore    | [Local file](../public/catalog/covers/orchard-road.jpg) · [Source][cover-orchard-road-source] · [Image URL][cover-orchard-road-image] |
| 30  | Japan Spring Mix — April 2027           | Tokyo                      | [Local file](../public/catalog/covers/tokyo.jpg) · [Source][cover-tokyo-source] · [Image URL][cover-tokyo-image]                      |
| 31  | Tokyo Streetwear Drop — April 2027      | Tokyo                      | [Local file](../public/catalog/covers/tokyo.jpg) · [Source][cover-tokyo-source] · [Image URL][cover-tokyo-image]                      |
| 32  | Seoul Fashion Week Finds — May 2027     | Seoul                      | [Local file](../public/catalog/covers/seoul.jpg) · [Source][cover-seoul-source] · [Image URL][cover-seoul-image]                      |
| 33  | Bangkok Thrift Haul — May 2027          | Bangkok                    | [Local file](../public/catalog/covers/bangkok.jpg) · [Source][cover-bangkok-source] · [Image URL][cover-bangkok-image]                |

## Every unique product and its image/manual status

Identical product names in multiple batches share the same matching product photo. Different products do not share a photograph.

| Product                 | Batch IDs | Exact pictured product or status                                                                                                                                                                                     | Local asset/source URLs or missing-image reason                                                                                                                                                          |
| ----------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tokyo Banana            | 1         | TOKYO BANANA Original Flavor banana custard sponge cake                                                                                                                                                              | [Local file](../public/catalog/products/tokyo-banana.jpg) · [Source][product-tokyo-banana-source] · [Image URL][product-tokyo-banana-image]                                                              |
| KitKat Sakura           | 1         | キットカット サクラサク 桜味 (KitKat Sakura Saku, Sakura flavor), pink 9-piece Japanese retail bag. Exact photographed front label reads 桜味; this is a flavor-labeled edition, not inferred from a spring wrapper. | [Local file](../public/catalog/products/kitkat-sakura.jpg) · [Source][product-kitkat-sakura-source] · [Image URL][product-kitkat-sakura-image]                                                           |
| Shiseido Sunscreen      | 1, 4      | SHISEIDO Perfect Sun Protector Lotion SPF50+ PA++++, pictured Japanese 50mL blue bottle                                                                                                                              | [Local file](../public/catalog/products/shiseido-sunscreen.jpg) · [Source][product-shiseido-sunscreen-source] · [Image URL][product-shiseido-sunscreen-image]                                            |
| Meiji Chocolate         | 1         | Meiji Milk Chocolate bar, brown/gold package                                                                                                                                                                         | [Local file](../public/catalog/products/meiji-chocolate.jpg) · [Source][product-meiji-chocolate-source] · [Image URL][product-meiji-chocolate-image]                                                     |
| Laneige Lip Mask        | 2         | LANEIGE Lip Sleeping Mask Berry, pictured 8g jar                                                                                                                                                                     | [Local file](../public/catalog/products/laneige-lip-mask.jpg) · [Source][product-laneige-lip-mask-source] · [Image URL][product-laneige-lip-mask-image]                                                  |
| COSRX Snail Cream       | 2         | COSRX Advanced Snail 92 All In One Cream                                                                                                                                                                             | [Local file](../public/catalog/products/cosrx-snail-cream.jpg) · [Source][product-cosrx-snail-cream-source] · [Image URL][product-cosrx-snail-cream-image]                                               |
| Korean Skincare Set     | 2         | needs manual image                                                                                                                                                                                                   | Needs a brand, exact set name and contents; this is a generic bundle description.                                                                                                                        |
| Paldo Bibimmyeon        | 2         | Paldo Bibimmyeon original blue packet; pictured 130g package                                                                                                                                                         | [Local file](../public/catalog/products/paldo-bibimmyeon.jpg) · [Source][product-paldo-bibimmyeon-source] · [Image URL][product-paldo-bibimmyeon-image]                                                  |
| Trader Joe's Snacks     | 3         | needs manual image                                                                                                                                                                                                   | Needs the exact snack SKU or a seller photo of the specified bundle; this describes an assortment with no contents.                                                                                      |
| Muji Skincare           | 3, 4      | MUJI Sensitive Skin Moisturising Milk - Moisture, 200ml                                                                                                                                                              | [Local file](../public/catalog/products/muji-skincare.jpg) · [Source][product-muji-skincare-source] · [Image URL][product-muji-skincare-image]                                                           |
| Thai Snack Box          | 5         | needs manual image                                                                                                                                                                                                   | Needs the seller/brand and box contents; several unrelated snack boxes use this generic name.                                                                                                            |
| Mistine Sunscreen       | 5         | MISTINE UV Restore Face Serum Sunscreen SPF50, pictured blue 30mL tube                                                                                                                                               | [Local file](../public/catalog/products/mistine-sunscreen.jpg) · [Source][product-mistine-sunscreen-source] · [Image URL][product-mistine-sunscreen-image]                                               |
| Nars Blush              | 6         | NARS Powder Blush; Deep Throat gallery photograph (source asset name)                                                                                                                                                | [Local file](../public/catalog/products/nars-blush.jpg) · [Source][product-nars-blush-source] · [Image URL][product-nars-blush-image]                                                                    |
| MAC Lipstick Set        | 6         | needs manual image                                                                                                                                                                                                   | Needs the exact set name, shade list and edition; an arbitrary MAC lipstick collection would not identify this bundle.                                                                                   |
| Cadbury Hamper          | 7         | needs manual image                                                                                                                                                                                                   | Needs the exact hamper name and contents; Cadbury sells multiple different gift hampers.                                                                                                                 |
| Boots Skincare          | 7         | Boots Ingredients Hyaluronic Acid Serum 30ml, pump bottle and pink carton                                                                                                                                            | [Local file](../public/catalog/products/boots-skincare.jpg) · [Source][product-boots-skincare-source] · [Image URL][product-boots-skincare-image]                                                        |
| 85°C Pastries           | 8         | needs manual image                                                                                                                                                                                                   | Needs the named pastry or confirmed assortment contents. A bakery/category name does not identify an exact product.                                                                                      |
| Dr. Wu Serum            | 8         | DR.WU Mandelik Intensive Renewal Serum 18%, pictured 30mL red dropper bottle                                                                                                                                         | [Local file](../public/catalog/products/dr-wu-serum.jpg) · [Source][product-dr-wu-serum-source] · [Image URL][product-dr-wu-serum-image]                                                                 |
| SK-II Essence           | 9         | SK-II PITERA Facial Treatment Essence, silver-cap bottle                                                                                                                                                             | [Local file](../public/catalog/products/sk-ii-essence.webp) · [Source][product-sk-ii-essence-source] · [Image URL][product-sk-ii-essence-image]                                                          |
| Hada Labo Serum         | 9         | Hada Labo Gokujyun Premium Ultimate Moisturizing Serum, gold bottle and carton                                                                                                                                       | [Local file](../public/catalog/products/hada-labo-serum.jpg) · [Source][product-hada-labo-serum-source] · [Image URL][product-hada-labo-serum-image]                                                     |
| Innisfree Sheet Mask    | 9         | innisfree Green Tea Energy facial sheet mask, pictured 22mL sachet                                                                                                                                                   | [Local file](../public/catalog/products/innisfree-sheet-mask.jpg) · [Source][product-innisfree-sheet-mask-source] · [Image URL][product-innisfree-sheet-mask-image]                                      |
| Tim Tam Assorted        | 10        | Actual assorted Tim Tam four-flavor gift assortment: Original, Chewy Caramel, Double Coat, and Sweet & Salty inspired by Jatz, in a Treats From Home gift box.                                                       | [Local file](../public/catalog/products/tim-tam-assorted.jpg) · [Source][product-tim-tam-assorted-source] · [Image URL][product-tim-tam-assorted-image]                                                  |
| Aesop Hand Cream        | 10        | Aesop Resurrection Aromatique Hand Balm,75mL tube                                                                                                                                                                    | [Local file](../public/catalog/products/aesop-hand-cream.jpg) · [Source][product-aesop-hand-cream-source] · [Image URL][product-aesop-hand-cream-image]                                                  |
| L'Occitane Set          | 11        | needs manual image                                                                                                                                                                                                   | Needs the named set, edition and contents; the brand sells numerous unrelated gift sets.                                                                                                                 |
| Lancôme Serum           | 11        | Lancôme Advanced Génifique Youth Activating Concentrate, 100ml bottle, outer box and dropper.                                                                                                                        | [Local file](../public/catalog/products/lancome-serum.jpg) · [Source][product-lancome-serum-source] · [Image URL][product-lancome-serum-image]                                                           |
| Lacvert Sheet Mask      | 12        | needs manual image                                                                                                                                                                                                   | No accepted, branded and watermark-free product photo with native width and height both at least 600px was verified. Do not substitute another brand or enlarge/pad a smaller source to fake compliance. |
| X-Men Serum             | 12        | needs manual image                                                                                                                                                                                                   | No exact SKU or confirmed manufacturer/product match established from the seed name; needs the full product identity and a manual image.                                                                 |
| Osaka Takoyaki Kit      | 13        | needs manual image                                                                                                                                                                                                   | Needs the brand, exact kit name and contents; a destination/food description does not identify a packaged kit.                                                                                           |
| Round Lab Sunscreen     | 14        | ROUND LAB Birch Juice Moisturizing UVLock Sunscreen SPF50, pictured 50mL tube                                                                                                                                        | [Local file](../public/catalog/products/round-lab-sunscreen.jpg) · [Source][product-round-lab-sunscreen-source] · [Image URL][product-round-lab-sunscreen-image]                                         |
| Trader Joe's Cookie Box | 15        | needs manual image                                                                                                                                                                                                   | Needs the exact named cookie product or seller-defined box contents; no identifiable SKU is supplied.                                                                                                    |
| Cathy Doll Lip Set      | 16        | needs manual image                                                                                                                                                                                                   | Needs the exact set name, included formulas and shades; selecting a marketed lip combo would invent the bundle.                                                                                          |
| TWG Tea Gift Box        | 17        | needs manual image                                                                                                                                                                                                   | Needs the exact gift-box name and teas/contents; Classic, Tea for Two, Ramadan and other boxes differ.                                                                                                   |
| Don Quijote Favorites   | 18        | needs manual image                                                                                                                                                                                                   | Needs the seller-defined bundle contents and a matching seller image; this is an open-ended store assortment.                                                                                            |
| Jeju Tangerine Sweets   | 19        | needs manual image                                                                                                                                                                                                   | Needs the manufacturer, candy/pastry name and package variant; the regional category is insufficient.                                                                                                    |
| Etude SoonJung Set      | 20        | needs manual image                                                                                                                                                                                                   | Needs the exact set name and included products/sizes. SoonJung is a product line with multiple sets.                                                                                                     |
| Whole Foods Snack Bag   | 21        | needs manual image                                                                                                                                                                                                   | Needs the seller-defined contents or exact named retail bundle; no single identifiable product is specified.                                                                                             |
| Srichand Powder Duo     | 22        | needs manual image                                                                                                                                                                                                   | Needs the powder formula, shades and exact duo contents; two arbitrary powders would be an approximate substitute.                                                                                       |
| Charles & Keith Wallet  | 23        | CHARLES & KEITH Muriel Front Flap Long Wallet, Black, XS                                                                                                                                                             | [Local file](../public/catalog/products/charles-keith-wallet.jpg) · [Source][product-charles-keith-wallet-source] · [Image URL][product-charles-keith-wallet-image]                                      |
| Kyoto Market Bundle     | 24        | needs manual image                                                                                                                                                                                                   | Needs the seller-defined contents and an actual photograph of that bundle; no identifiable retail product is specified.                                                                                  |
| Nagoya Miso Snack Set   | 25        | needs manual image                                                                                                                                                                                                   | Needs the brand, exact set name and contents; regional ingredients do not identify a packaged set.                                                                                                       |
| Anua Heartleaf Kit      | 26        | needs manual image                                                                                                                                                                                                   | Needs the exact kit and contents. Trial/travel kits and retailer full-size Heartleaf bundles differ.                                                                                                     |
| Seattle Coffee Sampler  | 27        | needs manual image                                                                                                                                                                                                   | Needs the roaster, exact sampler name and coffees/contents; the location is insufficient.                                                                                                                |
| Oriental Princess Set   | 28        | needs manual image                                                                                                                                                                                                   | Needs the named range, fragrance and set contents; the seed specifies only a brand and generic set.                                                                                                      |
| Bacha Coffee Gift Set   | 29        | needs manual image                                                                                                                                                                                                   | Needs the exact named gift set and contents; Discovery, Heritage and seasonal gifts differ.                                                                                                              |
| Sakura Lifestyle Box    | 30        | needs manual image                                                                                                                                                                                                   | Needs the brand/seller and exact bundle contents; a seasonal description cannot identify the merchandise.                                                                                                |
| Uniqlo U Collection Tee | 31        | UNIQLO U Crew Neck Short-Sleeve T-Shirt, product 452405, color 38 Dark Brown.                                                                                                                                        | [Local file](../public/catalog/products/uniqlo-u-collection-tee.jpg) · [Source][product-uniqlo-u-collection-tee-source] · [Image URL][product-uniqlo-u-collection-tee-image]                             |
| Korean Oversized Knit   | 32        | needs manual image                                                                                                                                                                                                   | Needs the brand/SKU, cut and color or a seller photo of the actual garment; the name is only a clothing description.                                                                                     |
| Chatuchak Vintage Denim | 33        | needs manual image                                                                                                                                                                                                   | Needs a seller photo of the actual vintage garment, style and wash; a generic denim photo would misrepresent it.                                                                                         |

## Every changed file

This inventory includes the pre-existing image edits from earlier turns that were replaced or completed during this task. It excludes build outputs, logs and caches.

- [scripts/seed-maria.mjs](../scripts/seed-maria.mjs)
- [scripts/seed-supabase.mjs](../scripts/seed-supabase.mjs)
- [src/components/shared/BatchMedia.tsx](../src/components/shared/BatchMedia.tsx)
- [src/components/shared/ProductThumb.tsx](../src/components/shared/ProductThumb.tsx)
- [src/components/shared/SummaryBlock.tsx](../src/components/shared/SummaryBlock.tsx)
- [src/components/shared/index.ts](../src/components/shared/index.ts)
- [src/constants/categories.ts](../src/constants/categories.ts)
- [src/constants/theme.ts](../src/constants/theme.ts)
- [src/data/batches.ts](../src/data/batches.ts)
- [src/features/admin/adminTypes.ts](../src/features/admin/adminTypes.ts)
- [src/features/admin/components/AdminBatchDetailModal.tsx](../src/features/admin/components/AdminBatchDetailModal.tsx)
- [src/features/batches/BatchCover.tsx](../src/features/batches/BatchCover.tsx)
- [src/features/batches/BatchPage.tsx](../src/features/batches/BatchPage.tsx)
- [src/features/batches/Batches.tsx](../src/features/batches/Batches.tsx)
- [src/features/batches/BuyerHome.tsx](../src/features/batches/BuyerHome.tsx)
- [src/features/batches/ItemClaimModal.tsx](../src/features/batches/ItemClaimModal.tsx)
- [src/features/batches/JoinWaitlistModal.tsx](../src/features/batches/JoinWaitlistModal.tsx)
- [src/features/batches/NewBatchModal.tsx](../src/features/batches/NewBatchModal.tsx)
- [src/features/batches/SellerShopPage.tsx](../src/features/batches/SellerShopPage.tsx)
- [src/features/claims/MyClaims.tsx](../src/features/claims/MyClaims.tsx)
- [src/features/claims/PendingPaymentCard.tsx](../src/features/claims/PendingPaymentCard.tsx)
- [src/features/claims/SetShippingFeeModal.tsx](../src/features/claims/SetShippingFeeModal.tsx)
- [src/features/combined-delivery/CombinedPaymentCard.tsx](../src/features/combined-delivery/CombinedPaymentCard.tsx)
- [src/features/dashboard/Dashboard.tsx](../src/features/dashboard/Dashboard.tsx)
- [src/features/dashboard/PopularBatchesCard.tsx](../src/features/dashboard/PopularBatchesCard.tsx)
- [src/features/dashboard/WaitlistModal.tsx](../src/features/dashboard/WaitlistModal.tsx)
- [src/features/fulfillment/FulfillmentBoard.tsx](../src/features/fulfillment/FulfillmentBoard.tsx)
- [src/features/fulfillment/FulfillmentDetails.tsx](../src/features/fulfillment/FulfillmentDetails.tsx)
- [src/features/fulfillment/TrackingDetailsModal.tsx](../src/features/fulfillment/TrackingDetailsModal.tsx)
- [src/features/fulfillment/fulfillmentData.ts](../src/features/fulfillment/fulfillmentData.ts)
- [src/features/payments/BatchCheckoutModal.tsx](../src/features/payments/BatchCheckoutModal.tsx)
- [src/features/payments/PaymentSubmitModal.tsx](../src/features/payments/PaymentSubmitModal.tsx)
- [src/features/payments/Payments.tsx](../src/features/payments/Payments.tsx)
- [src/features/payments/SellerPaymentVerification.tsx](../src/features/payments/SellerPaymentVerification.tsx)
- [src/features/payments/index.ts](../src/features/payments/index.ts)
- [src/features/payments/verifyTypes.ts](../src/features/payments/verifyTypes.ts)
- [src/services/kargoApi.ts](../src/services/kargoApi.ts)
- [src/services/paymentReadCompatibility.ts](../src/services/paymentReadCompatibility.ts)
- [src/types/index.ts](../src/types/index.ts)
- [tests/combinedDeliveryRequestUi.test.mjs](../tests/combinedDeliveryRequestUi.test.mjs)
- [tests/fixtures/PaymentModalShared.ts](../tests/fixtures/PaymentModalShared.ts)
- [tests/paymentReadCompatibility.test.ts](../tests/paymentReadCompatibility.test.ts)
- [tests/pendingPaymentCard.test.mjs](../tests/pendingPaymentCard.test.mjs)
- [docs/catalog-image-sources.json](../docs/catalog-image-sources.json)
- [docs/catalog-image-sources.md](../docs/catalog-image-sources.md)
- [docs/image-requirements-report.md](../docs/image-requirements-report.md)
- [public/catalog/covers/australia.jpg](../public/catalog/covers/australia.jpg)
- [public/catalog/covers/bangkok.jpg](../public/catalog/covers/bangkok.jpg)
- [public/catalog/covers/busan.jpg](../public/catalog/covers/busan.jpg)
- [public/catalog/covers/california.jpg](../public/catalog/covers/california.jpg)
- [public/catalog/covers/chiang-mai.jpg](../public/catalog/covers/chiang-mai.jpg)
- [public/catalog/covers/dubai.jpg](../public/catalog/covers/dubai.jpg)
- [public/catalog/covers/france.jpg](../public/catalog/covers/france.jpg)
- [public/catalog/covers/hong-kong.jpg](../public/catalog/covers/hong-kong.jpg)
- [public/catalog/covers/incheon.jpg](../public/catalog/covers/incheon.jpg)
- [public/catalog/covers/jeju.jpg](../public/catalog/covers/jeju.jpg)
- [public/catalog/covers/kyoto.jpg](../public/catalog/covers/kyoto.jpg)
- [public/catalog/covers/nagoya.jpg](../public/catalog/covers/nagoya.jpg)
- [public/catalog/covers/new-york.jpg](../public/catalog/covers/new-york.jpg)
- [public/catalog/covers/orchard-road.jpg](../public/catalog/covers/orchard-road.jpg)
- [public/catalog/covers/osaka.jpg](../public/catalog/covers/osaka.jpg)
- [public/catalog/covers/phuket.jpg](../public/catalog/covers/phuket.jpg)
- [public/catalog/covers/seattle.jpg](../public/catalog/covers/seattle.jpg)
- [public/catalog/covers/seoul.jpg](../public/catalog/covers/seoul.jpg)
- [public/catalog/covers/singapore.jpg](../public/catalog/covers/singapore.jpg)
- [public/catalog/covers/taiwan.jpg](../public/catalog/covers/taiwan.jpg)
- [public/catalog/covers/tokyo.jpg](../public/catalog/covers/tokyo.jpg)
- [public/catalog/covers/uk.jpg](../public/catalog/covers/uk.jpg)
- [public/catalog/covers/vietnam.jpg](../public/catalog/covers/vietnam.jpg)
- [public/catalog/products/aesop-hand-cream.jpg](../public/catalog/products/aesop-hand-cream.jpg)
- [public/catalog/products/boots-skincare.jpg](../public/catalog/products/boots-skincare.jpg)
- [public/catalog/products/charles-keith-wallet.jpg](../public/catalog/products/charles-keith-wallet.jpg)
- [public/catalog/products/cosrx-snail-cream.jpg](../public/catalog/products/cosrx-snail-cream.jpg)
- [public/catalog/products/dr-wu-serum.jpg](../public/catalog/products/dr-wu-serum.jpg)
- [public/catalog/products/hada-labo-serum.jpg](../public/catalog/products/hada-labo-serum.jpg)
- [public/catalog/products/innisfree-sheet-mask.jpg](../public/catalog/products/innisfree-sheet-mask.jpg)
- [public/catalog/products/kitkat-sakura.jpg](../public/catalog/products/kitkat-sakura.jpg)
- [public/catalog/products/lancome-serum.jpg](../public/catalog/products/lancome-serum.jpg)
- [public/catalog/products/laneige-lip-mask.jpg](../public/catalog/products/laneige-lip-mask.jpg)
- [public/catalog/products/meiji-chocolate.jpg](../public/catalog/products/meiji-chocolate.jpg)
- [public/catalog/products/mistine-sunscreen.jpg](../public/catalog/products/mistine-sunscreen.jpg)
- [public/catalog/products/muji-skincare.jpg](../public/catalog/products/muji-skincare.jpg)
- [public/catalog/products/nars-blush.jpg](../public/catalog/products/nars-blush.jpg)
- [public/catalog/products/paldo-bibimmyeon.jpg](../public/catalog/products/paldo-bibimmyeon.jpg)
- [public/catalog/products/round-lab-sunscreen.jpg](../public/catalog/products/round-lab-sunscreen.jpg)
- [public/catalog/products/shiseido-sunscreen.jpg](../public/catalog/products/shiseido-sunscreen.jpg)
- [public/catalog/products/sk-ii-essence.webp](../public/catalog/products/sk-ii-essence.webp)
- [public/catalog/products/tim-tam-assorted.jpg](../public/catalog/products/tim-tam-assorted.jpg)
- [public/catalog/products/tokyo-banana.jpg](../public/catalog/products/tokyo-banana.jpg)
- [public/catalog/products/uniqlo-u-collection-tee.jpg](../public/catalog/products/uniqlo-u-collection-tee.jpg)
- [scripts/verify-catalog-images.mjs](../scripts/verify-catalog-images.mjs)
- [src/features/payments/productImage.ts](../src/features/payments/productImage.ts)
- [supabase/migrations/202611070002_required_batch_images.sql](../supabase/migrations/202611070002_required_batch_images.sql)
- [supabase/migrations/202611070003_admin_batch_product_images.sql](../supabase/migrations/202611070003_admin_batch_product_images.sql)
- [supabase/tests/admin_batch_product_images.sql](../supabase/tests/admin_batch_product_images.sql)
- [supabase/tests/required_batch_images.sql](../supabase/tests/required_batch_images.sql)
- [tests/batchImagesApi.test.mjs](../tests/batchImagesApi.test.mjs)
- [tests/batchImagesDb.test.mjs](../tests/batchImagesDb.test.mjs)
- [tests/catalogMedia.test.mjs](../tests/catalogMedia.test.mjs)
- [tests/fixtures/BatchImagesClient.ts](../tests/fixtures/BatchImagesClient.ts)
- [tests/helpers/catalogImagesPreview.mjs](../tests/helpers/catalogImagesPreview.mjs)
- [tests/newBatchModalUi.test.mjs](../tests/newBatchModalUi.test.mjs)
- [../.vscode/tasks.json](../../.vscode/tasks.json) — local production-build and offline-preview tasks in the enclosing workspace.

## Image URL references

[cover-osaka-source]: https://commons.wikimedia.org/wiki/File:Osaka_Dotonbori_yoru.jpg
[cover-osaka-image]: https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9d/Osaka_Dotonbori_yoru.jpg/1280px-Osaka_Dotonbori_yoru.jpg
[cover-seoul-source]: https://commons.wikimedia.org/wiki/File:Seoul_panorama.jpg
[cover-seoul-image]: https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6e/Seoul_panorama.jpg/1280px-Seoul_panorama.jpg
[cover-tokyo-source]: https://commons.wikimedia.org/wiki/File:Tokyo_skyline_seen_from_Tokyo_Skytree.jpg
[cover-tokyo-image]: https://thumb.wikimedia.org/wikipedia/commons/thumb/9/98/Tokyo_skyline_seen_from_Tokyo_Skytree.jpg/1280px-Tokyo_skyline_seen_from_Tokyo_Skytree.jpg
[cover-jeju-source]: https://commons.wikimedia.org/wiki/File:Seongsan_Ilchulbong_01.jpg
[cover-jeju-image]: https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fc/Seongsan_Ilchulbong_01.jpg/1280px-Seongsan_Ilchulbong_01.jpg
[cover-kyoto-source]: https://commons.wikimedia.org/wiki/File:Kiyomizu_Temple_in_Kyoto.jpg
[cover-kyoto-image]: https://thumb.wikimedia.org/wikipedia/commons/thumb/8/80/Kiyomizu_Temple_in_Kyoto.jpg/1280px-Kiyomizu_Temple_in_Kyoto.jpg
[cover-nagoya-source]: https://commons.wikimedia.org/wiki/File:Nagoya_Castle.JPG
[cover-nagoya-image]: https://thumb.wikimedia.org/wikipedia/commons/thumb/b/ba/Nagoya_Castle.JPG/1280px-Nagoya_Castle.JPG
[cover-busan-source]: https://commons.wikimedia.org/wiki/File:Busan_Haeundae-gu_Night_View.jpg
[cover-busan-image]: https://thumb.wikimedia.org/wikipedia/commons/thumb/1/15/Busan_Haeundae-gu_Night_View.jpg/1280px-Busan_Haeundae-gu_Night_View.jpg
[cover-incheon-source]: https://commons.wikimedia.org/wiki/File:Songdo%27s_central_park_and_the_NEATT,_Incheon,_South_Korea.jpg
[cover-incheon-image]: https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d4/Songdo%27s_central_park_and_the_NEATT%2C_Incheon%2C_South_Korea.jpg/1280px-Songdo%27s_central_park_and_the_NEATT%2C_Incheon%2C_South_Korea.jpg
[cover-bangkok-source]: https://commons.wikimedia.org/wiki/File:Bangkok_skyline,_Bangkok,_Thailand.jpg
[cover-bangkok-image]: https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2e/Bangkok_skyline%2C_Bangkok%2C_Thailand.jpg/1280px-Bangkok_skyline%2C_Bangkok%2C_Thailand.jpg
[cover-singapore-source]: https://commons.wikimedia.org/wiki/File:Singapore_Skyline_Panorama_(54146978992).jpg
[cover-singapore-image]: https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d9/Singapore_Skyline_Panorama_%2854146978992%29.jpg/3840px-Singapore_Skyline_Panorama_%2854146978992%29.jpg
[cover-phuket-source]: https://commons.wikimedia.org/wiki/File:Patong_Beach,_Phuket,_Thailand_Panorama.jpg
[cover-phuket-image]: https://thumb.wikimedia.org/wikipedia/commons/thumb/2/29/Patong_Beach%2C_Phuket%2C_Thailand_Panorama.jpg/3840px-Patong_Beach%2C_Phuket%2C_Thailand_Panorama.jpg
[cover-chiang-mai-source]: https://commons.wikimedia.org/wiki/File:Chiang_Mai_Panorama.jpg
[cover-chiang-mai-image]: https://thumb.wikimedia.org/wikipedia/commons/thumb/3/38/Chiang_Mai_Panorama.jpg/3840px-Chiang_Mai_Panorama.jpg
[cover-hong-kong-source]: https://commons.wikimedia.org/wiki/File:Hong-Kong_skyline.JPG
[cover-hong-kong-image]: https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d7/Hong-Kong_skyline.JPG/1280px-Hong-Kong_skyline.JPG
[cover-taiwan-source]: https://commons.wikimedia.org/wiki/File:Taipei_city.jpg
[cover-taiwan-image]: https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/Taipei_city.jpg/1280px-Taipei_city.jpg
[cover-vietnam-source]: https://commons.wikimedia.org/wiki/File:20190926_Ha_Long_Bay-27.jpg
[cover-vietnam-image]: https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/20190926_Ha_Long_Bay-27.jpg/1280px-20190926_Ha_Long_Bay-27.jpg
[cover-dubai-source]: https://commons.wikimedia.org/wiki/File:Dubai_Marina_Panorama.jpg
[cover-dubai-image]: https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2f/Dubai_Marina_Panorama.jpg/3840px-Dubai_Marina_Panorama.jpg?utm_campaign=index&utm_content=thumbnail&utm_source=commons.wikimedia.org
[cover-uk-source]: https://commons.wikimedia.org/wiki/File:Thames_Panorama,_London_-_June_2009.jpg
[cover-uk-image]: https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ae/Thames_Panorama%2C_London_-_June_2009.jpg/3840px-Thames_Panorama%2C_London_-_June_2009.jpg
[cover-australia-source]: https://commons.wikimedia.org/wiki/File:Sydney_Harbour_Bridge_and_Sydney_Opera_House_panorama.jpg
[cover-australia-image]: https://thumb.wikimedia.org/wikipedia/commons/thumb/6/60/Sydney_Harbour_Bridge_and_Sydney_Opera_House_panorama.jpg/1280px-Sydney_Harbour_Bridge_and_Sydney_Opera_House_panorama.jpg
[cover-france-source]: https://commons.wikimedia.org/wiki/File:Panorama_of_the_Paris_Skyline.jpg
[cover-france-image]: https://thumb.wikimedia.org/wikipedia/commons/thumb/2/25/Panorama_of_the_Paris_Skyline.jpg/3840px-Panorama_of_the_Paris_Skyline.jpg
[cover-orchard-road-source]: https://commons.wikimedia.org/wiki/File:OrchardRoad.jpg
[cover-orchard-road-image]: https://thumb.wikimedia.org/wikipedia/commons/thumb/8/87/OrchardRoad.jpg/1280px-OrchardRoad.jpg
[cover-california-source]: https://commons.wikimedia.org/wiki/File:Panorama_of_Golden_Gate_Bridge.jpg
[cover-california-image]: https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a4/Panorama_of_Golden_Gate_Bridge.jpg/3840px-Panorama_of_Golden_Gate_Bridge.jpg
[cover-new-york-source]: https://commons.wikimedia.org/wiki/File:NYC_skyline_panorama.jpg
[cover-new-york-image]: https://thumb.wikimedia.org/wikipedia/commons/thumb/6/64/NYC_skyline_panorama.jpg/3840px-NYC_skyline_panorama.jpg
[cover-seattle-source]: https://commons.wikimedia.org/wiki/File:Seattle_skyline_panorama_from_Kerry_Park,_June_2022.jpg
[cover-seattle-image]: https://thumb.wikimedia.org/wikipedia/commons/thumb/1/16/Seattle_skyline_panorama_from_Kerry_Park%2C_June_2022.jpg/3840px-Seattle_skyline_panorama_from_Kerry_Park%2C_June_2022.jpg
[product-tokyo-banana-source]: https://www.tokyobanana.jp/language/en/products/28.html
[product-tokyo-banana-image]: https://www.tokyobanana.jp/language/images/products/28_original_01.jpg
[product-cosrx-snail-cream-source]: https://www.cosrx.com/products/advanced-snail-92-all-in-one-cream
[product-cosrx-snail-cream-image]: https://www.cosrx.com/cdn/shop/files/5_bc6986a1-1b85-42ce-b761-6bc4acbb07a3_1024x1024.png?v=1757571879
[product-paldo-bibimmyeon-source]: https://www.kankokuichiba.jp/en/products/ks-5039
[product-paldo-bibimmyeon-image]: https://www.kankokuichiba.jp/cdn/shop/files/KS-5039_20240812_2.jpg?v=1723459073&width=1500
[product-nars-blush-source]: https://www.narscosmetics.ie/en/powder-blush/0194251140414.html
[product-nars-blush-image]: https://www.narscosmetics.ie/fstrz/r/s/www.narscosmetics.ie/dw/image/v2/BCMQ_PRD/on/demandware.static/-/Sites-itemmaster_NARS/default/dw26b97d78/pdp/999NAC0000192/NARS_SP26_DeeplyBloomingCollection_PDPCrop_Blush_SoldierSwatch_DeepThroat_GLBL.jpg?sw=1080&sh=1080&sm=fit&frz-v=1643
[product-meiji-chocolate-source]: https://www.japancandystore.com/products/japanese-meiji-chocolate-bar-milk-chocolate
[product-meiji-chocolate-image]: https://cdn.shopify.com/s/files/1/0713/9790/0584/files/20140221_003_1.jpg?v=1780845238
[product-aesop-hand-cream-source]: https://www.aesop.ae/products/resurrection-aromatique-hand-balm-s
[product-aesop-hand-cream-image]: https://www.aesop.ae/cdn/shop/files/Aesop_Hand_Resurrection_Aromatique_Hand_Balm_75mL_Web_Front_A_2000x2000px.png?v=1764851818&width=1445
[product-laneige-lip-mask-source]: https://us.laneige.com/products/lip-sleeping-mask
[product-laneige-lip-mask-image]: https://us.laneige.com/cdn/shop/files/LSM_Berry_Infographic_2000x2000Product1_1.jpg?v=1785772326&width=1080
[product-sk-ii-essence-source]: https://www.sk-ii.com.sg/product/facial-treatment-essence
[product-sk-ii-essence-image]: https://images.ctfassets.net/ety4hqvfnjnx/7lTLK1ORB2XRPhdcA6jpIr/66e7e06f93260777aba475b4b7a65192/FTE-Hero-Image-SP.jpg?fm=webp&w=1200&q=90
[product-shiseido-sunscreen-source]: https://brand.shiseido.co.jp/shiseido-perfect-sun-protector-lotion-4514254148877.html?cgid=AXE_Suncare
[product-shiseido-sunscreen-image]: https://brand.shiseido.co.jp/dw/image/v2/BBSC_PRD/on/demandware.static/-/Sites-itemmaster_shiseido_jp/default/dw6d89ad68/products-02/21283/21283_J_01.jpg?sh=1000&sm=fit&sw=1000
[product-round-lab-sunscreen-source]: https://roundlab.com/products/birch-moisturizing-uv-sunscreen
[product-round-lab-sunscreen-image]: https://roundlab.com/cdn/shop/files/hf_20261013_021617_2ce362ea-2ac0-48da-885e-730aca2d6c83.png?v=1791858401&width=1946
[product-mistine-sunscreen-source]: https://mistineglobal.com/products/mistine-sunscreen-serum-broad-spectrum-spf-50
[product-mistine-sunscreen-image]: https://mistineglobal.com/cdn/shop/files/2026-3-10JZ1115_582589f1-9519-411f-825f-0c32b65edc68.jpg?v=1774424747&width=1500
[product-hada-labo-serum-source]: https://www.rohto.co.id/product/detail/hada-labo-gokujyun-premium-serum
[product-hada-labo-serum-image]: https://www.rohto.co.id/assets/uploads/product/20240212102147.png
[product-dr-wu-serum-source]: https://www.drwu.com/en/products/intensive-renewal-serum-with-mandelic-acid-18-30ml-1
[product-dr-wu-serum-image]: https://img.shoplineapp.com/media/image_clips/63b095725241990014007791/original.jpg?1672516978
[product-innisfree-sheet-mask-source]: https://us.innisfree.com/products/energy-sheet-mask
[product-innisfree-sheet-mask-image]: https://us.innisfree.com/cdn/shop/files/10IF_SM-GreenTea_Packshot_2024_1080x1080_01_768e4107-b4b8-4527-8997-3fea7aeca326.jpg?v=1760636961&width=1080
[product-kitkat-sakura-source]: https://www.kitkat-japan.com/products/kitkat-japan-sakura
[product-kitkat-sakura-image]: https://www.kitkat-japan.com/cdn/shop/files/KitKat_Japan_Sakura.jpg?v=1765020289&width=1780
[product-lancome-serum-source]: https://www.perfumenz.co.nz/products/lancome-advanced-genifique-youth-activating-serum-100ml
[product-lancome-serum-image]: https://www.perfumenz.co.nz/cdn/shop/files/lancome-advanced-genifique-100ml_1024x1024.png?v=1712635417
[product-uniqlo-u-collection-tee-source]: https://www.uniqlo.com/us/en/products/E452405-000/00
[product-uniqlo-u-collection-tee-image]: https://image.uniqlo.com/UQ/ST3/WesternCommon/imagesgoods/452405/item/goods_38_452405_3x4.jpg
[product-tim-tam-assorted-source]: https://treatsfromhome.com/products/tim-tam-variety-pack-australian-biscuits
[product-tim-tam-assorted-image]: https://treatsfromhome.com/cdn/shop/files/1_b046dc14-8967-4c20-a0cd-4bef878ba631.png?v=1750341737
[product-muji-skincare-source]: https://muji.com.au/products/moisturising-milk-moisture-oao05a3a?variant=47114979049691
[product-muji-skincare-image]: https://muji.com.au/cdn/shop/files/4550583435035_1260.jpg?v=1751435825
[product-boots-skincare-source]: https://www.unichem.co.nz/products/boots-ingredients-hyaluronic-acid-serum-30ml
[product-boots-skincare-image]: https://www.unichem.co.nz/cdn/shop/files/GXH_20029100-0.jpg?v=1765334116
[product-charles-keith-wallet-source]: https://www.charleskeith.com/us/CK6-10701370_BLACK.html
[product-charles-keith-wallet-image]: https://www.charleskeith.com/dw/image/v2/BCWJ_PRD/on/demandware.static/-/Sites-ck-products/default/dw02c2bb82/images/hi-res/2024-L2-CK6-10701370-01-1.jpg?sh=1008&sw=756
