// Simple room from Room_Builder_borders_32x32.png (thin-outline wall borders) + a
// cream floor interior + sky surround. 9-slice placed by ROLE. FIRST-GUESS tile ids
// for the beige style — refine via render-map.mjs preview. `node gen-border-room.mjs <out>`.
import { writeFileSync } from 'node:fs';
const out = process.argv[2] || 'world/client/public/assets/map/borderRoomMap.json';

const MW = 30, MH = 22, RW = 18, RH = 10;
const ox = (MW - RW) >> 1, oy = (MH - RH) >> 1;

const SETS = [
  { name: 'floors',  image: '../tileset/Room_Builder_Floors_32x32.png', cols: 15, tilecount: 15 * 40 },
  { name: 'borders', image: '../tileset/Room_Builder_borders_32x32.png', cols: 45, tilecount: 45 * 10 },
  { name: 'sky',     image: '../tileset/Room_Builder_Sky_32x32.png', cols: 1, tilecount: 1 },
  { name: 'wallpaper', image: '../tileset/Room_Builder_Walls_32x32.png', cols: 32, tilecount: 32 * 40 },
];
let g = 1; for (const s of SETS) { s.firstgid = g; g += s.tilecount; }
const FL = SETS[0].firstgid, BD = SETS[1].firstgid, SKY = SETS[2].firstgid, WP = SETS[3].firstgid;
// wallpaper: a 2-tile-tall strip (top id + face id) drawn along the upper wall
const WALLPAPER = { top: 12, face: 44 };

const FLOOR = 50;
// Thin-line border 9-slice (0-based ids), confirmed by user tile-by-tile.
// bottom row still TBD (null = leave open until confirmed).
// White wall-top border 9-slice — absolute ids. Corners confirmed by user (278/276);
// edges + door start as the +270 shift of the tan set ("nearly correct"), refine via preview.
const R = { tl: 276, tr: 278, t: 322, l: 321, r: 323, bl: 366, b: 367, br: 368, doorL: 272, doorR: 273 };
// thin floor-shadow overlay ids (FLOORS sheet): TL corner / top / TR corner / left edge
const SHADOW = { tl: 0, top: 1, tr: 2, left: 15 };

const W = MW, H = MH;
const ground = new Array(W * H).fill(0);
const walls = new Array(W * H).fill(0);
const over = new Array(W * H).fill(0); // foreground layer: renders above the player, no collision
const bput = (x, y, id) => { if (id != null) walls[y * W + x] = BD + id; };
const oput = (x, y, id) => { if (id != null) over[y * W + x] = BD + id; };

// door span (used by both the floor threshold and the bottom wall)
const dGap = 1;                       // opening width (tiles of floor you walk through)
const dcL = ox + (RW >> 1) - 1;       // left jamb column
const dcR = dcL + dGap + 1;           // right jamb column
const inDoorSpan = (x) => x >= dcL && x <= dcR;

// sky everywhere; cream floor ONLY inside the walls (+ the doorway threshold)
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ground[y * W + x] = SKY;
for (let y = oy + 1; y < oy + RH - 1; y++) for (let x = ox + 1; x < ox + RW - 1; x++) ground[y * W + x] = FL + FLOOR;
for (let x = dcL + 1; x < dcR; x++) ground[(oy + RH - 1) * W + x] = FL + FLOOR; // doorway threshold

// border ring — side walls run all the way down (bottom corners fall back to the wall tile)
bput(ox, oy, R.tl); bput(ox + RW - 1, oy, R.tr);
bput(ox, oy + RH - 1, R.bl ?? R.l); bput(ox + RW - 1, oy + RH - 1, R.br ?? R.r);
for (let x = ox + 1; x < ox + RW - 1; x++) {
  bput(x, oy, R.t);
  if (!inDoorSpan(x)) bput(x, oy + RH - 1, R.b); // bottom wall, skipping the door span
}
for (let y = oy + 1; y < oy + RH - 1; y++) { bput(ox, y, R.l); bput(ox + RW - 1, y, R.r); }

