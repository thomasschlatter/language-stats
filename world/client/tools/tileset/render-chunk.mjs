// Render a readable, ID-labeled crop of a 32x32 tileset for VLM cataloging:
// crop a tile region, upscale (nearest-neighbour, crisp pixels), overlay a grid
// with each tile's ID. IDs are 0-based within the tileset (gid = firstgid + id).
//   node render-chunk.mjs <tileset.png> <colStart> <rowStart> <wTiles> <hTiles> <out.png> [scale=4]
import sharp from 'sharp';

const [path, cs, rs, wt, ht, out] = process.argv.slice(2);
const colStart = +cs, rowStart = +rs, wTiles = +wt, hTiles = +ht;
const scale = Number(process.argv[8]) || 4;
const T = 32, cell = T * scale;

const meta = await sharp(path).metadata();
const cols = Math.floor(meta.width / T);

const crop = await sharp(path)
  .extract({ left: colStart * T, top: rowStart * T, width: wTiles * T, height: hTiles * T })
  .resize({ width: wTiles * cell, height: hTiles * cell, kernel: 'nearest' })
  .ensureAlpha()
  .png().toBuffer();

// checkerboard behind transparency + grid + ID labels as one SVG overlay
let rects = '', lines = '', labels = '';
for (let ry = 0; ry < hTiles; ry++) for (let rx = 0; rx < wTiles; rx++) {
  const id = (rowStart + ry) * cols + (colStart + rx);
  const x = rx * cell, y = ry * cell;
  labels += `<rect x="${x}" y="${y}" width="${cell}" height="13" fill="#000" opacity="0.55"/>`
    + `<text x="${x + 2}" y="${y + 10}" font-family="monospace" font-size="11" fill="#fff">${id}</text>`;
}
for (let i = 0; i <= wTiles; i++) lines += `<line x1="${i * cell}" y1="0" x2="${i * cell}" y2="${hTiles * cell}" stroke="#0f0" stroke-width="1" opacity="0.5"/>`;
for (let i = 0; i <= hTiles; i++) lines += `<line x1="0" y1="${i * cell}" x2="${wTiles * cell}" y2="${i * cell}" stroke="#0f0" stroke-width="1" opacity="0.5"/>`;
const svg = `<svg width="${wTiles * cell}" height="${hTiles * cell}" xmlns="http://www.w3.org/2000/svg">${rects}${lines}${labels}</svg>`;

await sharp(crop).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toFile(out);
console.error(`rendered ${wTiles}x${hTiles} tiles from (${colStart},${rowStart}) @${scale}x -> ${out}  [ids ${(rowStart)*cols+colStart}..]`);
