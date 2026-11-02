import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

const root = fileURLToPath(new URL("../", import.meta.url))
  .replaceAll("\\", "/")
  .replace(/\/$/, "");
// Use an installed Chromium browser without adding a test-only app dependency.
// Set KARGO_UI_BROWSER to its executable path when it is installed elsewhere.
const browserPath =
  process.env.KARGO_UI_BROWSER ||
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].find(existsSync);
const execute = promisify(execFile);
let server, testDirectory;
const browserTests = String.raw`
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Modal from '/src/features/batches/NewBatchModal.tsx';
import '/src/index.css';
window.IS_REACT_ACT_ENVIRONMENT = true;
const results = [];
function check(condition, message) { if (!condition) throw new Error(message); results.push(message); }
const click = async element => { await act(async () => element.click()); };
const fill = async (element, value) => { await act(async () => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}); };
const choose = async (element, file) => { await act(async () => {
  Object.defineProperty(element, 'files', { value: Array.isArray(file) ? file : [file], configurable: true });
  element.dispatchEvent(new Event('change', { bubbles: true }));
}); };
const photo = () => new File([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM1sAAAAASUVORK5CYII='), c => c.charCodeAt(0))], 'photo.png', { type: 'image/png' });
const findButton = text => Array.from(document.querySelectorAll('button')).find(button => button.textContent === text);
let container, root;
async function mount() {
  if (root) await act(async () => root.unmount());
  container?.remove();
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container); window.created = null; window.calls = [];
  await act(async () => root.render(React.createElement(Modal, { onCreate: batch => window.created = batch, onClose: () => {} })));
  await fill(document.querySelector('input[placeholder^="e.g. Japan"]'), 'Photo batch');
  await fill(document.querySelector('input[placeholder="Product name"]'), 'Coffee');
  await fill(document.querySelector('input[inputmode="decimal"]'), '100');
  await fill(document.querySelector('input[placeholder="qty"]'), '2');
  for (const date of document.querySelectorAll('input[type="date"]')) await fill(date, '2026-11-01');
}
const cover = () => document.querySelector('input[type="file"]');
const item = index => document.querySelectorAll('.batch-product-image-row input')[index];
const submit = () => click(findButton('Create Batch'));
async function run() {
  await mount();
  check(item(0).closest('label').textContent.includes('Upload item photo (required)'), 'Item photo visibly says required');
  check(!document.querySelector('img'), 'Empty modal has no fake photo fallback');
  await submit();
  check(document.querySelector('#batch-cover-error')?.textContent.includes('Add a cover photo for your batch'), 'Cover error appears inline');
  check(document.querySelector('#batch-product-0-image-error')?.textContent.includes('Add a photo for Coffee'), 'Named product error appears inline');
  check(document.activeElement === cover(), 'First missing cover receives focus');
  const labelRect = cover().closest('label').getBoundingClientRect();
  check(labelRect.top >= 0 && labelRect.bottom <= innerHeight, 'Missing cover scrolls into view');
  check(window.calls.length === 0 && !window.created, 'Missing photos block API and creation callback');
  await choose(cover(), new File(['invalid'], 'text.txt', { type: 'text/plain' }));
  check(document.body.textContent.includes('Choose a non-empty JPEG, PNG, WebP, or GIF image that is 5 MB or smaller.'), 'Cover rejects invalid file type');
  await choose(cover(), new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }));
  check(!!document.querySelector('#batch-cover-error'), 'Cover rejects images larger than 5 MB');
  await choose(cover(), photo());
  check(!document.querySelector('#batch-cover-error'), 'Valid cover selection clears missing-cover error');
  await submit();
  check(document.activeElement === item(0), 'Missing product receives focus after cover is selected');
  const itemRect = item(0).closest('label').getBoundingClientRect();
  check(itemRect.top >= 0 && itemRect.bottom <= innerHeight, 'Missing product scrolls into view');
  await choose(item(0), new File(['invalid'], 'text.txt', { type: 'text/plain' }));
  check(!!document.querySelector('#batch-product-0-image-error') && !window.created, 'Product rejects invalid type and stays required');
  await choose(item(0), new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }));
  check(!!document.querySelector('#batch-product-0-image-error'), 'Product rejects images larger than 5 MB');
  await choose(item(0), new File([new Uint8Array(5 * 1024 * 1024)], 'limit.png', { type: 'image/png' }));
  check(!document.querySelector('#batch-product-0-image-error'), 'Product accepts the 5 MB boundary');
  await choose(item(0), photo());
  await click(findButton('+ Add Item'));
  await submit();
  check(window.created?.products.length === 1, 'Incomplete extra row does not require an image');
  check(window.created.galleryImages.length === 0, 'Gallery remains optional');
  check(window.created.coverImage.startsWith(location.search.includes('live') ? 'https://uploads.test/' : 'blob:'), 'Created cover uses upload URL or selected preview');
  check(window.created.products.every(product => typeof product.imageUrl === 'string' && product.imageUrl.length > 0), 'Every created product has a nonempty image URL');
  if (location.search.includes('live')) {
    check(window.calls[0].coverFile instanceof File && window.calls[0].products.every(product => product.imageFile instanceof File), 'Live submission receives all required image files');
    check(window.created.products[0].imageUrl === 'https://uploads.test/product-0.png', 'Live creation uses the uploaded product URL');
  } else {
    check((await (await fetch(window.created.coverImage)).blob()).size > 0 && (await (await fetch(window.created.products[0].imageUrl)).blob()).size > 0, 'Demo preview URLs resolve to selected files');
  }
  await mount();
  await choose(cover(), photo());
  await choose(item(0), photo());
  await click(findButton('+ Add Item'));
  const names = document.querySelectorAll('input[placeholder="Product name"]');
  await fill(names[1], 'Tea');
  await fill(document.querySelectorAll('input[inputmode="decimal"]')[2], '50');
  await fill(document.querySelectorAll('input[placeholder="qty"]')[1], '3');
  await submit();
  check(document.querySelector('#batch-product-1-image-error')?.textContent.includes('Add a photo for Tea'), 'Each valid product independently requires a photo');
  check(document.activeElement === item(1) && !window.created && !window.calls.length, 'First missing product focus follows product order and blocks publishing');
  await click(document.querySelector('button[aria-label="Remove item 1"]'));
  await submit();
  check(document.activeElement === item(0) && document.querySelector('#batch-product-0-image-error')?.textContent.includes('Tea'), 'Removing rows preserves error and focus alignment');
  await choose(item(0), photo());
  await submit();
  check(window.created?.products[0].name === 'Tea' && !!window.created.products[0].imageUrl, 'Creation succeeds after the remaining required photo is selected');

  for (const slot of ['cover', 'product', 'gallery']) {
    await mount();
    await submit();
    const input = slot === 'cover' ? cover() : slot === 'product' ? item(0) : document.querySelector('input[multiple]');
    for (const invalid of [
      new File(['<svg/>'], 'photo.svg', { type: 'image/svg+xml' }),
      new File([], 'empty.png', { type: 'image/png' }),
      new File(['bitmap'], 'photo.bmp', { type: 'image/bmp' }),
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }),
    ]) {
      await choose(input, slot === 'gallery' ? [photo(), invalid] : invalid);
      check(document.body.textContent.includes('non-empty JPEG, PNG, WebP, or GIF'), slot + ' rejects ' + invalid.type + ' size ' + invalid.size);
      check(!window.created && !window.calls.length, slot + ' rejection cannot submit');
      if (slot === 'gallery') check(!document.querySelector('.batch-gallery-upload__preview'), 'Mixed invalid gallery selection adds no photos');
      else check(!!document.querySelector(slot === 'cover' ? '#batch-cover-error' : '#batch-product-0-image-error'), slot + ' invalid image does not satisfy required field');
    }
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/gif']) {
      await choose(input, new File([photo()], 'photo', { type }));
      check(!document.body.textContent.includes('Choose a non-empty') && !document.body.textContent.includes('Choose non-empty'), slot + ' accepts ' + type);
    }
    if (slot === 'product') check(input.closest('label').textContent.includes('Change item photo (required)'), 'Required label remains visible after selection');
  }

  for (const field of ['name', 'basePrice', 'markup', 'qty', 'limit', 'waitlistLimit', 'sellingUnit', 'piecesPerBox', 'image']) {
    await mount();
    await choose(cover(), photo());
    await choose(item(0), photo());
    await click(findButton('+ Add Item'));
    const row = item(1).closest('.batch-product-image-row').parentElement;
    if (field === 'image') await choose(item(1), photo());
    else if (field === 'sellingUnit') await act(async () => {
      const select = row.querySelector('select');
      select.value = 'box';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    else {
      const selectors = { name: 'input[placeholder="Product name"]', basePrice: 'input[inputmode="decimal"]', markup: 'input[inputmode="decimal"]', qty: 'input[placeholder="qty"]', limit: 'input[placeholder="optional"]', waitlistLimit: 'input[min="0"]', piecesPerBox: 'input[placeholder="e.g. 12"]' };
      if (field === 'piecesPerBox') await act(async () => {
        row.querySelector('select').value = 'box';
        row.querySelector('select').dispatchEvent(new Event('change', { bubbles: true }));
      });
      const input = field === 'markup' ? row.querySelectorAll(selectors[field])[1] : row.querySelector(selectors[field]);
      await fill(input, field === 'name' ? 'Unfinished' : '1');
    }
    await submit();
    check(!window.created && !window.calls.length, 'Row with only ' + field + ' is never silently dropped');
    if (field !== 'image') {
      check(document.activeElement === item(1), 'Partially filled ' + field + ' row receives missing-photo focus');
      check(!!document.querySelector('#batch-product-1-image-error'), 'Partially filled ' + field + ' row has inline photo error');
    } else check(document.body.textContent.includes('Complete every item'), 'Photo-only row must be completed');
  }

  await mount();
  await choose(cover(), photo());
  await choose(item(0), photo());
  await click(findButton('+ Add Item'));
  const row = item(1).closest('.batch-product-image-row').parentElement;
  await fill(row.querySelector('input[placeholder="Product name"]'), 'Tea');
  await choose(item(1), photo());
  await submit();
  check(!window.created && !window.calls.length && document.activeElement === row.querySelector('input[inputmode="decimal"]'), 'Incomplete row with photo blocks creation and focuses missing price');
  await fill(row.querySelector('input[inputmode="decimal"]'), '50');
  await submit();
  check(!window.created && !window.calls.length && document.activeElement === row.querySelector('input[placeholder="qty"]'), 'Incomplete row with photo focuses missing quantity');
  await fill(row.querySelector('input[placeholder="qty"]'), '3');
  await submit();
  check(window.created?.products.length === 2 && window.created.products[1].name === 'Tea', 'Completing the row publishes every entered product');

  await mount();
  await choose(cover(), photo());
  await choose(item(0), photo());
  await click(findButton('+ Add Item'));
  await fill(document.querySelectorAll('input[placeholder="Product name"]')[1], '   ');
  await submit();
  check(window.created?.products.length === 1, 'Whitespace-only extra row with default settings is ignored');
  check(document.body.textContent.includes('Empty extra rows are ignored.'), 'Blank-row behavior is explained visibly');

  report({ ok: true, results });
}
function report(result) {
  const output = document.createElement('pre');
  output.id = 'result'; output.textContent = JSON.stringify(result);
  document.body.replaceChildren(output);
}
run().catch(error => report({ ok: false, error: error.stack, results }));
`;

