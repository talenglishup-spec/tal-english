import sharp from 'sharp';
import path from 'node:path';

const SRC = 'C:/Users/KFA-N-202605001/Desktop/TAL/TAL-Claude/TAL/assets/icon-1024-blue.png';
const OUT = 'public/brand';

// Detect the corner (background) color so we can flatten any edge alpha to a
// solid, guaranteeing full-bleed icons with no transparent/white edges.
const { data } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
const bg = { r: data[0], g: data[1], b: data[2] };
console.log('detected bg corner:', bg);

const targets = [
  { size: 192, name: 'tal-app-192.png' },
  { size: 512, name: 'tal-app-512.png' },
  { size: 180, name: 'tal-app-180.png' },
];

for (const t of targets) {
  await sharp(SRC)
    .resize(t.size, t.size, { fit: 'cover' })
    .flatten({ background: bg })
    .png()
    .toFile(path.join(OUT, t.name));
  console.log('wrote', t.name);
}

// Also refresh a small favicon that matches the new app icon (root layout uses
// tal-app-192 as its <icon>, so the tab favicon follows the app set already;
// this 32px is only used by the marketing layout — regenerate it too for consistency).
await sharp(SRC)
  .resize(32, 32, { fit: 'cover' })
  .flatten({ background: bg })
  .png()
  .toFile(path.join(OUT, 'tal-app-32.png'));
console.log('wrote tal-app-32.png');
