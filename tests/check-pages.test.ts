import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { test as base, expect, type Page } from '@playwright/test';

const OVERLAY_PAGES = {
  'starting': '/overlays/starting.html?minutes=5&next=Ranked%20grind',
  'brb': '/overlays/brb.html?msg=Grabbing%20coffee&minutes=5',
  'ending': '/overlays/ending.html?next=Friday%208pm&socials=twitter/you,youtube/you',
  'webcam': '/overlays/webcam.html?bg=1&name=Alex',
  'screenshare': '/overlays/screenshare.html?bg=1',
  'screenshare-noname': '/overlays/screenshare-noname.html?bg=1',
  'screenshare-side': '/overlays/screenshare-side.html?bg=1',
  'screenshare-side-noname': '/overlays/screenshare-side-noname.html?bg=1',
  'overlay': '/overlays/overlay.html?bg=1&goal=42',
  'overlay-noname': '/overlays/overlay-noname.html?bg=1&goal=42',
} satisfies Record<string, string>;

// Every stinger page. `wipe` is the clip-path (read from the preview hook at
// 25% progress) that the page's wipe should produce, so a variant that picks up
// the wrong wipe fails here.
const STINGER_PAGES = {
  'stinger': { path: '/transitions/stinger.html', wipe: /^inset\(0px [\d.]+% 0px 0%\)$/ },
  'vertical': { path: '/transitions/stinger-vertical.html', wipe: /^inset\(0% 0px [\d.]+%\)$/ },
  'diagonal': { path: '/transitions/stinger-diagonal.html', wipe: /^inset\(0px [\d.]+% 0px 0%\)$/ },
  'radial': { path: '/transitions/stinger-radial.html', wipe: /^circle\([\d.]+% at 50% 50%\)$/ },
  'diamond': { path: '/transitions/stinger-diamond.html', wipe: /^inset\(0px [\d.]+% 0px 0%\)$/ },
  'iris': { path: '/transitions/stinger-iris.html', wipe: /^inset\(0px [\d.]+%\)$/ },
  'stepped': { path: '/transitions/stinger-stepped.html', wipe: /^inset\(0px 0% 0px [\d.]+%\)$/ },
} satisfies Record<string, { path: string; wipe: RegExp }>;

const SCREEN_SIZES = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'full-hd', width: 1920, height: 1080 },
] as const;

const ON_SCREEN_SELECTOR = [
  '.panel', 'h1', 'h2', '.cam', '.hole', '.count', '.track', '.cols',
  '.subtitle', '.next', '.chip', '.info', '.goal', '.alert', '.card',
  '.message-content', '.plate',
].join(', ');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

// Dependency-free static file server, started in-process once per worker.
// Serves the built `public/` output (run `pnpm build` first — `pnpm test`
// does this automatically). Uses an ephemeral port, so parallel workers
// never clash.
function createStaticServer(): Server {
  const root = resolve(process.cwd(), 'public');

  return createServer((request, response) => {
    const { pathname } = new URL(request.url ?? '/', 'http://127.0.0.1');
    const requested = normalize(join(root, decodeURIComponent(pathname)));
    const filePath = pathname.endsWith('/') ? join(requested, 'index.html') : requested;

    // Prevent path traversal outside the served root.
    if (filePath !== root && !filePath.startsWith(root + sep)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(404);
        response.end('Not found');
        return;
      }
      response.writeHead(200, {
        'Content-Type': MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      });
      response.end(data);
    });
  });
}

export const test = base.extend<{}, { appURL: string }>({
  appURL: [
    async ({}, use) => {
      const server = createStaticServer();
      await new Promise<void>((ready) => server.listen(0, '127.0.0.1', ready));

      const address = server.address();
      const port = address && typeof address === 'object' ? address.port : 0;

      await use(`http://127.0.0.1:${port}`);

      await new Promise<void>((closed) => server.close(() => closed()));
    },
    { scope: 'worker' },
  ],
});

function findOffScreenElements(page: Page): Promise<string[]> {
  return page.evaluate((selector) => {
    const offScreen: string[] = [];
    for (const element of Array.from(document.querySelectorAll(selector))) {
      const style = getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none') continue;

      const box = element.getBoundingClientRect();
      if (box.width === 0) continue;

      const alertHidden = element.closest('.alert') && !document.getElementById('alert')?.classList.contains('on');
      const sceneHidden = element.closest('.scene') && !document.getElementById('scene')?.classList.contains('on');
      if (alertHidden || sceneHidden) continue;

      const outside = box.right > innerWidth + 2 || box.left < -2
        || box.bottom > innerHeight + 2 || box.top < -2;
      if (outside) {
        offScreen.push(`${element.id || element.className} ${Math.round(box.left)},${Math.round(box.top)}`);
      }
    }
    return offScreen;
  }, ON_SCREEN_SELECTOR);
}

function staysOnScreen(name: string, path: string) {
  return async ({ page, appURL }: { page: Page; appURL: string }): Promise<void> => {
    const response = await page.goto(`${appURL}${path}`);
    expect(response?.ok(), `${name} responded with ${response?.status()}`).toBe(true);

    await expect
      .poll(() => findOffScreenElements(page), { timeout: 5_000 })
      .toEqual([]);
  };
}

