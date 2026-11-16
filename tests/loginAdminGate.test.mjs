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

// Regression coverage for the admin-console sign-in gate. The original bug:
// `submit` was memoized without `adminMode` in its dependency list, so filling
// the email/password fields before opening "Admin access" (browser autofill)
// left the handler with `adminMode: false` and a non-admin signed in.
const browserTests = String.raw`
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Login from '/src/features/auth/Login.tsx';
import '/src/index.css';
window.IS_REACT_ACT_ENVIRONMENT = true;
const results = [];
function check(condition, message) { if (!condition) throw new Error(message); results.push(message); }
const click = async element => { await act(async () => element.click()); };
const waitFor = async (predicate, message) => {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (predicate()) return;
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  }
  throw new Error('Timed out waiting for: ' + message);
};
const fill = async (element, value) => { await act(async () => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}); };
const textButton = text => Array.from(document.querySelectorAll('button')).find(button => button.textContent === text);
const emailInput = () => document.querySelector('input[type="email"]');
const passwordInput = () => document.querySelector('input[type="password"]');
let container, root, signedIn;
async function mount() {
  if (root) await act(async () => root.unmount());
  container?.remove();
  signedIn = null;
  window.calls = [];
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(React.createElement(Login, {
    onSignUp: () => {},
    onAdminSignUp: () => {},
    onSuccess: user => { signedIn = user; },
  })));
}
async function openAdminConsole() {
  await click(document.querySelector('button[aria-label="Admin sign in or sign up"]'));
  await click(textButton('Admin sign in'));
  check(document.querySelector('h1')?.textContent === 'KARGO Admin console', 'Admin console mode opens');
}
async function submit() {
  await click(document.querySelector('form button.kargo-primary'));
}
async function run() {
  // 1. The reported bug: credentials filled before entering admin mode.
  await mount();
  await fill(emailInput(), 'buyer@kargo.test');
  await fill(passwordInput(), 'secret123');
  await openAdminConsole();
  await submit();
  await waitFor(() => document.body.textContent.includes('This account does not have approved admin access.'), 'non-admin rejection before admin mode');
  check(!signedIn, 'Non-admin seeded before admin mode cannot sign in');
  check(document.body.textContent.includes('This account does not have approved admin access.'), 'Non-admin sees the approved-access error');
  check(window.calls.filter(call => call === 'signOut').length === 1, 'Rejected attempt signs the Supabase session out');

  // 2. Credentials filled after entering admin mode.
  await mount();
  await openAdminConsole();
  await fill(emailInput(), 'buyer@kargo.test');
  await fill(passwordInput(), 'secret123');
  await submit();
  await waitFor(() => document.body.textContent.includes('This account does not have approved admin access.'), 'non-admin rejection after admin mode');
  check(!signedIn, 'Non-admin seeded after admin mode cannot sign in');

  // 3. An approved admin still gets through the admin console.
  await mount();
  await fill(emailInput(), 'admin@kargo.test');
  await fill(passwordInput(), 'secret123');
  await openAdminConsole();
  await submit();
  await waitFor(() => signedIn, 'approved admin sign-in');
  check(signedIn?.adminEnabled === true, 'Approved admin signs in through the admin console');
  check(window.calls.includes('signOut') === false, 'Admin sign-in is not signed out');

  // 4. Regular sign-in is unaffected for non-admins.
  await mount();
  await fill(emailInput(), 'buyer@kargo.test');
  await fill(passwordInput(), 'secret123');
  await submit();
  await waitFor(() => signedIn, 'regular non-admin sign-in');
  check(signedIn?.adminEnabled === false, 'Non-admin still signs in through the regular form');

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
  testDirectory = await mkdtemp(path.join(os.tmpdir(), "kargo-login-admin-gate-"));
  server = await createServer({
    root,
    configFile: false,
    envDir: false,
    mode: "test",
    cacheDir: path.join(testDirectory, "vite-cache"),
    plugins: [
      react(),
      {
        name: "isolated-login-admin-gate",
        enforce: "pre",
        resolveId(id) {
          if (
            ["@/services", "@/lib/supabase", "@/components/shared", "virtual:login-check"].includes(
              id,
            )
          )
            return "\0" + id;
        },
        load(id) {
          if (id === "\0@/lib/supabase")
            return `export const isSupabaseConfigured = true; export const supabase = null; export function requireSupabase() { throw new Error('UI tests must never access the backend'); }`;
          if (id === "\0@/services")
            return `export const kargoApi = {
              signIn: async email => { window.calls.push('signIn:' + email); const admin = email.startsWith('admin@'); return { name: admin ? 'KARGO Admin' : 'Buyer', email, role: admin ? 'Admin' : 'Buyer', adminEnabled: admin }; },
              signOut: async () => { window.calls.push('signOut'); },
              resendConfirmation: async () => {},
              requestPasswordReset: async () => {},
            };`;
          if (id === "\0@/components/shared")
            return `export { default as PrimaryBtn } from '/src/components/shared/PrimaryBtn.tsx';`;
          if (id === "\0virtual:login-check") return browserTests;
        },
        configureServer(vite) {
          vite.middlewares.use(async (request, response, next) => {
            if (!request.url.startsWith("/__login_check")) return next();
            response.setHeader("Content-Type", "text/html");
            response.end(
              await vite.transformIndexHtml(
                request.url,
                '<!doctype html><html><body><script>addEventListener("error", event => { const result = document.createElement("pre"); result.id = "result"; result.textContent = JSON.stringify({ok:false,error:event.message}); document.body.append(result); });</script><script type="module" src="/@id/virtual:login-check"></script></body></html>',
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
    assert.ok(path.basename(testDirectory).startsWith("kargo-login-admin-gate-"));
    await rm(testDirectory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

test(
  "admin console rejects non-admins even when credentials were prefilled",
  {
    skip: !browserPath && "Set KARGO_UI_BROWSER to an installed Chromium browser",
    timeout: 60000,
  },
  async () => {
    const profile = path.join(testDirectory, "chrome");
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
        `http://127.0.0.1:${address.port}/__login_check`,
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
    assert.equal(result.results.length, 10);
  },
);
