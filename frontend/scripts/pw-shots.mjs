/**
 * Responsive + overflow verification via headless Chromium.
 * Usage: node scripts/pw-shots.mjs
 * Screenshots land in /tmp/outreach-shots/.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:3100';
const OUT = '/tmp/outreach-shots';
mkdirSync(OUT, { recursive: true });

const ROUTES = ['/', '/login', '/register', '/dashboard', '/tracker', '/resume', '/pricing'];
const WIDTHS = [320, 360, 375, 414, 768, 819, 820, 1024, 1280, 1440];

const browser = await chromium.launch();
const results = [];

for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  for (const route of ROUTES) {
    try {
      await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 });
    } catch {
      await page.waitForTimeout(1500);
    }
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      const over = doc.scrollWidth > doc.clientWidth + 1;
      let worst = null;
      if (over) {
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect();
          if (r.right > doc.clientWidth + 1 && r.width > 40) {
            worst = `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`;
            break;
          }
        }
      }
      return { over, worst, scrollW: doc.scrollWidth, clientW: doc.clientWidth };
    });
    const nav = await page.evaluate(() => ({
      sidenav: !!document.querySelector('[data-shell="sidenav"], aside') &&
        getComputedStyle(document.querySelector('[data-shell="sidenav"], aside')).display !== 'none',
      tabbar: !!document.querySelector('[data-shell="tabbar"], nav.fixed, [class*="TabBar"]'),
    }));
    const name = `${width}${route.replace(/\//g, '_') || '_home'}.png`;
    await page.screenshot({ path: `${OUT}/${name}`, fullPage: false });
    results.push({ width, route, ...overflow, ...nav });
  }
  await page.close();
}

await browser.close();
for (const r of results) {
  const flag = r.over ? `OVERFLOW scrollW=${r.scrollW} clientW=${r.clientW} el=${r.worst}` : 'ok';
  console.log(`${String(r.width).padStart(4)}  ${r.route.padEnd(12)}  ${flag}`);
}