for (const size of SCREEN_SIZES) {
  test.describe(`layout at ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    for (const [name, path] of Object.entries(OVERLAY_PAGES)) {
      test(`${name} stays on screen`, staysOnScreen(name, path));
    }

    for (const [name, { path }] of Object.entries(STINGER_PAGES)) {
      test(`stinger-${name} stays on screen`, staysOnScreen(`stinger-${name}`, path));
    }
  });
}

test.describe('overlay behavior', () => {
  test('alert shows the username', async ({ page, appURL }) => {
    const response = await page.goto(`${appURL}${OVERLAY_PAGES.overlay}`);
    expect(response?.ok(), `overlay responded with ${response?.status()}`).toBe(true);
    await expect.poll(() => page.evaluate(() => typeof window.overlay)).toBe('object');

    await page.evaluate(() => window.overlay.alert('sub', 'Nova_Fox_Long_Name', 'Tier 1'));

    await expect(page.locator('#alertName')).toHaveText('Nova_Fox_Long_Name');
    await expect(page.locator('#alertKind')).toHaveText('New subscriber');
  });

  test('postMessage updates goal, lower third and scene', async ({ page, appURL }) => {
    const response = await page.goto(`${appURL}${OVERLAY_PAGES.overlay}`);
    expect(response?.ok(), `overlay responded with ${response?.status()}`).toBe(true);
    await expect.poll(() => page.evaluate(() => typeof window.overlay)).toBe('object');

    await page.evaluate(() => {
      postMessage({ type: 'goal', value: 30, max: 50 }, '*');
      postMessage({ type: 'lower', name: 'Alex', title: 'Ranked grind', show: true }, '*');
      postMessage({ type: 'scene', name: 'brb', minutes: 2 }, '*');
    });

    await expect(page.locator('#goalNum')).toHaveText('30 / 50');
    await expect(page.locator('#name')).toHaveText('Alex');
    await expect(page.locator('#lower')).toHaveClass(/\bon\b/);
    await expect(page.locator('#scene')).toHaveClass(/\bon\b/);
    await expect(page.locator('#count')).toContainText(':');
  });
});

test.describe('stinger transitions', () => {
  for (const [name, { path, wipe }] of Object.entries(STINGER_PAGES)) {
    test(`${name} responds to OBS events and wipes with its own shape`, async ({ page, appURL }) => {
      const response = await page.goto(`${appURL}${path}`);
      expect(response?.ok(), `${name} responded with ${response?.status()}`).toBe(true);

      const ink = page.locator('#ink');
      await expect(ink).toHaveCSS('visibility', 'hidden');

      await page.evaluate(() => window.dispatchEvent(
        new CustomEvent('transitionStart', {
          detail: { duration: 5_000, transitionPoint: 0.5, trackMatte: false },
        }),
      ));
      await expect(ink).toHaveCSS('visibility', 'visible');

      // The preview hook renders an exact frame, so the wipe shape is checked
      // deterministically instead of by racing the animation.
      const early = await page.evaluate(() => {
        window.stinger.render(0.25, 0.5);
        return getComputedStyle(document.getElementById('ink')!).clipPath;
      });
      expect(early).toMatch(wipe);

      await page.evaluate(() => window.dispatchEvent(new CustomEvent('transitionStop')));
      await expect(ink).toHaveCSS('visibility', 'hidden');
    });
  }
});

test.describe('landing page', () => {
  // The href on each card, relative to public/ (the maps use rooted URLs).
  const PAGE_HREFS = [
    ...Object.values(OVERLAY_PAGES).map((path) => (path.split('?')[0] ?? '').replace(/^\//, '')),
    ...Object.values(STINGER_PAGES).map(({ path }) => path.replace(/^\//, '')),
  ];

  test('serves the index and links every page', async ({ page, appURL }) => {
    const response = await page.goto(`${appURL}/`);
    expect(response?.ok(), `index responded with ${response?.status()}`).toBe(true);

    const hrefs = await page
      .locator('a.page-link')
      .evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href')));

    for (const href of PAGE_HREFS) expect(hrefs).toContain(href);
  });

  test('builds a query string, adds custom params and opens the page', async ({ page, appURL }) => {
    await page.goto(`${appURL}/`);
    const card = page.locator('.card[data-page="overlay"]');

    await card.locator('summary').click();
    await card.locator('[data-opt="goal"]').fill('42');

    // The URL preview and the Open link track the controls; bg=1 is on by default.
    await expect(card.locator('.url')).toContainText('goal=42');
    await expect(card.locator('.url')).toContainText('bg=1');
    await expect(card.locator('a.open-link')).toHaveAttribute('href', /goal=42/);

    // A hand-written key/value pair joins the query and shows as a removable chip.
    await card.locator('.custom-key').fill('foo');
    await card.locator('.custom-value').fill('bar');
    await card.locator('.custom-add').click();
    await expect(card.locator('.url')).toContainText('foo=bar');
    await expect(card.locator('.param-chip')).toHaveCount(1);

    // Following the generated link really does configure the page.
    const href = await card.locator('a.open-link').getAttribute('href');
    const response = await page.goto(`${appURL}/${href}`);
    expect(response?.ok(), `overlay responded with ${response?.status()}`).toBe(true);
    await expect(page.locator('#goalNum')).toHaveText('42 / 100');
  });
});