// door jambs flank the gap; gap columns stay empty so the floor shows through (walkable)
bput(dcL, oy + RH - 1, R.doorL); bput(dcR, oy + RH - 1, R.doorR);

// thin floor-shadow overlay along the top + left interior edges
const shadows = new Array(W * H).fill(0);
const sput = (x, y, id) => { if (id != null) shadows[y * W + x] = FL + id; };
const ix0 = ox + 1, ix1 = ox + RW - 2, iy0 = oy + 2, iy1 = oy + RH - 2; // iy0 = floor row below the 2-tile wallpaper
sput(ix0, iy0, SHADOW.tl);
for (let x = ix0 + 1; x <= ix1; x++) sput(x, iy0, SHADOW.top);
sput(ix1 + 1, iy0, SHADOW.tr);
for (let y = iy0 + 1; y <= iy1; y++) sput(ix0, y, SHADOW.left);

// wallpaper along the upper wall: 2-tile-tall band (top row + patterned face row)
const wallpaper = new Array(W * H).fill(0);
for (let x = ox + 1; x < ox + RW - 1; x++) {
  wallpaper[oy * W + x] = WP + WALLPAPER.top;
  wallpaper[(oy + 1) * W + x] = WP + WALLPAPER.face;
}


// left-right separator, built top-down (user-directed, tile per row)
const sCol = ox + 5;   // column 11 — clears the bottom-center door
const sEnd = oy + 5;   // bottom of the (shortened) separator wall; passage below it
bput(sCol, oy, 235);                                          // top: borders row6 nr11, in the upper wall
for (let y = oy + 1; y < sEnd - 1; y++) bput(sCol, y, 280);   // body: borders row7 nr11 (shorter)
// separator cap = nr4 of the SAME wallpaper as the upper wall (relative: main is nr2, so nr4 = +2)
wallpaper[(sEnd - 1) * W + sCol] = WP + WALLPAPER.top + 2;    // nr4 top
wallpaper[sEnd * W + sCol] = WP + WALLPAPER.face + 2;         // nr4 face
// shadow for the T-extension cap, from the SHADOW sheet: nr2 (id1) + nr3 (id2) on its right
sput(sCol, sEnd + 1, SHADOW.top);      // shadow nr2 (id 1)
sput(sCol + 1, sEnd + 1, SHADOW.tr);   // shadow nr3 (id 2) on its right
bput(sCol, oy + RH - 1, 364);                                 // T-junction into the bottom wall (row9 nr5)
bput(sCol, oy + RH - 2, 327);                                 // stub extension up from below (row8 nr13)
oput(sCol, oy + RH - 3, 319);                                 // stub TOP → Over layer (above player, no collision)
// separator casts a thin shadow down its right side (acts as a left wall for the right room)
sput(sCol + 1, oy + 2, SHADOW.tl); // corner where the separator meets the upper wall (right side) — shadows nr1 (id 0)
for (let y = oy + 3; y <= sEnd; y++) sput(sCol + 1, y, SHADOW.left);

const layer = (name, data) => ({ type: 'tilelayer', name, width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data });
const map = {
  type: 'map', version: '1.10', orientation: 'orthogonal', renderorder: 'right-down',
  width: W, height: H, tilewidth: 32, tileheight: 32, infinite: false, nextlayerid: 3, nextobjectid: 1,
  tilesets: SETS.map((s) => ({ firstgid: s.firstgid, name: s.name, image: s.image, imagewidth: s.cols * 32, imageheight: (s.tilecount / s.cols) * 32, tilewidth: 32, tileheight: 32, columns: s.cols, tilecount: s.tilecount, margin: 0, spacing: 0 })),
  layers: [layer('Ground', ground), layer('Shadows', shadows), layer('Wallpaper', wallpaper), layer('Walls', walls), layer('Over', over)],
  properties: [{ name: 'spawnX', type: 'int', value: (ox + RW / 2) * 32 }, { name: 'spawnY', type: 'int', value: (oy + RH / 2) * 32 }],
};
writeFileSync(out, JSON.stringify(map));
console.error(`border-room ${RW}x${RH} in ${MW}x${MH} -> ${out}`);
