/**
 * Generates the full favicon/PWA icon set from the Outreach logo SVG.
 * Run: node scripts/generate-icons.mjs
 *
 * Outputs:
 *   app/favicon.ico            multi-size ICO (16/32/48)
 *   app/icon.svg               vector favicon (App Router convention)
 *   public/icons/icon-16.png   / icon-32.png            tab fallbacks
 *   public/icons/apple-touch-icon.png (180, solid bg)
 *   public/icons/icon-192.png  / icon-512.png           transparent, purpose "any"
 *   public/icons/maskable-192.png / maskable-512.png    solid bg + safe zone
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const ROOT = path.resolve(import.meta.dirname, '..');
const SVG = path.join(ROOT, 'public', 'assets', 'logo-purple.svg');
const ICONS = path.join(ROOT, 'public', 'icons');
const BG = '#050816';

const svg = await readFile(SVG);

/** Render the logo at `size` px, transparent background. */
function logoPng(size) {
  return sharp(svg, { density: 300 }).resize(size, size).png().toBuffer();
}

/** Render the logo centred on a solid-bg square (scale = logo/canvas ratio). */
async function badgePng(size, scale) {
  const inner = Math.round(size * scale);
  const logo = await logoPng(inner);
  const pad = Math.round((size - inner) / 2);
  return sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: logo, top: pad, left: pad }])
    .png()
    .toBuffer();
}

await mkdir(ICONS, { recursive: true });

// Tab / bookmark PNGs (transparent)
await writeFile(path.join(ICONS, 'icon-16.png'), await logoPng(16));
await writeFile(path.join(ICONS, 'icon-32.png'), await logoPng(32));
await writeFile(path.join(ICONS, 'icon-192.png'), await logoPng(192));
await writeFile(path.join(ICONS, 'icon-512.png'), await logoPng(512));

// Apple touch icon — solid background required (iOS fills transparency with black)
await writeFile(
  path.join(ICONS, 'apple-touch-icon.png'),
  await badgePng(180, 0.72),
);

// Maskable PWA icons — logo inside the ~80% safe zone
await writeFile(path.join(ICONS, 'maskable-192.png'), await badgePng(192, 0.62));
await writeFile(path.join(ICONS, 'maskable-512.png'), await badgePng(512, 0.62));

// Multi-size favicon.ico served from app/ (App Router convention)
const ico = await pngToIco([
  await logoPng(16),
  await logoPng(32),
  await logoPng(48),
]);
await writeFile(path.join(ROOT, 'app', 'favicon.ico'), ico);

// Vector favicon
await writeFile(path.join(ROOT, 'app', 'icon.svg'), svg);

console.log('Icon set generated.');
