// Regenerate the preview images in docs/ from the built pages in public/.
//
//   docs/vertical-layouts.png   every page on a 1080x1920 canvas
//   docs/alerts.png             the four alert types
//   docs/stinger.gif            the stinger transition between two scenes
//
// Run with: `pnpm previews` (builds first, then renders with Playwright).
// PNG sheets are composed in the browser, so there is no image dependency;
// only the GIF needs an encoder (gifenc), which is injected into a page.
import { createServer, type Server } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { chromium } from '@playwright/test';

type Browser = Awaited<ReturnType<typeof chromium.launch>>;
type Page = Awaited<ReturnType<Browser['newPage']>>;

const DOCS_DIR = resolve('docs');
const PUBLIC_DIR = resolve('public');
const BACKGROUND = '#1e1e1e';
const FONT_ROUTE = '**/fonts.g*apis.com/**';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function startStaticServer(root: string): Promise<{ server: Server; baseURL: string }> {
  const server = createServer((request, response) => {
    const { pathname } = new URL(request.url ?? '/', 'http://127.0.0.1');
    const filePath = normalize(join(root, decodeURIComponent(pathname)));

    if (filePath !== root && !filePath.startsWith(root + sep)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    readFile(filePath).then(
      (data) => {
        response.writeHead(200, {
          'Content-Type': MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
        });
        response.end(data);
      },
      () => {
        response.writeHead(404);
        response.end('Not found');
      },
    );
  });

  return new Promise((ready) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = address && typeof address === 'object' ? address.port : 0;
      ready({ server, baseURL: `http://127.0.0.1:${port}` });
    });
  });
}

async function openPage(browser: Browser, viewport: { width: number; height: number }): Promise<Page> {
  const context = await browser.newContext({ viewport });
  // Keep previews fast and offline-safe.
  await context.route(FONT_ROUTE, (route) => route.abort());
  return context.newPage();
}

