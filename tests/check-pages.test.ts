import { test, expect } from '@playwright/test';
import { spawn } from 'child_process';
import * as path from 'path';

// URL mapping (updated to src paths for the current build)
const PAGE_URLS: Record<string, string> = {
  'starting': 'http://127.0.0.1:8099/src/overlays/starting.html?minutes=5&next=Ranked%20grind',
  'brb': 'http://127.0.0.1:8099/src/overlays/brb.html?msg=Grabbing%20coffee&minutes=5',
  'ending': 'http://127.0.0.1:8099/src/overlays/ending.html?next=Friday%208pm&socials=twitter/you,youtube/you',
  'webcam': 'http://127.0.0.1:8099/src/overlays/webcam.html?bg=1&name=Alex',
  'screenshare': 'http://127.0.0.1:8099/src/overlays/screenshare.html?bg=1',
  'screenshare-noname': 'http://127.0.0.1:8099/src/overlays/screenshare-noname.html?bg=1',
  'screenshare-side': 'http://127.0.0.1:8099/src/overlays/screenshare-side.html?bg=1',
  'screenshare-side-noname': 'http://127.0.0.1:8099/src/overlays/screenshare-side-noname.html?bg=1',
  'overlay': 'http://127.0.0.1:8099/src/overlays/overlay.html?bg=1&goal=42',
  'overlay-noname': 'http://127.0.0.1:8099/src/overlays/overlay-noname.html?bg=1&goal=42',
  'stinger': 'http://127.0.0.1:8099/src/transitions/stinger.html?bg=1&word=Be%20right%20back',
};

const SCREEN_SIZES = [
  { name: 'phone', w: 390, h: 844 },
  { name: 'full-hd', w: 1920, h: 1080 },
];

// Elements that must stay on screen.
const ON_SCREEN_SELECTOR = (
  '.panel, h1, h2, .cam, .hole, .count, .track, .cols, .subtitle, .next, .chip,'
  + ' .info, .goal, .alert, .card, .message-content, .plate'
);

let server: ReturnType<typeof spawn>;

test.beforeAll(async () => {
  server = spawn('node', ['-m', 'http.server', '8099', '--directory', process.cwd()], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1000));
});

test.afterAll(() => {
  server.kill();
});

test.describe('Layout', () => {
  for (const sz of SCREEN_SIZES) {
    test(`[${sz.name}] overlay pages stay on screen`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: sz.w, height: sz.h } });
      const page = await ctx.newPage();
      for (const [key, url] of Object.entries(PAGE_URLS)) {
        if (key === 'stinger') continue;
        await page.goto(url, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
        const off = await page.evaluate((selector: string) => {
          const els = document.querySelectorAll(selector);
          const bad = [];
          for (const el of Array.from(els)) {
            const style = getComputedStyle(el);
            if (style.visibility === 'hidden' || style.display === 'none') continue;
            const box = el.getBoundingClientRect();
            if (box.width === 0) continue;
            const alertIsHidden = el.closest('.alert') && !document.getElementById('alert')?.classList.contains('on');
            const sceneIsHidden = el.closest('.scene') && !document.getElementById('scene')?.classList.contains('on');
            if (alertIsHidden || sceneIsHidden) continue;
            const isOutside = box.right > window.innerWidth + 2 || box.left < -2 || box.bottom > window.innerHeight + 2 || box.top < -2;
            if (isOutside) bad.push((el.id || el.className) + ' ' + Math.round(box.left) + ',' + Math.round(box.top));
          }
          return bad.slice(0, 3);
        }, ON_SCREEN_SELECTOR);
        expect(off.length, `${key} off-screen at ${sz.name}`).toBe(0);
      }
      await ctx.close();
    });
  }
});

test.describe('Overlay behavior', () => {
  test('overlay: alert shows username', async ({ page }) => {
    await page.goto(PAGE_URLS.overlay, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof (window as any).overlay === 'object', { timeout: 5000 });
    await page.evaluate(() => (window as any).overlay.alert('sub', 'Nova_Fox_Long_Name', 'Tier 1'));
    await page.waitForTimeout(700);
    const text = await page.innerText('#alertName');
    expect(text).toBe('Nova_Fox_Long_Name');
  });

  test('stinger: transitionStart and transitionStop', async ({ page }) => {
    await page.goto('http://127.0.0.1:8099/src/transitions/stinger.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    // Check hidden initially
    const initial = await page.evaluate(() => getComputedStyle(document.getElementById('ink')!).visibility);
    expect(initial).toBe('hidden');
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('transitionStart', { detail: { duration: 800, transitionPoint: 0.5, trackMatte: false } })));
    await page.waitForTimeout(200);
    const visible = await page.evaluate(() => getComputedStyle(document.getElementById('ink')!).visibility);
    expect(visible).toBe('visible');
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('transitionStop')));
    await page.waitForTimeout(100);
    const after = await page.evaluate(() => getComputedStyle(document.getElementById('ink')!).visibility);
    expect(after).toBe('hidden');
  });
});
