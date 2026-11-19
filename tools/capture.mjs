// Takes the entry's screenshots from the real app: serves app/ with serve.ts, drives headless Edge over the
// DevTools protocol (no packages), seeds a sample progress in localStorage, opens each view and saves a JPEG.
// External hosts are mapped to NOTFOUND, as with the network off; any request that is not to localhost fails the run.
// Usage: node tools/capture.mjs --profile <dir outside the repo> [--edge <path to msedge.exe>]

import { spawn } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const profile = arg('--profile');
if (!profile) throw new Error('--profile <dir> is required (keep it outside the repository)');
const edge = arg('--edge', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
const PORT = Number(arg("--port", "8097"));
const DEBUG_PORT = Number(arg("--debug-port", "9447"));
const ORIGIN = `http://localhost:${PORT}`;
const MAX_BYTES = 256 * 1024;

const sample = {
  earned: { 2: '', 3: '', 4: '', 8: '', 16: '', 20: '', 21: '', 24: '', 33: '', 35: '', 41: '', 39: '' },
  counts: { 14: 38, 15: 87, 17: 12, 25: 3, 28: 9, 31: 64, 40: 3, 43: 5, 52: 90000 },
  prefs: { spoiler: 'story' },
};

const shots = [
  // Cover: the list from the top (platinum, then the story trophies the spoiler setting hides) beside a cited guide.
  { file: '1-checklist-guide.jpg', hash: '#/trophy/28', then: 'document.getElementById("rows").scrollTop = 0' },
  { file: '2-roadmap.jpg', hash: '#/roadmap', then: 'location.hash = "#/trophy/25"' },
  { file: '3-missables.jpg', hash: '#/missables', then: 'location.hash = "#/trophy/40"' },
  // The spoiler setting at work: Story filter, unearned story trophies concealed, one guide opened on request.
  { file: '4-spoilers-story.jpg', hash: '#/trophy/9', then: '[...document.querySelectorAll(".fchip")].find(b => b.textContent.startsWith("Story")).click(); [...document.querySelectorAll("#detail button")].find(b => b.textContent.startsWith("Show the guide")).click()' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, what, tries = 50) {
  for (let i = 0; i < tries; i++) {
    try {
      const v = await fn();
      if (v) return v;
    } catch {}
    await sleep(200);
  }
  throw new Error(`timed out waiting for ${what}`);
}

function cdpClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let next = 1;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method) {
      for (const l of listeners) l(msg);
    }
  };
  const ready = new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  return {
    ready,
    send(method, params = {}) {
      const id = next++;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    on(fn) { listeners.push(fn); },
    close() { ws.close(); },
  };
}

async function portAnswers(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(800) });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  // Never attach to someone else's browser or server: both ports must be free before we start our own.
  if (await portAnswers(`http://127.0.0.1:${DEBUG_PORT}/json/version`)) throw new Error(`debug port ${DEBUG_PORT} is already in use`);
  if (await portAnswers(`${ORIGIN}/`)) throw new Error(`port ${PORT} is already in use`);
  const server = spawn(process.execPath, ['serve.ts', '--port', String(PORT)], { cwd: root, stdio: 'ignore' });
  rmSync(profile, { recursive: true, force: true });
  mkdirSync(profile, { recursive: true });
  const browser = spawn(edge, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profile}`,
    '--window-size=1280,800',
    '--no-first-run',
    '--disable-extensions',
    '--disable-sync',
    '--disable-background-networking',
    '--disable-component-update',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost',
    'about:blank',
  ], { stdio: 'ignore' });

  const outside = [];
  const errors = [];
  try {
    await waitFor(() => fetch(`${ORIGIN}/index.html`).then((r) => r.ok), 'serve.ts');
    const targets = await waitFor(() => fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`).then((r) => r.json()), 'Edge DevTools');
    const page = targets.find((t) => t.type === 'page' && t.url === 'about:blank');
    if (!page) throw new Error('our about:blank page was not found on the debug port');
    const cdp = cdpClient(page.webSocketDebuggerUrl);
    await cdp.ready;
    cdp.on((msg) => {
      if (msg.method === 'Network.requestWillBeSent') {
        const url = msg.params.request.url;
        if (!/^(http:\/\/localhost:\d+\/|blob:|data:|about:)/.test(url)) outside.push(url);
      }
      if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.text);
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(JSON.stringify(msg.params.args));
    });
    await cdp.send('Page.enable');
    await cdp.send('Network.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });

    const outDir = join(root, 'screenshots');
    for (const f of readdirSync(outDir)) rmSync(join(outDir, f));
    await cdp.send('Page.navigate', { url: `${ORIGIN}/` });
    await sleep(800);
    await cdp.send('Runtime.evaluate', { expression: `localStorage.setItem('vi-trophy-atlas/v1', ${JSON.stringify(JSON.stringify(sample))})` });

    for (const shot of shots) {
      await cdp.send('Page.navigate', { url: 'about:blank' });
      await sleep(300);
      await cdp.send('Page.navigate', { url: `${ORIGIN}/${shot.hash}` });
      await sleep(300);
      await waitFor(async () => (await cdp.send('Runtime.evaluate', { expression: 'document.querySelectorAll(".row").length', returnByValue: true })).result.value > 0, 'app render');
      if (shot.then) await cdp.send('Runtime.evaluate', { expression: shot.then });
      await sleep(500);
      let quality = 86;
      let bytes;
      for (;;) {
        const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality });
        bytes = Buffer.from(data, 'base64');
        if (bytes.length <= MAX_BYTES || quality <= 50) break;
        quality -= 6;
      }
      const file = join(outDir, shot.file);
      writeFileSync(file, bytes);
      console.log(`${shot.file}: ${statSync(file).size} bytes, quality ${quality}`);
    }
    await cdp.send('Browser.close').catch(() => {});
    cdp.close();
  } finally {
    browser.kill();
    server.kill();
  }
  if (outside.length) throw new Error(`requests left localhost: ${outside.join(', ')}`);
  if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`);
  console.log('no request left localhost; no page errors');
}

await main();
