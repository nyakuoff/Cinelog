// Dependency-free PWA icon generator: renders the Cinelog three-dot logo
// (dark square + gold/cyan/rose dots) to PNG at several sizes using only
// Node built-ins (zlib for the IDAT deflate, manual PNG chunking).
//
// Regenerate after a logo/color change:
//   node apps/web/scripts/gen-icons.cjs apps/web/public
// (favicon.svg is hand-authored alongside — keep the two in sync.)
const zlib = require('node:zlib');
const fs = require('node:fs');
const path = require('node:path');

const BG = [14, 15, 19]; // #0e0f13 theme background
const DOTS = [
  [255, 177, 60], // gold
  [69, 208, 221], // cyan
  [255, 93, 122], // rose
];

// CRC32 (PNG uses it per chunk).
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** Render an S×S RGB icon: opaque bg, three overlapping anti-aliased dots
 *  centered, cluster sized to sit inside the maskable safe zone. */
function render(S) {
  const px = Buffer.alloc(S * S * 3);
  for (let i = 0; i < S * S; i++) {
    px[i * 3] = BG[0];
    px[i * 3 + 1] = BG[1];
    px[i * 3 + 2] = BG[2];
  }
  const extent = 0.6 * S; // total cluster width (safe for maskable)
  const r = 0.26 * extent;
  const cx = S / 2;
  const cy = S / 2;
  const offset = 0.24 * extent; // center-to-outer-center distance
  const centers = [
    [cx - offset, cy],
    [cx, cy],
    [cx + offset, cy],
  ];
  for (let d = 0; d < 3; d++) {
    const [ox, oy] = centers[d];
    const [cr, cg, cb] = DOTS[d];
    const minX = Math.max(0, Math.floor(ox - r - 1));
    const maxX = Math.min(S - 1, Math.ceil(ox + r + 1));
    const minY = Math.max(0, Math.floor(oy - r - 1));
    const maxY = Math.min(S - 1, Math.ceil(oy + r + 1));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dist = Math.hypot(x + 0.5 - ox, y + 0.5 - oy);
        const cov = Math.max(0, Math.min(1, r - dist + 0.5)); // 1px AA band
        if (cov <= 0) continue;
        const idx = (y * S + x) * 3;
        px[idx] = Math.round(px[idx] * (1 - cov) + cr * cov);
        px[idx + 1] = Math.round(px[idx + 1] * (1 - cov) + cg * cov);
        px[idx + 2] = Math.round(px[idx + 2] * (1 - cov) + cb * cov);
      }
    }
  }
  // Filter byte 0 per scanline.
  const raw = Buffer.alloc(S * (S * 3 + 1));
  for (let y = 0; y < S; y++) {
    raw[y * (S * 3 + 1)] = 0;
    px.copy(raw, y * (S * 3 + 1) + 1, y * S * 3, (y + 1) * S * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0);
  ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = process.argv[2];
fs.mkdirSync(outDir, { recursive: true });
const targets = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
  ['favicon-32.png', 32],
];
for (const [name, size] of targets) {
  fs.writeFileSync(path.join(outDir, name), render(size));
  console.log('wrote', name, size + 'x' + size);
}
