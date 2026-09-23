import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdir, copyFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import http from 'node:http';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
let browser, fixture, fixtureOrigin, unavailable = false, missingIcon = false, slowDocument = false;
const dist = path.resolve('dist');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };

before(async () => {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  await mkdir('artifacts/loading', { recursive: true });
  fixture = http.createServer(async (req, res) => {
    if (unavailable) { res.writeHead(503); return res.end('Temporarily unavailable'); }
    if (missingIcon && req.url.endsWith('/icons/icon-512.png')) { res.writeHead(404); return res.end('Missing icon'); }
    if (req.url === '/helen') { res.writeHead(301, { Location: '/helen/' }); return res.end(); }
    try {
      const url = new URL(req.url, 'http://localhost');
      const relative = decodeURIComponent(url.pathname.replace(/^\/helen\//, '/'));
      const filename = path.join(dist, relative === '/' ? 'index.html' : relative);
      const content = await readFile(filename);
      if (slowDocument && path.extname(filename) === '.html') await new Promise(resolve => setTimeout(resolve, 3000));
      res.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream' });
      res.end(content);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve));
  fixtureOrigin = `http://127.0.0.1:${fixture.address().port}`;
});
after(async () => { await browser?.close(); await new Promise(resolve => fixture?.close(resolve)); });

async function withPage(fn, options = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', ...options });
  const page = await context.newPage();
  try { await fn(page, context); } finally { await context.close(); }
}
async function assertStyled(page) {
  assert.equal(await page.locator('.main-quest').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(52, 78, 65)');
  assert.equal(await page.locator('.character').evaluate(el => getComputedStyle(el).borderRadius), '18px');
  assert.equal(await page.locator('#task-0').count(), 1, 'JavaScript initialized the task editor');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
}

test('all documented static resources have correct paths, status and MIME types', async () => {
  for (const resource of ['index.html', 'styles.css', 'app.js', 'state.js', 'manifest.webmanifest', 'icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'sw.js']) {
    const response = await fetch(`http://localhost:4173/${resource}`);
    assert.equal(response.status, 200, resource);
    assert.equal(response.headers.get('content-type'), mime[path.extname(resource)], resource);
  }
});

test('isolated index.html keeps the exact CSS and works without sibling files', async () => withPage(async page => {
  await mkdir('artifacts/loading/isolated', { recursive: true });
  await copyFile('dist/index.html', 'artifacts/loading/isolated/index.html');
  await page.goto(pathToFileURL(path.resolve('artifacts/loading/isolated/index.html')).href);
  await page.screenshot({ path: 'artifacts/loading/isolated-mobile.png', fullPage: true });
  await assertStyled(page);
  await page.locator('#task-0').fill('本地文件显示验证');
  await page.locator('.task-check').first().check();
}));

test('direct local file works without ES module CORS errors', async () => withPage(async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(path.join(dist, 'index.html')).href);
  await assertStyled(page);
  assert.deepEqual(errors, []);
}));

test('missing external CSS/JS cannot turn the homepage into plain text', async () => withPage(async (page, context) => {
  await context.route(/\/(styles\.css|app\.js|state\.js)$/, route => route.fulfill({ status: 404, body: 'Not found' }));
  await page.goto('http://localhost:4173');
  await assertStyled(page);
}));

test('missing embedded CSS produces a visible diagnostic independent of that CSS', async () => withPage(async (page, context) => {
  const html = (await readFile('dist/index.html', 'utf8')).replace(/<style id="app-styles">[\s\S]*?<\/style>/, '');
  await context.route('**/index.html', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('http://localhost:4173/index.html');
  await page.locator('#load-warning').waitFor({ state: 'visible', timeout: 2000 });
  assert.match(await page.locator('#load-warning').innerText(), /CSS/);
}));

test('missing app script produces a visible JS diagnostic', async () => withPage(async (page, context) => {
  const html = (await readFile('dist/index.html', 'utf8')).replace(/<script id="app-bundle">[\s\S]*?<\/script>/, '');
  await context.route('**/index.html', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('http://localhost:4173/index.html');
  await page.locator('#load-warning').waitFor({ state: 'visible', timeout: 2000 });
  assert.match(await page.locator('#load-warning').innerText(), /JS/);
}));

test('browser disabling scripts leaves an explicit visible notice', async () => withPage(async page => {
  await page.goto('http://localhost:4173');
  assert.equal(await page.locator('#load-warning').isVisible(), true);
  assert.match(await page.locator('#load-warning').innerText(), /JavaScript/);
}, { javaScriptEnabled: false }));

test('subdirectory deployment resolves manifest, icons and worker under the same path', async () => withPage(async page => {
  await page.goto(`${fixtureOrigin}/helen`);
  assert.equal(page.url(), `${fixtureOrigin}/helen/`);
  await assertStyled(page);
  const manifestURL = await page.locator('link[rel=manifest]').evaluate(el => el.href);
  assert.equal(manifestURL, `${fixtureOrigin}/helen/manifest.webmanifest`);
  const response = await fetch(manifestURL);
  assert.equal(response.status, 200);
  const manifest = await response.json();
  assert.equal(new URL(manifest.start_url, manifestURL).href, `${fixtureOrigin}/helen/`);
  for (const icon of manifest.icons) {
    const result = await fetch(new URL(icon.src, manifestURL));
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('content-type'), 'image/png');
    assert.deepEqual([...new Uint8Array(await result.arrayBuffer()).slice(0, 8)], [137,80,78,71,13,10,26,10]);
  }
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.ready).scope), `${fixtureOrigin}/helen/`);
}, { serviceWorkers: 'allow' }));

test('PWA manifest passes browser validation and installed resources survive 503 and offline', async () => withPage(async (page, context) => {
  await page.goto(`${fixtureOrigin}/`);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  const cdp = await context.newCDPSession(page);
  const result = await cdp.send('Page.getAppManifest');
  assert.deepEqual(result.errors, []);
  assert.equal(JSON.parse(result.data).display, 'standalone');
  await page.locator('#task-0').fill('原有存档必须保留');
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  unavailable = true;
  try {
    await page.reload();
    await assertStyled(page);
    assert.equal(await page.locator('#task-0').inputValue(), '原有存档必须保留');
  } finally { unavailable = false; }
  await context.setOffline(true);
  await page.reload();
  await assertStyled(page);
  assert.equal(await page.locator('#task-0').inputValue(), '原有存档必须保留');
}, { serviceWorkers: 'allow' }));

test('missing install icon reports PWA cache installation failure without hiding the app', async () => withPage(async page => {
  missingIcon = true;
  try {
    await page.goto(`${fixtureOrigin}/`);
    await assertStyled(page);
    await page.locator('#load-warning').waitFor({ state: 'visible', timeout: 5000 });
    assert.match(await page.locator('#load-warning').innerText(), /PWA/);
    assert.match(await page.locator('#load-warning').innerText(), /离线.*失败/);
  } finally { missingIcon = false; }
}, { serviceWorkers: 'allow' }));

test('cached app starts immediately while the network stalls, and exposes offline readiness', async () => withPage(async page => {
  await page.goto(`${fixtureOrigin}/`);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  slowDocument = true;
  try {
    const start = Date.now();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#task-0');
    assert.ok(Date.now() - start < 1500, 'cached launch must not wait for the 3-second network request');
    assert.match(await page.locator('#pwa-status').innerText(), /离线已就绪/);
  } finally { slowDocument = false; }
}, { serviceWorkers: 'allow' }));
