// Composite a Tiled JSON map's tile layers into a PNG preview, so a generated map
// can be visually verified before deploying. Resolves each layer's gids against the
// map's tilesets (by firstgid), crops the tile, and composites it at its cell.
//   node render-map.mjs <map.json> <out.png>
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const [mapPath, out] = process.argv.slice(2);
const map = JSON.parse(readFileSync(mapPath, 'utf8'));
const mapDir = dirname(mapPath);
const T = map.tilewidth;
const W = map.width * T, H = map.height * T;

// Prepare tilesets: raw pixels + columns, sorted by firstgid desc for lookup.
const tss = [];
for (const ts of map.tilesets) {
  const imgPath = resolve(mapDir, ts.image);
  const meta = await sharp(imgPath).metadata();
  tss.push({ firstgid: ts.firstgid, cols: Math.floor(meta.width / T), img: imgPath, w: meta.width, h: meta.height });
}
tss.sort((a, b) => b.firstgid - a.firstgid);
const tileCache = new Map();
async function tileBuf(gid) {
  if (tileCache.has(gid)) return tileCache.get(gid);
  const ts = tss.find((t) => gid >= t.firstgid);
  if (!ts) return null;
  const id = gid - ts.firstgid;
  const left = (id % ts.cols) * T, top = Math.floor(id / ts.cols) * T;
  if (left + T > ts.w || top + T > ts.h) return null;
  const buf = await sharp(ts.img).extract({ left, top, width: T, height: T }).png().toBuffer();
  tileCache.set(gid, buf);
  return buf;
}

const composites = [];
for (const layer of map.layers) {
  if (layer.type !== 'tilelayer') continue;
  for (let i = 0; i < layer.data.length; i++) {
    const gid = layer.data[i] & 0x1FFFFFFF; // strip flip flags
    if (!gid) continue;
    const buf = await tileBuf(gid);
    if (!buf) continue;
    composites.push({ input: buf, left: (i % map.width) * T, top: Math.floor(i / map.width) * T });
  }
}
await sharp({ create: { width: W, height: H, channels: 4, background: { r: 30, g: 30, b: 40, alpha: 1 } } })
  .composite(composites).png().toFile(out);
console.error(`rendered map ${map.width}x${map.height} (${composites.length} tiles) -> ${out}`);
