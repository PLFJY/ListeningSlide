import { deflateSync } from 'node:zlib';
import { writeFile, mkdir } from 'node:fs/promises';
const mac = process.argv.includes('--mac');
const size = mac ? 512 : 256,
  raw = Buffer.alloc(size * (size * 4 + 1));
const rect = (x, y, l, t, w, h, r) => {
  const dx = Math.max(l + r - x, 0, x - (l + w - r)),
    dy = Math.max(t + r - y, 0, y - (t + h - r));
  return x >= l && x < l + w && y >= t && y < t + h && dx * dx + dy * dy < r * r;
};
const bars = [54, 93, 42, 142, 85, 111, 52];
for (let y = 0; y < size; y++)
  for (let x = 0; x < size; x++) {
    let alpha = 0,
      white = 0;
    for (let sy = 0; sy < 4; sy++)
      for (let sx = 0; sx < 4; sx++) {
        const px = ((x + (sx + 0.5) / 4) * 256) / size,
          py = ((y + (sy + 0.5) / 4) * 256) / size;
        if (rect(px, py, 4, 4, 248, 248, 58)) {
          alpha++;
          if (bars.some((h, i) => rect(px, py, 49 + i * 23, 128 - h / 2, 9, h, 4.5))) white++;
        }
      }
    const i = y * (size * 4 + 1) + 1 + x * 4;
    const ratio = alpha ? white / alpha : 0;
    raw[i] = 24 + (255 - 24) * ratio;
    raw[i + 1] = 127 + (255 - 127) * ratio;
    raw[i + 2] = 114 + (255 - 114) * ratio;
    raw[i + 3] = (alpha / 16) * 255;
  }
function crc(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) {
    c ^= b;
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const b = Buffer.alloc(data.length + 12);
  b.writeUInt32BE(data.length);
  b.write(type, 4);
  data.copy(b, 8);
  b.writeUInt32BE(crc(b.subarray(4, b.length - 4)), b.length - 4);
  return b;
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(size);
ihdr.writeUInt32BE(size, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);
const ico = Buffer.alloc(22);
ico.writeUInt16LE(1, 2);
ico.writeUInt16LE(1, 4);
ico.writeUInt16LE(1, 10);
ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(png.length, 14);
ico.writeUInt32LE(22, 18);
await mkdir('build', { recursive: true });
if (mac) await writeFile('build/icon-mac.png', png);
else {
  await writeFile('build/icon.png', png);
  await writeFile('build/icon.ico', Buffer.concat([ico, png]));
}
