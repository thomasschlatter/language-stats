// Classroom = the 3D-walls room (see gen-room2) + a Furniture layer of LimeZu Modern
// Interiors classroom items (green chalkboard, student desks, bookshelves). Furniture
// items are 2-tile-tall (top id over bottom id). Preview with render-map.mjs.
// `node gen-classroom.mjs <out.json>`.
import { writeFileSync } from 'node:fs';
const out = process.argv[2] || 'world/client/public/assets/map/classroomModernMap.json';

const MW = 26, MH = 24, RW = 18, RH = 17;
const ox = (MW - RW) >> 1, oy = (MH - RH) >> 1;

const SETS = [
  { name: 'floors', image: '../tileset/Room_Builder_Floors_32x32.png', cols: 15, tilecount: 15 * 40 },
  { name: 'walls',  image: '../tileset/Room_Builder_3d_walls_32x32.png', cols: 24, tilecount: 24 * 59 },
  { name: 'sky',    image: '../tileset/Room_Builder_Sky_32x32.png', cols: 1, tilecount: 1 },
  { name: 'class',  image: '../tileset/Classroom_Modern_32x32.png', cols: 16, tilecount: 16 * 34 },
];
let g = 1; for (const s of SETS) { s.firstgid = g; g += s.tilecount; }
const FL = SETS[0].firstgid, WL = SETS[1].firstgid, SKY = SETS[2].firstgid, CL = SETS[3].firstgid;

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

// --- classroom furniture -------------------------------------------------------
// The Classroom sheet is 16 cols. Every object is a RECT taken from its top-left id,
// so it is always placed COMPLETE (never clipped). Verified footprints:
//   chalkboard 2x2 @90 · library 3x3 @208 · teacher desk 2x2 @21 · globe 1x2 @29
//   plain desk 1x2 @18 · chair (backrest to us → student faces the board) 1x2 @50
// Objects are spaced so every neighbouring cell (left/right/above/below) stays free.
const CLCOLS = 16;
const putRect = (x, y, w, h, id0, target = furniture) => {
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++)
    target[(y + r) * W + (x + c)] = CL + id0 + r * CLCOLS + c;
};
// A tall object: its BASE row collides (Furniture); the rows above it go to Over so the
// player is occluded walking behind it and can stand in that space.
const putTall = (x, y, w, h, id0) => {
  putRect(x, y, w, h - 1, id0, over);                            // upper part -> Over
  putRect(x, y + h - 1, w, 1, id0 + (h - 1) * CLCOLS, furniture); // base -> collides
};
const cx = ox + (RW >> 1);

putRect(cx - 1, oy + 2, 2, 2, 90);        // green chalkboard, front-centre
putTall(ox + 1, oy, 3, 3, 208);           // library against the back wall: top is Over, base collides
putRect(cx + 3, oy + 2, 2, 2, 21);        // teacher's desk, right of the board
putRect(cx + 6, oy + 2, 1, 2, 29);        // globe
putTall(ox + RW - 4, oy + 6, 3, 3, 208);  // second library: top is Over, base collides

// student seats facing the board: desk with its chair behind it (4 tall per seat)
for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
  const dx = ox + 3 + c * 3, dy = oy + 6 + r * 5;
  putRect(dx, dy, 1, 2, 18);              // desk
  putRect(dx, dy + 2, 1, 2, 50);          // chair — student faces north, at the board
}

const layer = (name, data) => ({ type: 'tilelayer', name, width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data });
const map = {
  type: 'map', version: '1.10', orientation: 'orthogonal', renderorder: 'right-down',
  width: W, height: H, tilewidth: 32, tileheight: 32, infinite: false, nextlayerid: 5, nextobjectid: 1,
  tilesets: SETS.map((s) => ({ firstgid: s.firstgid, name: s.name, image: s.image, imagewidth: s.cols * 32, imageheight: (s.tilecount / s.cols) * 32, tilewidth: 32, tileheight: 32, columns: s.cols, tilecount: s.tilecount, margin: 0, spacing: 0 })),
  layers: [layer('Ground', ground), layer('Shadows', shadows), layer('Walls', walls), layer('Furniture', furniture), layer('Over', over)],
  properties: [{ name: 'spawnX', type: 'int', value: (ox + RW / 2) * 32 }, { name: 'spawnY', type: 'int', value: (oy + RH - 2) * 32 }],
};
writeFileSync(out, JSON.stringify(map));
console.error(`classroom ${RW}x${RH} in ${MW}x${MH} -> ${out}`);
