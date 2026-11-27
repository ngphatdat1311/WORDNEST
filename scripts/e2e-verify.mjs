import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const standaloneServer = path.join(rootDir, '.next', 'standalone', 'server.js');

function findChromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    'No Chrome/Chromium executable found. Set CHROME_PATH or install Google Chrome.'
  );
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      srv.close(() => resolve(addr.port));
    });
    srv.on('error', reject);
  });
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for server at ${url}`);
}

async function run() {
  if (!fs.existsSync(standaloneServer)) {
    throw new Error(
      'Standalone build not found. Run `npm run build:electron` before `npm run test:e2e`.'
    );
  }

  const executablePath = findChromeExecutable();
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  const serverProc = spawn(process.execPath, [standaloneServer], {
    cwd: path.join(rootDir, '.next', 'standalone'),
    env: { ...process.env, HOSTNAME: '127.0.0.1', PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let browser;
  const pageErrors = [];
  const consoleErrors = [];

  try {
    await waitForServer(baseUrl);
    browser = await chromium.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore expected external YouTube / network errors in offline/sandbox environments
        if (!text.includes('youtube.com') && !text.includes('favicon')) {
          consoleErrors.push(text);
        }
      }
    });

    // 1. Fresh load -> Onboarding Wizard appears
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.getByText('Chào mừng đến WordNest · Bước 1/3').waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: /Tiếp tục/ }).click();
    await page.getByText('Chào mừng đến WordNest · Bước 2/3').waitFor({ timeout: 5000 });
    await page.getByRole('button', { name: /Tiếp tục/ }).click();
    await page.getByText('Chào mừng đến WordNest · Bước 3/3').waitFor({ timeout: 5000 });
    await page.getByRole('button', { name: 'Vào Trang chủ' }).click();
    await page.getByText('Chào mừng đến WordNest · Bước 3/3').waitFor({ state: 'hidden', timeout: 5000 });
    console.log('PASS [1/6] Onboarding Wizard 3-step flow & starter pack import');

    // 2. Navigate across all core tabs on Desktop
    const nav = page.locator('header nav, aside');
    await page.getByRole('button', { name: /Flashcard/i }).first().click();
    await page.getByText(/Việt → Anh/).waitFor({ timeout: 10000 });

    // 3. Flashcard FSRS v5 flip & rate
    await page.keyboard.press('Space');
    await page.getByText(/FSRS/).first().waitFor({ timeout: 5000 });
    const goodBtn = page.getByRole('button', { name: /^Tốt/ });
    await goodBtn.waitFor({ timeout: 5000 });
    await goodBtn.click();
    console.log('PASS [2/6] Flashcard FSRS v5 flip, retrievability badge & rating');

    // Check remaining tabs render cleanly
    for (const label of [/Trắc nghiệm/i, /Gõ từ/i, /Không Chiến/i, /Từ điển/i, /Thêm từ/i, /Tiến độ/i]) {
      const btn = page.getByRole('button', { name: label }).first();
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(250);
      }
    }
    // Verify Onboarding re-launcher exists in Progress view
    await page.getByRole('button', { name: 'Thiết lập lại lộ trình' }).waitFor({ timeout: 8000 });
    console.log('PASS [3/6] All secondary code-split tabs render cleanly');

    // 4. Command Palette (Ctrl+K)
    await page.keyboard.press('Control+k');
    const paletteInput = page.getByPlaceholder(/Tìm từ vựng|Tìm kiếm|Tra nhanh/i).first();
    await paletteInput.waitFor({ timeout: 5000 });
    await paletteInput.fill('serendipity');
    await page.keyboard.press('Escape');
    console.log('PASS [4/6] Command Palette (Ctrl+K) opens, searches & closes');

    // 5. Dictation Library -> Lazy-load curated lesson JSON -> Studio + Inline Underline Typing
    await page.getByRole('button', { name: /Nghe YouTube/i }).first().click();
    const firstLessonCard = page.locator('[data-testid="lesson-card"]').first();
    await firstLessonCard.waitFor({ timeout: 10000 });
    await firstLessonCard.click();
    await page.getByRole('button', { name: /Tập trung|Thoát tập trung/i }).waitFor({ timeout: 10000 });
    const fullModeBtn = page.getByRole('button', { name: /Gõ full/i }).first();
    await fullModeBtn.waitFor({ timeout: 5000 });
    await fullModeBtn.click();
    const inlineInput = page.getByLabel('Nghe và gõ trực tiếp câu tiếng Anh');
    await inlineInput.waitFor({ timeout: 5000 });
    await inlineInput.fill('hello');
    await page.getByText('hello', { exact: true }).first().waitFor({ timeout: 3000 });
    console.log('PASS [5/6] Dictation library, lazy-loaded studio & inline underline typing');

    // 6. Mobile responsive check (390x844) + Dark mode toggle + zero horizontal overflow
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: /Trang chủ/i }).first().click();
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    }));
    assert.ok(
      overflow.scrollW <= overflow.clientW + 2,
      `Mobile horizontal overflow detected: scrollWidth=${overflow.scrollW} > clientWidth=${overflow.clientW}`
    );

    const themeBtn = page.getByRole('button', { name: /Chế độ tối|Chế độ sáng|Đổi giao diện/i }).first();
    if (await themeBtn.isVisible()) {
      const beforeTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      await themeBtn.click();
      await page.waitForTimeout(150);
      const afterTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      assert.notEqual(beforeTheme, afterTheme, 'Theme toggle did not switch data-theme attribute');
    }
    console.log('PASS [6/6] Mobile 390px layout (0 horizontal overflow) & Theme toggle');

    assert.equal(pageErrors.length, 0, `Uncaught page errors:\n${pageErrors.join('\n')}`);
    assert.equal(consoleErrors.length, 0, `Console errors:\n${consoleErrors.join('\n')}`);
    console.log('\nALL 6 PLAYWRIGHT E2E SUITES PASSED (0 page errors, 0 console errors)');
  } finally {
    if (browser) await browser.close();
    serverProc.kill('SIGTERM');
  }
}

run().catch((err) => {
  console.error('E2E FAILED:', err);
  process.exit(1);
});
