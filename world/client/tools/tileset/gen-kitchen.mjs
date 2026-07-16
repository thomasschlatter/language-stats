// Kitchen = the 3D-walls room (see gen-room2) + a Furniture layer of LimeZu Modern
// Interiors kitchen items (worktop + sink, stove/oven, fridge, cupboard, table + chairs).
// Same recipe as gen-classroom.mjs. Preview with render-map.mjs.
// `node gen-kitchen.mjs <out.json>`.
import { writeFileSync } from 'node:fs';
const out = process.argv[2] || 'world/client/public/assets/map/kitchenMap.json';

// A domestic kitchen: a compact room (a classroom-sized hall reads as empty).
const MW = 24, MH = 17, RW = 18, RH = 11;
const ox = (MW - RW) >> 1, oy = (MH - RH) >> 1;

const SETS = [
  { name: 'floors',  image: '../tileset/Room_Builder_Floors_32x32.png', cols: 15, tilecount: 15 * 40 },
  { name: 'walls',   image: '../tileset/Room_Builder_3d_walls_32x32.png', cols: 24, tilecount: 24 * 59 },
  { name: 'sky',     image: '../tileset/Room_Builder_Sky_32x32.png', cols: 1, tilecount: 1 },
  { name: 'kitchen', image: '../tileset/Kitchen_Modern_32x32.png', cols: 16, tilecount: 16 * 49 },
];
let g = 1; for (const s of SETS) { s.firstgid = g; g += s.tilecount; }
const FL = SETS[0].firstgid, WL = SETS[1].firstgid, SKY = SETS[2].firstgid, KI = SETS[3].firstgid;

// --- 3D wall room (grey material, cream floor) — same verified role map as gen-room2 ---
const FLOOR = 50;
const TL = 201, TR = 206, TL2 = 203, TR2 = 204, CAP = [227, 228], FACE = [251, 252];
const LWALL = 297, RWALL = 302, BL = 298, BR = 301, BOT = [299, 300];
const DOOR_W = 2, DOOR_L = 301, DOOR_R = 298;
const SHADOW = { tl: 4, top: 5, tr: 6, left: 19 };

const W = MW, H = MH;
const ground = new Array(W * H).fill(0);
const walls = new Array(W * H).fill(0);
const shadows = new Array(W * H).fill(0);
const furniture = new Array(W * H).fill(0);
const over = new Array(W * H).fill(0); // tall-object tops: above the player, no collision
const wput = (x, y, id) => { if (id != null) walls[y * W + x] = WL + id; };
const alt = (a, i) => a[i % a.length];

// sky everywhere, cream floor inside the room
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ground[y * W + x] = SKY;
for (let y = oy; y < oy + RH; y++) for (let x = ox; x < ox + RW; x++) ground[y * W + x] = FL + FLOOR;

// top wall band (2 rows) + corners
wput(ox, oy, TL); wput(ox + RW - 1, oy, TR);
wput(ox, oy + 1, TL2); wput(ox + RW - 1, oy + 1, TR2);
for (let x = ox + 1; x < ox + RW - 1; x++) { const i = (x - ox - 1) % 2; wput(x, oy, CAP[i]); wput(x, oy + 1, FACE[i]); }
// side walls
for (let y = oy + 2; y < oy + RH - 1; y++) { wput(ox, y, LWALL); wput(ox + RW - 1, y, RWALL); }
// bottom baseboard with centered door
const by = oy + RH - 1, dStart = ox + ((RW - DOOR_W) >> 1);
wput(ox, by, BL); wput(ox + RW - 1, by, BR);
for (let x = ox + 1; x < ox + RW - 1; x++) {
  if (x >= dStart && x < dStart + DOOR_W) continue;
  if (x === dStart - 1) { wput(x, by, DOOR_L); continue; }
  if (x === dStart + DOOR_W) { wput(x, by, DOOR_R); continue; }
  wput(x, by, alt(BOT, (x - ox - 1) % 2));
}
// floor-shadow overlay (top + left)
const ix0 = ox + 1, ix1 = ox + RW - 2, iy0 = oy + 2, iy1 = oy + RH - 2;
shadows[iy0 * W + ix0] = FL + SHADOW.tl;
for (let x = ix0 + 1; x <= ix1; x++) shadows[iy0 * W + x] = FL + SHADOW.top;
if (ix1 + 1 < W) shadows[iy0 * W + (ix1 + 1)] = FL + SHADOW.tr;
for (let y = iy0 + 1; y <= iy1; y++) shadows[y * W + ix0] = FL + SHADOW.left;