before(async () => {
  if (!browserPath) return;
  testDirectory = await mkdtemp(path.join(os.tmpdir(), "kargo-new-batch-ui-"));
  server = await createServer({
    root,
    configFile: false,
    envDir: false,
    mode: "test",
    cacheDir: path.join(testDirectory, "vite-cache"),
    plugins: [
      react(),
      {
        name: "isolated-new-batch-ui",
        enforce: "pre",
        resolveId(id) {
          if (
            ["@/services", "@/lib/supabase", "@/components/shared", "virtual:batch-check"].includes(
              id,
            )
          )
            return "\0" + id;
        },
        load(id) {
          if (id === "\0@/lib/supabase")
            return `export const isSupabaseConfigured = location.search.includes('live'); export const supabase = null; export function requireSupabase() { throw new Error('UI tests must never access the backend'); }`;
          if (id === "\0@/services")
            return `export const kargoApi = { createBatch: async data => { window.calls.push(data); return { coverImage: 'https://uploads.test/cover.png', galleryImages: [], productImages: data.products.map((_, index) => 'https://uploads.test/product-' + index + '.png') }; } };`;
          if (id === "\0@/components/shared")
            return `export { default as Modal } from '/src/components/shared/Modal.tsx'; export { default as PrimaryBtn } from '/src/components/shared/PrimaryBtn.tsx'; export { default as SecondaryBtn } from '/src/components/shared/SecondaryBtn.tsx';`;
          if (id === "\0virtual:batch-check") return browserTests;
        },
        configureServer(vite) {
          vite.middlewares.use(async (request, response, next) => {
            if (!request.url.startsWith("/__batch_check")) return next();
            response.setHeader("Content-Type", "text/html");
            response.end(
              await vite.transformIndexHtml(
                request.url,
                '<!doctype html><html><body><script>addEventListener("error", event => { const result = document.createElement("pre"); result.id = "result"; result.textContent = JSON.stringify({ok:false,error:event.message}); document.body.append(result); });</script><script type="module" src="/@id/virtual:batch-check"></script></body></html>',
              ),
            );
          });
        },
      },
    ],
    resolve: {
      alias: [
        {
          find: /^@\/(?!services$|lib\/supabase$|components\/shared$)(.*)$/,
          replacement: `${root}/src/$1`,
        },
      ],
    },
    server: { host: "127.0.0.1", port: 0, hmr: false, ws: false, watch: null },
  });
  await server.listen();
});
after(async () => {
  await server?.close();
  if (testDirectory) {
    assert.equal(path.dirname(path.resolve(testDirectory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(testDirectory).startsWith("kargo-new-batch-ui-"));
    await rm(testDirectory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

for (const mode of ["demo", "live"]) {
  test(
    `new batch photo and product-row behavior (${mode})`,
    {
      skip: !browserPath && "Set KARGO_UI_BROWSER to an installed Chromium browser",
      timeout: 60000,
    },
    async () => {
      const profile = path.join(testDirectory, mode);
      const address = server.httpServer.address();
      const { stdout, stderr } = await execute(
        browserPath,
        [
          "--headless",
          "--disable-gpu",
          "--no-first-run",
          "--no-default-browser-check",
          "--disable-background-networking",
          "--disable-extensions",
          `--user-data-dir=${profile}`,
          "--dump-dom",
          "--virtual-time-budget=12000",
          `http://127.0.0.1:${address.port}/__batch_check?${mode}`,
        ],
        { windowsHide: true, timeout: 45000, maxBuffer: 2 * 1024 * 1024 },
      );
      const match = stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
      assert.ok(
        match,
        `Browser did not report a result: ${stdout.slice(0, 1000)} ${stderr.slice(-1000)}`,
      );
      const result = JSON.parse(
        match[1].replaceAll("&amp;", "&").replaceAll("&gt;", ">").replaceAll("&lt;", "<"),
      );
      assert.equal(result.ok, true, result.error);
      assert.ok(result.results.length > 100, "All focused browser assertions ran");
    },
  );
}
