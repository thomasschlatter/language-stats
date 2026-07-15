// Analyze a 32x32 tileset: per-tile structural stats (empty?, coverage, dominant
// color, a 4x4 colour signature for dedup + rough category). Exhaustive & cheap —
// the base layer of the tile catalog; VLM labeling refines the non-empty tiles.
//   node world/client/tools/tileset/analyze.mjs <tileset.png> [tileSize=32]
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { basename } from 'node:path';

const path = process.argv[2];
const T = Number(process.argv[3]) || 32;
if (!path) { console.error('usage: analyze.mjs <tileset.png> [tileSize]'); process.exit(1); }

const img = sharp(path).ensureAlpha();
const { width, height } = await img.metadata();
const raw = await img.raw().toBuffer();          // RGBA bytes, row-major
const cols = Math.floor(width / T), rows = Math.floor(height / T);
const px = (x, y) => { const i = (y * width + x) * 4; return [raw[i], raw[i + 1], raw[i + 2], raw[i + 3]]; };

// crude colour bucket for a rough category label
function categorize(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx - mn;
  if (sat < 24) return b > 200 ? 'white' : mx < 70 ? 'dark' : 'gray';
  if (g >= r && g >= b) return 'green';
  if (b >= r && b >= g) return 'blue';
  if (r >= g && r >= b) return (g > b + 20) ? (r > 150 ? 'tan/brown' : 'brown') : 'red';
  return 'other';
}

const tiles = [];
let nonEmpty = 0;
for (let row = 0; row < rows; row++) {
  for (let col = 0; col < cols; col++) {
    const id = row * cols + col;
    let n = 0, r = 0, g = 0, b = 0;
    const sig = [];                                // 4x4 avg-colour signature
    for (let by = 0; by < 4; by++) for (let bx = 0; bx < 4; bx++) {
      let sr = 0, sg = 0, sb = 0, sn = 0;
      for (let yy = 0; yy < T / 4; yy++) for (let xx = 0; xx < T / 4; xx++) {
        const [pr, pg, pb, pa] = px(col * T + bx * (T / 4) + xx, row * T + by * (T / 4) + yy);
        if (pa > 16) { sr += pr; sg += pg; sb += pb; sn++; n++; r += pr; g += pg; b += pb; }
      }
      sig.push(sn ? [Math.round(sr / sn), Math.round(sg / sn), Math.round(sb / sn)] : null);
    }
    const coverage = +(n / (T * T)).toFixed(2);
    const empty = n < 8;
    if (!empty) nonEmpty++;
    const avg = n ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : null;
    tiles.push({ id, col, row, empty, coverage, avg, cat: avg ? categorize(...avg) : null, sig });
  }
}
// dedup: group identical signatures
const byHash = {};
for (const t of tiles) { if (t.empty) continue; const h = JSON.stringify(t.sig); (byHash[h] = byHash[h] || []).push(t.id); }
const dupGroups = Object.values(byHash).filter((a) => a.length > 1).length;
const catCounts = {};
for (const t of tiles) if (!t.empty) catCounts[t.cat] = (catCounts[t.cat] || 0) + 1;

const name = basename(path).replace('.png', '');
const out = `world/client/tools/tileset/${name}.tiles.json`;
writeFileSync(out, JSON.stringify({ name, width, height, tile: T, cols, rows, count: cols * rows, nonEmpty, dupGroups, catCounts, tiles }));
console.error(`${name}: ${cols}x${rows}=${cols * rows} tiles | ${nonEmpty} non-empty | ${dupGroups} dup-groups`);
console.error('categories:', JSON.stringify(catCounts));
console.error('-> ' + out);