// --- kitchen furniture ---------------------------------------------------------
// Kitchen_Modern_32x32.png is 16 cols x 49 rows -> STRIDE = 16.
// Every object is placed as a COMPLETE rect from its top-left id. Footprints are
// ground-truth: template-matched the pack's per-object singles
// (Theme_Sorter_Singles_32x32/12_Kitchen_Singles_32x32) into the sheet, cross-checked
// with an 8-connected component scan + the navy-outline edge test. Verified footprints:
//   cupboard 3x3 @243 · counter pieces 1x1 @114(L end)/115/118/119(R end) · sink 2x1 @120
//   stove/oven 1x2 @184 · fridge 1x3 @377 · table 3x2 @281
//   chair facing RIGHT 1x2 @180 · chair facing LEFT 1x2 @212
// NOTE: several sheet objects are drawn CENTRED across their tile rect (e.g. the table's
// art is 60px wide inside a 3-tile/96px footprint), so the rect is wider than the ink.
// The full rect must still be placed or the object is clipped.
const KCOLS = 16;
const claimed = new Map(); // overlap guard: each furniture cell may be claimed once
const putRect = (x, y, w, h, id0, target = furniture, who = 'obj') => {
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const cx = x + c, cy = y + r, k = cy * W + cx;
    if (cx < ox + 1 || cx > ox + RW - 2 || cy < oy || cy > oy + RH - 2)
      throw new Error(`${who}: cell (${cx},${cy}) is outside the room interior`);
    if (claimed.has(k)) throw new Error(`${who}: cell (${cx},${cy}) already claimed by ${claimed.get(k)}`);
    claimed.set(k, who);
    target[k] = KI + id0 + r * KCOLS + c;
  }
};
// A tall object: its BASE row collides (Furniture); the rows above go to Over so the
// player is occluded walking behind it and can stand in that space.
const putTall = (x, y, w, h, id0, who = 'tall') => {
  putRect(x, y, w, h - 1, id0, over, who);                            // upper part -> Over
  putRect(x, y + h - 1, w, 1, id0 + (h - 1) * KCOLS, furniture, who); // base -> collides
};
// Back-wall furniture: base lands on the FIRST FLOOR ROW (oy+2) and the body covers the
// wall band, so there is no floor strip behind it.
const backWall = (x, w, h, id0, who, tall = true) => {
  const topRow = (oy + 2) - (h - 1);
  if (tall && h > 1) putTall(x, topRow, w, h, id0, who);
  else putRect(x, topRow, w, h, id0, furniture, who);
};

// --- back wall (base on the first floor row oy+2) ---
// Worktop: the 6 counter pieces 114..119 are sheet-adjacent and tile into one continuous
// run (left end / plain / drawers / drawers / plain / right end). The sink is a separate
// 48px-wide unit that sits at the end of the run — that is the pack's OWN arrangement
// (in the sheet the run occupies cols 2..7 and the sink 120/121 follows it at cols 8..9).
backWall(ox + 1, 3, 3, 243, 'cupboard');            // tall cupboard, left corner
for (let i = 0; i < 6; i++) backWall(ox + 5 + i, 1, 1, 114 + i, `counter${i}`);
backWall(ox + 11, 2, 1, 120, 'sink');               // sink, at the end of the worktop
backWall(ox + 14, 1, 2, 184, 'stove');              // stove/oven
backWall(ox + 16, 1, 3, 377, 'fridge');             // fridge

