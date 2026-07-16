// Ice Cream Shop = the 3D-walls room (see gen-room2) + a Furniture layer of LimeZu Modern
// Interiors "24_Ice_Cream_Shop" items (display freezer with the tubs, service counter, till,
// hanging menu board, cafe tables + chairs, cone standee). Preview with render-map.mjs.
// `node gen-icecream.mjs <out.json>`.
//
// FOOTPRINTS ARE DERIVED, NEVER GUESSED. Every rect below was cross-checked three ways
// against world/client/public/assets/modern_interiors/Theme_Sorter_32x32/24_Ice_Cream_Shop_32x32.png:
//   1. template-matching the pack's per-object singles (Theme_Sorter_Singles_32x32/
//      24_Ice_Cream_Shop_Singles_32x32/) back into the sheet,
//   2. flood-filling the sheet's connected opaque components for their tile bounding boxes,
//   3. the navy-outline / clip test: an object's LEFT/RIGHT/TOP edge must not have opaque
//      pixels continuing across the tile boundary (a bare BOTTOM edge is ground contact).
// Where they disagreed, (3) + a rendered crop decided:
//   * the freezer (@90) and the service counter (@12) ship as 1-tile-wide MODULAR segments in
//     the singles dir — placing a single segment CLIPS it (right edge continues). The whole
//     objects are 5x2 @90 and 3x2 @12.
//   * the cone standee is 1x2 @80 (single #75). Flood fill says 1x3 because a small ice-cream
//     cup (@112) is drawn TOUCHING the standee's base — taking 1x3 dragged that stray cup in
//     (the first preview showed it). A bare BOTTOM edge is ground contact, not a clip.
import { writeFileSync } from 'node:fs';
const out = process.argv[2] || 'world/client/public/assets/map/iceCreamMap.json';

// A little tighter than the classroom (18x17): with this much furniture a 16x15 room reads
// as a cosy parlour instead of a hall with a big empty middle.
const MW = 26, MH = 24, RW = 16, RH = 15;
const ox = (MW - RW) >> 1, oy = (MH - RH) >> 1; // ox=5, oy=4

const SETS = [
  { name: 'floors',   image: '../tileset/Room_Builder_Floors_32x32.png', cols: 15, tilecount: 15 * 40 },
  { name: 'walls',    image: '../tileset/Room_Builder_3d_walls_32x32.png', cols: 24, tilecount: 24 * 59 },
  { name: 'sky',      image: '../tileset/Room_Builder_Sky_32x32.png', cols: 1, tilecount: 1 },
  { name: 'icecream', image: '../tileset/IceCream_Modern_32x32.png', cols: 16, tilecount: 16 * 17 },
];
let g = 1; for (const s of SETS) { s.firstgid = g; g += s.tilecount; }
const FL = SETS[0].firstgid, WL = SETS[1].firstgid, SKY = SETS[2].firstgid, IC = SETS[3].firstgid;

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

// --- ice cream shop furniture ---------------------------------------------------
// The Ice_Cream_Shop sheet is 16 COLS -> that is the stride for stepping a rect's rows.
const ICCOLS = 16;
// Overlap guard: every furniture/over cell may be claimed exactly once.
const claimed = new Map();
const claim = (x, y, what) => {
  const k = y * W + x;
  if (claimed.has(k)) throw new Error(`overlap at (${x},${y}): ${claimed.get(k)} vs ${what}`);
  if (x < ox + 1 || x > ox + RW - 2 || y < oy || y > oy + RH - 2)
    throw new Error(`${what} out of bounds at (${x},${y})`);
  claimed.set(k, what);
};
const putRect = (x, y, w, h, id0, what, target = furniture) => {
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    claim(x + c, y + r, what);
    target[(y + r) * W + (x + c)] = IC + id0 + r * ICCOLS + c;
  }
};
// A tall object: its BASE row collides (Furniture); the rows above go to Over so the player
// is occluded walking behind it and can stand in that space.
const putTall = (x, y, w, h, id0, what) => {
  for (let r = 0; r < h - 1; r++) for (let c = 0; c < w; c++) {
    claim(x + c, y + r, what);
    over[(y + r) * W + (x + c)] = IC + id0 + r * ICCOLS + c;
  }
  for (let c = 0; c < w; c++) {
    claim(x + c, y + h - 1, what);
    furniture[(y + h - 1) * W + (x + c)] = IC + id0 + (h - 1) * ICCOLS + c;
  }
};
// Back-wall rule: base lands on the FIRST FLOOR ROW (oy+2) and the body covers the wall
// band, so there is never a floor strip peeking out behind the object.
const BASE = oy + 2;                       // 5
const backTop = (h) => BASE - (h - 1);

// ---- serving line along the back wall (base row 5), left -> right, one empty col between.
// Reads as: flavours -> order here -> pay -> menu -> one more case. The service counter sits
// at the head of the door aisle (cols 12-13), so you walk in and straight up to it.
putTall(ox + 1, backTop(2), 5, 2, 90, 'display freezer');   // cols 6-10 : 10 flavour tubs + striped front
putTall(ox + 7, backTop(2), 3, 2, 12, 'service counter');   // cols 12-14: glass counter you order at
putTall(ox + 11, backTop(2), 1, 2, 15, 'till');             // col  16   : till / POS unit
putTall(ox + 13, backTop(3), 2, 3, 10, 'menu board');       // cols 18-19: hanging yellow menu, bracket on the wall cap