async function screenshotDataUrl(page: Page, clip?: Parameters<Page['screenshot']>[0]): Promise<string> {
  const buffer = await page.screenshot(clip);
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

const VERTICAL = { width: 1080, height: 1920 };
const THUMBNAIL = { width: 360, height: 640 };

const SCENES: Array<{ path: string; alert?: boolean; stinger?: boolean }> = [
  { path: '/overlays/starting.html?minutes=5&next=Ranked%20grind' },
  { path: '/overlays/brb.html?msg=Grabbing%20coffee&minutes=5' },
  { path: '/overlays/ending.html?next=Friday%208pm&socials=twitter/you,youtube/you' },
  { path: '/overlays/webcam.html?bg=1&name=Alex&title=Ranked%20grind' },
  { path: '/overlays/screenshare.html?bg=1' },
  { path: '/overlays/screenshare-side.html?bg=1' },
  { path: '/overlays/overlay.html?bg=1&goal=42', alert: true },
  { path: '/transitions/stinger.html?bg=1&word=Be%20right%20back', stinger: true },
];

async function makeVerticalSheet(browser: Browser, baseURL: string): Promise<void> {
  const shots: string[] = [];

  for (const scene of SCENES) {
    const page = await openPage(browser, VERTICAL);
    await page.goto(`${baseURL}${scene.path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500); // entrance animation

    if (scene.alert) {
      await page.evaluate(() => window.overlay.alert('sub', 'pixelparade', 'Tier 1 · 3 months'));
      await page.waitForTimeout(1300);
    }
    if (scene.stinger) {
      await page.evaluate(() => window.stinger.render(0.5));
    }

    shots.push(await screenshotDataUrl(page));
    await page.context().close();
  }

  const columns = 4;
  const images = shots.map((src) => `<img src="${src}" alt="">`).join('');
  await composeAndSave(browser, {
    width: THUMBNAIL.width * columns,
    height: THUMBNAIL.height * Math.ceil(shots.length / columns),
    html: `
      #sheet {
        display: grid;
        grid-template-columns: repeat(${columns}, ${THUMBNAIL.width}px);
        grid-auto-rows: ${THUMBNAIL.height}px;
        background: ${BACKGROUND};
      }
      #sheet img { display: block; width: ${THUMBNAIL.width}px; height: ${THUMBNAIL.height}px; }
    `,
    body: `<div id="sheet">${images}</div>`,
    output: 'vertical-layouts.png',
  });

  console.log('wrote docs/vertical-layouts.png');
}

const ALERTS: Array<[kind: string, username: string, detail: string]> = [
  ['follow', 'Nova_Fox', ''],
  ['sub', 'pixelparade', 'Tier 1 · 3 months'],
  ['raid', 'quietstorm', '42 viewers'],
  ['tip', 'mx_halcyon', '$5.00 · "great stream!"'],
];

const LANDSCAPE = { width: 1920, height: 1080 };
const CROP_MARGIN = 40;

async function makeAlertsImage(browser: Browser, baseURL: string): Promise<void> {
  const images: string[] = [];

  for (const [kind, username, detail] of ALERTS) {
    const page = await openPage(browser, LANDSCAPE);
    await page.goto(`${baseURL}/overlays/overlay.html?bg=1&lower=0&goal=0`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    await page.evaluate(
      ([k, name, sub]) => window.overlay.alert(k, name, sub),
      [kind, username, detail] as [string, string, string],
    );
    await page.waitForTimeout(1300);

    const box = await page.evaluate(() => {
      const rect = document.getElementById('alert')!.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    });

    const x = Math.max(0, Math.round(box.left) - CROP_MARGIN);
    const y = Math.max(0, Math.round(box.top) - CROP_MARGIN);
    const width = Math.min(LANDSCAPE.width, Math.round(box.right) + CROP_MARGIN) - x;
    const height = Math.min(LANDSCAPE.height, Math.round(box.bottom) + CROP_MARGIN) - y;

    images.push(await screenshotDataUrl(page, { clip: { x, y, width, height } }));
    await page.context().close();
  }

  await composeAndSave(browser, {
    height: 'auto',
    html: `
      #sheet {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 10px 20px;
        background: ${BACKGROUND};
        width: max-content;
      }
      #sheet img { display: block; }
    `,
    body: `<div id="sheet">${images.map((src) => `<img src="${src}" alt="">`).join('')}</div>`,
    output: 'alerts.png',
  });

  console.log('wrote docs/alerts.png');
}

async function composeAndSave(
  browser: Browser,
  options: { html: string; body: string; output: string; width?: number; height: number | 'auto' },
): Promise<void> {
  const page = await browser.newPage();
  await page.setViewportSize({ width: options.width ?? 1440, height: options.height === 'auto' ? 900 : options.height });
  await page.setContent(
    `<!doctype html><html><head><style>html,body{margin:0;background:${BACKGROUND}}${options.html}</style></head><body>${options.body}</body></html>`,
  );

  const sheet = page.locator('#sheet');
  const size = await sheet.boundingBox();
  if (size) await page.setViewportSize({ width: Math.ceil(size.width), height: Math.ceil(size.height) });

  await sheet.screenshot({ path: join(DOCS_DIR, options.output) });
  await page.close();
}

const GIF_FRAMES = 36;
const GIF_SIZE = { width: 800, height: 450 };
const GIF_CAPTURE = { width: 1280, height: 720 };
const GIF_DELAY_MS = 45;

// Every stinger page, so each variant gets a preview GIF of the same wipe.
const STINGERS: Array<{ page: string; output: string }> = [
  { page: 'stinger.html', output: 'docs/stinger.gif' },
  { page: 'stinger-vertical.html', output: 'docs/stinger-vertical.gif' },
  { page: 'stinger-diagonal.html', output: 'docs/stinger-diagonal.gif' },
  { page: 'stinger-radial.html', output: 'docs/stinger-radial.gif' },
  { page: 'stinger-diamond.html', output: 'docs/stinger-diamond.gif' },
  { page: 'stinger-iris.html', output: 'docs/stinger-iris.gif' },
  { page: 'stinger-stepped.html', output: 'docs/stinger-stepped.gif' },
];

async function makeStingerGif(browser: Browser, baseURL: string, stinger: (typeof STINGERS)[number]): Promise<void> {
  const page = await openPage(browser, GIF_CAPTURE);
  await page.goto(`${baseURL}/transitions/${stinger.page}?word=Be%20right%20back&channel=yourchannel`, {
    waitUntil: 'domcontentloaded',
  });

  // Two scenes sit behind the stinger: the first until the midpoint, then the second.
  await page.evaluate(() => {
    const addScene = (id: string, source: string): void => {
      const frame = document.createElement('iframe');
      frame.id = id;
      frame.src = source;
      frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:-1';
      document.body.appendChild(frame);
    };
    addScene('firstScene', '/overlays/starting.html?minutes=5&next=Ranked%20grind');
    addScene('secondScene', '/overlays/brb.html?msg=Grabbing%20coffee');
    document.getElementById('secondScene')!.style.visibility = 'hidden';
  });
  await page.waitForTimeout(2500);

  const encoder = await createGifEncoder(browser);
  const transitionPoint = 0.5;

  for (let index = 0; index < GIF_FRAMES; index += 1) {
    const progress = index / (GIF_FRAMES - 1);
    const sceneSwapped = progress >= transitionPoint;

    await page.evaluate(
      ([value, swapped, point]) => {
        document.getElementById('firstScene')!.style.visibility = swapped ? 'hidden' : 'visible';
        document.getElementById('secondScene')!.style.visibility = swapped ? 'visible' : 'hidden';
        window.stinger.render(value, point);
      },
      [progress, sceneSwapped, transitionPoint] as [number, boolean, number],
    );

    const dataUrl = await screenshotDataUrl(page);
    await encoder.evaluate(
      ([url, width, height, delay]) => window.__gifAddFrame(url, width, height, delay),
      [dataUrl, GIF_SIZE.width, GIF_SIZE.height, GIF_DELAY_MS] as [string, number, number, number],
    );
  }

  const base64 = await encoder.evaluate(() => window.__gifFinish());
  await writeFile(resolve(stinger.output), Buffer.from(base64, 'base64'));

  await page.context().close();
  await encoder.context().close();
  console.log(`wrote ${stinger.output}`);
}

// A blank page with gifenc injected. Frames are handed to it as PNG data URLs;
// it draws, quantises and encodes them in-browser, so no pixel data travels
// back and forth across the wire.
async function createGifEncoder(browser: Browser): Promise<Page> {
  const require = createRequire(import.meta.url);
  const source = await readFile(require.resolve('gifenc/dist/gifenc.esm.js'), 'utf8');
  const moduleSource = Buffer.from(source).toString('base64');

  const page = await browser.newPage();
  await page.evaluate(async (encoded) => {
    const gifenc = await import(`data:text/javascript;base64,${encoded}`);
    const gif = gifenc.GIFEncoder();

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;

    window.__gifAddFrame = async (dataUrl, width, height, delay) => {
      canvas.width = width;
      canvas.height = height;

      const image = new Image();
      image.src = dataUrl;
      await image.decode();
      context.drawImage(image, 0, 0, width, height);

      const { data } = context.getImageData(0, 0, width, height);
      const palette = gifenc.quantize(data, 256);
      const indexed = gifenc.applyPalette(data, palette);
      gif.writeFrame(indexed, width, height, { palette, delay });
    };

    window.__gifFinish = () => {
      gif.finish();
      const bytes = gif.bytes();
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      return btoa(binary);
    };
  }, moduleSource);

  return page;
}

async function main(): Promise<void> {
  await mkdir(DOCS_DIR, { recursive: true });

  const { server, baseURL } = await startStaticServer(PUBLIC_DIR);
  const browser = await chromium.launch();

  try {
    await makeVerticalSheet(browser, baseURL);
    await makeAlertsImage(browser, baseURL);
    for (const stinger of STINGERS) {
      await makeStingerGif(browser, baseURL, stinger);
    }
  } finally {
    await browser.close();
    server.close();
  }
}

await main();
