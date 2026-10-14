import { spawn } from 'child_process';
import { chromium } from 'playwright';

declare global {
  interface Window {
    overlay?: any;
  }
}

async function main() {
  // start http server serving repo root
  const server = spawn('node', ['-m', 'http.server', '8099', '--directory', process.cwd()], {
    stdio: 'ignore',
  });
  // give server time to start
  await new Promise(resolve => setTimeout(resolve, 1000));

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  // navigate to overlay page via HTTP
  await page.goto('http://127.0.0.1:8099/src/overlays/overlay.html?bg=1&goal=42', { waitUntil: 'networkidle' });
  // wait for overlay module to initialize
  await page.waitForFunction(() => typeof window.overlay !== 'undefined', { timeout: 5000 });

  // call alert via overlay API
  await page.evaluate(() => {
    (window as any).overlay.alert('sub', 'Nova_Fox_Long_Name', 'Tier 1');
  });

  // verify result
  const name = await page.innerText('#alertName');
  console.log('alert name:', name);

  await context.close();
  await browser.close();
  server.kill();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});