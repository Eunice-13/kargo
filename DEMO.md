# KARGO — Demo Guide

Everything a presenter needs to run, show, and troubleshoot the KARGO demo.
For architecture and code details see `README.md`, `ARCHITECTURE.md`, and
`WALKTHROUGH.md`.

---

## 1. Run the demo

### Option A — Development server (fastest, live edits)

```bash
npm install
npm run dev
```

Open **http://localhost:8443**.

### Option B — Built copy (use this for the flash drive)

```bash
npm run build      # writes dist/
npm run preview    # serves dist/ on http://localhost:8443
```

Or serve the folder with any static server, for example:

```bash
python -m http.server 8443 --directory dist
# or
npx serve dist -l 8443
```

> **Important:** copy the **whole `dist/` folder**, including `dist/media/`.
> Do **not** double-click `dist/index.html`. Opening it as `file://` hides the
> app because assets use root-absolute paths (`/assets/…`, `/media/…`). Always
> serve it over `http://localhost`.
> Ports are fixed (`strictPort`), so stop any other server on 8443 first.

---

## 2. Who to sign in as

### Demo mode (no Supabase, in-memory seed data)

Any valid-looking email works, with the password:

```text
Password: password123
```

Fast entry points:

| URL | What it shows |
|---|---|
| `http://localhost:8443/?preview=original` | Buyer **and** seller workspace (Alex Jordan) |
| `http://localhost:8443/?preview=admin` | Admin console (development builds only) |
| `http://localhost:8443/?preview=admin-invite` | Admin invitation prompt for a buyer |

### Live Supabase data (when `.env.local` is configured and the DB is seeded)

Password for every seeded account:

```text
KargoDemo123!
```

| Role | Emails |
|---|---|
| Buyer | `trisha@kargo.demo`, `carlo@kargo.demo`, … |
| Seller | `maria@kargo.demo`, `ana@kargo.demo`, `jade@kargo.demo`, … |

Re-seed with `node scripts/seed-supabase.mjs` (add `--reset` to wipe first).
The seeding script needs `SUPABASE_URL` + `SUPABASE_SECRET_KEY` in `.env.local`.

---

## 3. Suggested demo flow (about 6 minutes)

**Buyer**
1. Home → open a batch (e.g. *Orchard Road Luxury — March 2027*).
2. Point out the **claim stock per item** (`5 left`, `1 left`, `Sold out`).
3. Claim an item → pick a payment method → reservation timer starts.
4. Show **My Claims** → pending payment card → upload proof.
5. Show **Group Order** on a group-enabled batch and the **combined delivery** request.

**Seller**
6. Open the batch → *Items in this Batch* (lock/unlock, waitlist cap, add item).
7. **Payments** → review a submitted proof → approve/reject.
8. **Orders / Fulfillment** → move an order across the board.

**Admin** (dev only)
9. Dashboard KPIs, batch moderation, payment audit, user list, audit trail.

**Nice touches to mention**
- Share links (`?batch=<id>`) and `?tab=orders` email deep links.
- The address bar always matches what is on screen (no stale batch id).
- Waitlist auto-claims stock when a seller frees it.

---

## 4. Important notes

### Images are bundled, not fetched
- `public/media/` holds **254 local copies (~48 MB)** of every batch, gallery,
  product, and category image.
- `src/data/mediaManifest.ts` maps original URLs (including Supabase Storage
  paths) to those local files; `src/lib/media.ts` resolves them.
- This is why photos still show **offline** and **without Supabase keys**, and
  why the Orchard Road cover works even though `sethlui.com` blocks hotlinking.
- **After a seller uploads new photos, re-run `npm run bundle:media` and rebuild.**
  Otherwise the new photo falls back to category artwork.
- `dist/` is roughly 100 MB because of the media. Copy it fully; do not trim
  `dist/media/`.

### Offline / no-key behaviour
- Without `VITE_SUPABASE_URL` + key at build time, the app starts in **Demo
  Mode** with seed data and bundled images. No account is required.
- With keys, the app talks to Supabase and needs internet. Images still come
  from the bundle, so they load either way.

### Admin
- `?preview=admin` and `?preview=admin-invite` are **development-only**.
- A production build requires a real account with `admin_enabled`.

### Things that genuinely need a backend
- Signup confirmation and password-reset emails (Supabase Auth + SMTP/Nylas).
- Real payment processing — payment proofs are uploaded screenshots.
- Seller BIR verification uploads and admin audit writes.

### Known small gaps
- Two third-party product photos failed to download during bundling
  (`zerrin.com`, `vietnamesecoffeeco.com`); those items show category artwork.
- Reservation countdowns use the real clock, so demo reservations can expire
  while you talk. Re-claim if a timer runs out.
- Seed batch 33 has no dedicated cover in the id list and falls back to category
  art by design.

---

## 5. Pre-demo checklist

- [ ] Port 8443 is free.
- [ ] `npm run build` completed without errors (chunk-size warnings are fine).
- [ ] `dist/media/` exists and contains ~254 files.
- [ ] Opened `http://localhost:8443` (not `file://`).
- [ ] Signed in once to confirm the right workspace loads.
- [ ] Hard-refresh (Ctrl+F5) after replacing files on the flash drive.
- [ ] If demoing offline, unplug the network and reload once to confirm.

---

## 6. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Blank page / no styling | Opened `index.html` directly | Serve `dist/` over http |
| Broken or missing photos | Only part of `dist/` copied | Copy `dist/media/` too |
| Login says “Incorrect email or password” in demo mode | Password is not `password123` | Use `password123` with any valid email |
| Admin tab missing | Production build, or no admin account | Demo admin via `?preview=admin` (dev server only) |
| Address bar keeps a batch id | Old cached build | Rebuild and hard-refresh |
| Port already in use | Another dev/preview server | Stop it; the app requires 8443 |
| Password-reset email never arrives | No SMTP configured | Expected offline; skip that step |
| New seller photo not showing | Media bundle not refreshed | `npm run bundle:media` then `npm run build` |