// ---- cafe seating: chair(faces right) | table (2 wide) | chair(faces left) = 4x2
const tableSet = (x, y, n) => {
  putRect(x, y, 1, 2, 82, `chair L ${n}`);        // backrest on its left  -> customer faces right
  putRect(x + 1, y, 2, 2, 135, `table ${n}`);
  putRect(x + 3, y, 1, 2, 81, `chair R ${n}`);    // backrest on its right -> customer faces left
};
// Rows 7-8 stay empty: that is the queueing / ordering space in front of the counter.
tableSet(ox + 1, oy + 5, 'A');    // cols 6-9,   rows 9-10
tableSet(ox + 11, oy + 5, 'B');   // cols 16-19, rows 9-10
tableSet(ox + 1, oy + 9, 'C');    // cols 6-9,   rows 13-14
tableSet(ox + 11, oy + 9, 'D');   // cols 16-19, rows 13-14

// ---- decor along the front wall, all based on the last floor row (17).
// The door corridor is cols 12-13; the two standees flank it (cols 10 and 15) to frame
// the entrance, leaving cols 11 and 14 empty on either side of the corridor.
putRect(ox + 1, oy + 12, 2, 2, 48, 'toppings bar');     // cols 6-7,   rows 16-17
putTall(ox + 5, oy + 12, 1, 2, 80, 'cone standee L');   // col 10,     rows 16-17
putTall(ox + 10, oy + 12, 1, 2, 80, 'cone standee R');  // col 15,     rows 16-17
putRect(ox + 13, oy + 12, 2, 2, 133, 'drinks counter'); // cols 18-19, rows 16-17

// --- verification: the door corridor + interior must stay walkable -----------------
// Collision model (Game.buildShop): Walls collide AND every non-empty Furniture tile
// collides. Over never collides. So walkable = no wall tile and no furniture tile.
const solid = (x, y) => walls[y * W + x] !== 0 || furniture[y * W + x] !== 0;
const seen = new Set();
const q = [];
for (let x = dStart; x < dStart + DOOR_W; x++) {
  if (solid(x, by)) throw new Error(`door gap (${x},${by}) is BLOCKED`);
  seen.add(by * W + x); q.push([x, by]);
}
while (q.length) {
  const [x, y] = q.pop();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy;
    if (nx < ox || nx >= ox + RW || ny < oy || ny >= oy + RH) continue;
    const k = ny * W + nx;
    if (seen.has(k) || solid(nx, ny)) continue;
    seen.add(k); q.push([nx, ny]);
  }
}
// every non-solid interior floor cell must be reachable from the door
let unreachable = 0;
for (let y = oy + 2; y <= oy + RH - 2; y++) for (let x = ox + 1; x <= ox + RW - 2; x++)
  if (!solid(x, y) && !seen.has(y * W + x)) { unreachable++; console.error(`  unreachable floor (${x},${y})`); }
if (unreachable) throw new Error(`${unreachable} floor cells unreachable from the door`);
// nothing solid in the straight corridor from the door up to the queueing space
for (let y = oy + 3; y <= by - 1; y++) for (let x = dStart; x < dStart + DOOR_W; x++)
  if (solid(x, y)) throw new Error(`door corridor blocked at (${x},${y})`);
// no floor strip behind back-wall furniture: the first floor row under each must be claimed
for (const [x0, w] of [[ox + 1, 5], [ox + 7, 3], [ox + 11, 1], [ox + 13, 2]])
  for (let x = x0; x < x0 + w; x++)
    if (!claimed.has(BASE * W + x)) throw new Error(`floor gap behind back-wall furniture at (${x},${BASE})`);
console.error(`verified: door gap clear, ${seen.size} walkable cells reachable, no floor gaps`);

const layer = (name, data) => ({ type: 'tilelayer', name, width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data });
const map = {
  type: 'map', version: '1.10', orientation: 'orthogonal', renderorder: 'right-down',
  width: W, height: H, tilewidth: 32, tileheight: 32, infinite: false, nextlayerid: 6, nextobjectid: 1,
  tilesets: SETS.map((s) => ({ firstgid: s.firstgid, name: s.name, image: s.image, imagewidth: s.cols * 32, imageheight: (s.tilecount / s.cols) * 32, tilewidth: 32, tileheight: 32, columns: s.cols, tilecount: s.tilecount, margin: 0, spacing: 0 })),
  layers: [layer('Ground', ground), layer('Shadows', shadows), layer('Walls', walls), layer('Furniture', furniture), layer('Over', over)],
  properties: [{ name: 'spawnX', type: 'int', value: (ox + RW / 2) * 32 }, { name: 'spawnY', type: 'int', value: (oy + RH - 2) * 32 }],
};
writeFileSync(out, JSON.stringify(map));
console.error(`ice cream shop ${RW}x${RH} in ${MW}x${MH} -> ${out}`);