// Wall cupboards hung above the worktop. Only a 2-row sprite hangs correctly on the 2-row
// wall band: @122's art is 28px starting 12px down its rect, so on rows oy..oy+1 it sits
// wholly inside the wall band (no poking into the sky, no landing on the floor row).
for (const c of [5, 8, 11]) putRect(ox + c, oy, 2, 2, 122, furniture, `wall-cupboard@${c}`);

// --- dining set, centre of the room ---
const ty = oy + 5;
putRect(ox + 7, ty, 1, 2, 180, furniture, 'chair-L');   // chair facing RIGHT, left of table
putRect(ox + 8, ty, 3, 2, 281, furniture, 'table');     // kitchen table
putRect(ox + 11, ty, 1, 2, 212, furniture, 'chair-R');  // chair facing LEFT, right of table

// --- VERIFY: nothing collidable blocks the door; the interior is fully reachable -----
// Collision model: Walls + Furniture are solid; Ground/Shadows/Over never collide.
const solid = (x, y) => walls[y * W + x] !== 0 || furniture[y * W + x] !== 0;
const doorCells = [];
for (let i = 0; i < DOOR_W; i++) doorCells.push([dStart + i, by]);
for (const [dx, dy] of doorCells) {
  if (solid(dx, dy)) throw new Error(`door cell (${dx},${dy}) is SOLID — the room is unenterable`);
}
// flood-fill walkable tiles from OUTSIDE the room, below the door
const seen = new Set();
const start = [dStart, by + 2];
const stack = [start];
seen.add(start[1] * W + start[0]);
while (stack.length) {
  const [x, y] = stack.pop();
  for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    const k = ny * W + nx;
    if (seen.has(k) || solid(nx, ny)) continue;
    seen.add(k); stack.push([nx, ny]);
  }
}
for (const [dx, dy] of doorCells) {
  if (!seen.has(dy * W + dx)) throw new Error(`door cell (${dx},${dy}) unreachable from outside`);
}
// every non-solid interior floor cell must be reachable through that door
let free = 0, unreachable = 0;
for (let y = oy + 2; y <= oy + RH - 2; y++) for (let x = ox + 1; x <= ox + RW - 2; x++) {
  if (solid(x, y)) continue;
  free++;
  if (!seen.has(y * W + x)) { unreachable++; console.error(`  unreachable interior cell (${x},${y})`); }
}
if (unreachable) throw new Error(`${unreachable}/${free} interior floor cells unreachable through the door`);
// the door corridor itself (door columns, from the door up into the room) must be clear
for (let i = 0; i < DOOR_W; i++) for (let y = by; y >= by - 2; y--) {
  if (furniture[y * W + (dStart + i)] !== 0) throw new Error(`furniture in the door corridor at (${dStart + i},${y})`);
}
console.error(`door OK: gap ${DOOR_W} wide at x=${dStart}..${dStart + DOOR_W - 1}, y=${by}; ${free} interior floor cells all reachable`);
console.error(`furniture cells claimed: ${claimed.size}`);

const layer = (name, data) => ({ type: 'tilelayer', name, width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data });
const map = {
  type: 'map', version: '1.10', orientation: 'orthogonal', renderorder: 'right-down',
  width: W, height: H, tilewidth: 32, tileheight: 32, infinite: false, nextlayerid: 6, nextobjectid: 1,
  tilesets: SETS.map((s) => ({ firstgid: s.firstgid, name: s.name, image: s.image, imagewidth: s.cols * 32, imageheight: (s.tilecount / s.cols) * 32, tilewidth: 32, tileheight: 32, columns: s.cols, tilecount: s.tilecount, margin: 0, spacing: 0 })),
  layers: [layer('Ground', ground), layer('Shadows', shadows), layer('Walls', walls), layer('Furniture', furniture), layer('Over', over)],
  properties: [{ name: 'spawnX', type: 'int', value: (ox + RW / 2) * 32 }, { name: 'spawnY', type: 'int', value: (oy + RH - 2) * 32 }],
};
writeFileSync(out, JSON.stringify(map));
console.error(`kitchen ${RW}x${RH} in ${MW}x${MH} -> ${out}`);
