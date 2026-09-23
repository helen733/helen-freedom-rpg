import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
await mkdir('artifacts', { recursive: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto('http://localhost:4173');
  await page.waitForSelector('#task-0');
  const secondPage = await context.newPage();
  await secondPage.goto('http://localhost:4173');
  await secondPage.waitForSelector('#task-0');
  await page.locator('#task-0').fill('第一窗口保存的行动');
  await secondPage.waitForFunction(() => document.querySelector('#task-0').value === '第一窗口保存的行动', null, { timeout: 3000 });
  await secondPage.locator('#task-1').fill('第二窗口保存的行动');
  await page.waitForFunction(() => document.querySelector('#task-1').value === '第二窗口保存的行动', null, { timeout: 3000 });
  assert.equal(await page.locator('#task-0').inputValue(), '第一窗口保存的行动');
  await secondPage.close();
  await page.locator('#task-0').fill('');
  await page.locator('#task-1').fill('');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, `horizontal overflow at ${width}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/mobile.png', fullPage: true });
  await page.locator('.task-check').nth(0).click();
  assert.equal(await page.locator('.task-check').nth(0).isChecked(), false);
  assert.match(await page.locator('#toast').innerText(), /先写下/);
  for (let d = 0; d < 7; d++) {
    assert.equal(await page.locator('#day-title').innerText(), `Day ${d + 1}`);
    for (let t = 0; t < 3; t++) {
      await page.locator(`#task-${t}`).fill(`Day ${d + 1} 真实赚钱验证 ${t + 1}`);
      await page.locator('.task-check').nth(t).check();
      if (await page.locator('#message-dialog').isVisible()) {
        assert.match(await page.locator('#dialog-message').innerText(), /恭喜，你完成了一次现实世界破解/);
        await page.locator('#dialog-close').click();
      }
    }
    if (d === 0) {
      await page.reload();
      assert.equal(await page.locator('#task-0').inputValue(), 'Day 1 真实赚钱验证 1');
      assert.equal(await page.locator('#xp-label').innerText(), '60 / 100 XP');
      await page.locator('.task-check').nth(0).uncheck();
      assert.equal(await page.locator('#xp-label').innerText(), '40 / 100 XP');
      await page.locator('.task-check').nth(0).check();
    }
    if (d < 6) await page.locator('#next-day').click();
  }
  assert.equal(await page.locator('#reward-progress').innerText(), '7 / 7');
  assert.equal(await page.locator('#claim-reward').isEnabled(), true);
  await page.locator('#claim-reward').click();
  assert.match(await page.locator('#dialog-title').innerText(), /青铜宝箱已开启/);
  await page.locator('#dialog-close').click();
  await page.reload();
  assert.equal(await page.locator('#claim-reward').isDisabled(), true);
  assert.match(await page.locator('#level').innerText(), /Lv.5/);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('#task-0');
  assert.equal(await page.locator('#day-title').innerText(), 'Day 7');
  await context.setOffline(false);
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#export').click();
  const download = await downloadEvent;
  await download.saveAs('artifacts/test-save.json');
  await page.locator('#import-file').setInputFiles('artifacts/test-save.json');
  await page.locator('#restore-confirm').click();
  assert.equal(await page.locator('#day-title').innerText(), 'Day 7');
  await page.locator('#import-file').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await page.locator('#message-dialog').waitFor({ state: 'visible' });
  assert.match(await page.locator('#dialog-title').innerText(), /无法恢复/);
  await page.locator('#dialog-close').click();
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({ path: 'artifacts/desktop.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS: cross-tab synchronization, 320–1440px layouts, empty tasks, editing, completion, undo, reload persistence, all 7 days, level ups, chest, export/import, invalid backup rejection, offline reload, no runtime errors.');
} finally { await browser.close(); }
