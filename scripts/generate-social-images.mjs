import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const heroPath = resolve(root, 'src/assets/images/splash-hero.jpg');
const logoSvgPath = resolve(root, 'public/images/logo-white.svg');
const ogOut = resolve(root, 'public/og-card.jpg');
const touchOut = resolve(root, 'public/apple-touch-icon.png');

const logoSvg = await readFile(logoSvgPath);

// 1200x630 social card: splash hero + dark scrim + centered white logo.
const ogWidth = 1200;
const ogHeight = 630;
const ogLogoWidth = 640;

const heroLayer = await sharp(heroPath)
  .resize(ogWidth, ogHeight, { fit: 'cover', position: 'attention' })
  .toBuffer();

const scrim = await sharp({
  create: {
    width: ogWidth,
    height: ogHeight,
    channels: 4,
    background: { r: 4, g: 4, b: 4, alpha: 0.4 },
  },
})
  .png()
  .toBuffer();

const ogLogo = await sharp(logoSvg, { density: 400 })
  .resize({ width: ogLogoWidth })
  .png()
  .toBuffer();

await sharp(heroLayer)
  .composite([
    { input: scrim, blend: 'over' },
    { input: ogLogo, gravity: 'center' },
  ])
  .jpeg({ quality: 85, mozjpeg: true })
  .toFile(ogOut);

console.log(`✓ wrote ${ogOut}`);

// 180x180 apple-touch-icon: black background + centered white logo.
const touchSize = 180;
const touchLogoWidth = 130;

const touchLogo = await sharp(logoSvg, { density: 400 })
  .resize({ width: touchLogoWidth })
  .png()
  .toBuffer();

await sharp({
  create: {
    width: touchSize,
    height: touchSize,
    channels: 4,
    background: { r: 4, g: 4, b: 4, alpha: 1 },
  },
})
  .composite([{ input: touchLogo, gravity: 'center' }])
  .png()
  .toFile(touchOut);

console.log(`✓ wrote ${touchOut}`);
