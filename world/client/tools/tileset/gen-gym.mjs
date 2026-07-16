// Gym = the 3D-walls room (see gen-room2) + a Furniture/Decor layer of LimeZu Modern
// Interiors GYM items (treadmills, exercise bike, weight bench, dumbbell + barbell racks,
// a big wall mirror, weight plates, a punching bag, exercise mats).
// Same recipe as gen-kitchen.mjs / gen-classroom.mjs. Preview with render-map.mjs.
// `node gen-gym.mjs <out.json>`.
import { writeFileSync } from 'node:fs';
const out = process.argv[2] || 'world/client/public/assets/map/gymMap.json';

// A gym hall: wider than the kitchen so a cardio line + a free-weights zone both fit.
const MW = 26, MH = 19, RW = 20, RH = 13;
const ox = (MW - RW) >> 1, oy = (MH - RH) >> 1;   // ox=3, oy=3

const SETS = [
  { name: 'floors', image: '../tileset/Room_Builder_Floors_32x32.png', cols: 15, tilecount: 15 * 40 },
  { name: 'walls',  image: '../tileset/Room_Builder_3d_walls_32x32.png', cols: 24, tilecount: 24 * 59 },
  { name: 'sky',    image: '../tileset/Room_Builder_Sky_32x32.png', cols: 1, tilecount: 1 },
  // Gym_Modern_32x32.png = the pack's Theme_Sorter_32x32/8_Gym_32x32.png, copied into the
  // COMMITTED assets/tileset/ dir (the modern_interiors/ pack is gitignored and never
  // reaches the server). 16 cols x 33 rows -> GCOLS = 16 is the putRect stride.
  { name: 'gym',    image: '../tileset/Gym_Modern_32x32.png', cols: 16, tilecount: 16 * 33 },
];
let g = 1; for (const s of SETS) { s.firstgid = g; g += s.tilecount; }
const FL = SETS[0].firstgid, WL = SETS[1].firstgid, SKY = SETS[2].firstgid, GY = SETS[3].firstgid;

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
const decor = new Array(W * H).fill(0);     // flat mats you WALK ON: over floor, under player
const furniture = new Array(W * H).fill(0);
const over = new Array(W * H).fill(0);      // tall-object tops: above the player, no collision
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

// --- gym furniture -------------------------------------------------------------
// Gym_Modern_32x32.png is 16 cols x 33 rows -> STRIDE = 16. Rows 21+ are the pack's
// "REVAMPED STUFF" (its own banner at row 19) — the newer art; everything below is from
// there. Every object is placed as a COMPLETE rect from its top-left id.
//
// FOOTPRINTS ARE GROUND-TRUTH, derived with all three sources + a render:
//  (1) template-matched the pack's SHADOWLESS singles into the SHADOWLESS sheet
//      (Theme_Sorter_Shadowless_Singles_32x32/8_Gym_Singles_Shadowless_32x32). NOTE: the
//      singles are re-encoded and differ from the sheet by up to 1/channel, so the anchor
//      index must be TOLERANT — an exact-colour anchor lookup silently returns 0 hits.
//      Several objects ship as multiple singles = the object + its COLOUR VARIANTS: only
//      one variant matches the sheet (bad ~0), the others miss by hundreds of px, but they
//      all agree on the RECT (e.g. #186/#187 -> id490; #192/#193/#194 -> id484).
//  (2) 8-connected flood fill of the shadowed sheet. It OVER-MERGES here (the balls and the
//      mat block at rows 26-28 fuse into one 6x3 blob; mats 441+442 fuse into a 2x3), so it
//      is only used where it agrees with the singles.
//  (3) navy-outline test (LimeZu outlines every FINISHED edge, lum < 95) + a
//      transparent-gap-then-more-art scan below each rect (catches alternative-texture
//      variants that would make a rect TOO BIG — e.g. id340's rect stops at row 22; the
//      mirror at row 23 below it is a separate object).
//
// Verified footprints (0-based id, w x h):
//   wall mirror = MODULAR 1x2 segments @340 (L) / @341 (mid, repeatable) / @342 (R) — see
//                 putMirror below; the sheet's own assembled copy is a closed 3x2 at @340
//   treadmill 2x3 @490 · exercise bike 2x2 @486 · weight bench 2x3 @484
//   dumbbell racks 2x2 @404 and @408 · barbell rack 2x2 @402 · weight plates 2x2 @377
//   punching bag 1x2 @478 · green mat 2x1 @433 · green mat 1x2 @435 · radio 1x1 @525
//
// THE PUNCHING BAG IS THE CASE THAT PROVES "RENDER AND LOOK". Flood fill called @478 a 1x4
// (one contiguous 30x106 component) and the gap-below scan agreed, because the sheet stacks
// the bag's HANGING variant (@510) directly underneath it with ZERO transparent gap — so
// neither the blob nor the gap test could separate them. Only the render showed it: two
// stacked bags, each with its own cap, red patch and rounded foot. The single (#179 -> 1x2)
// was right all along. @415/@447 are the same trap. The bag is 1x2.
//
// SHEET QUIRK (measured, and the reason step (1) is safe at all): the shadowed and
// shadowless sheets are tile-for-tile identical EXCEPT ONE tile — the orange 2x1 mat sits at
// c0-c1 shadowless but c1-c2 (@465) shadowed. So ids matched against the shadowless sheet
// transfer to the shadowed sheet the map actually uses, EXCEPT for that mat (unused here).
const GCOLS = 16;
const claimed = new Map(); // overlap guard: each cell may be claimed once across ALL layers
const putRect = (x, y, w, h, id0, target = furniture, who = 'obj') => {
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const cx = x + c, cy = y + r, k = cy * W + cx;
    if (cx < ox + 1 || cx > ox + RW - 2 || cy < oy || cy > oy + RH - 2)
      throw new Error(`${who}: cell (${cx},${cy}) is outside the room interior`);
    if (claimed.has(k)) throw new Error(`${who}: cell (${cx},${cy}) already claimed by ${claimed.get(k)}`);
    claimed.set(k, who);
    target[k] = GY + id0 + r * GCOLS + c;
  }
};
// A tall object: its BASE row collides (Furniture); the rows above go to Over so the player
// is occluded walking behind it and can stand in that space.
const putTall = (x, y, w, h, id0, who = 'tall') => {
  putRect(x, y, w, h - 1, id0, over, who);                            // upper part -> Over
  putRect(x, y + h - 1, w, 1, id0 + (h - 1) * GCOLS, furniture, who); // base -> collides
};
// The mirror is MODULAR along its width: @340 = left cap, @341 = middle (repeatable),
// @342 = right cap — each a 1x2 segment. Confirmed three ways: the pack ships them as three
// separate singles (#128/#129/#130) and #129 matches the sheet at BOTH c5 and c7 (identical
// art); the navy test finds @341's left AND right edges BARE (art bleeds to both tile
// boundaries => it continues into the neighbour = a middle piece), while the assembled
// @340..@342 flood-fills as ONE closed 3x2 blob whose art is 92px wide inside 96px (i.e. a
// frame on both outer sides). So any width >= 2 tiles is buildable, not just the sheet's 3.
const putMirror = (x, y, w, who = 'mirror') => {
  if (w < 2) throw new Error(`${who}: mirror must be >= 2 wide (needs a left AND a right cap)`);
  putRect(x, y, 1, 2, 340, furniture, `${who}-L`);
  for (let i = 1; i < w - 1; i++) putRect(x + i, y, 1, 2, 341, furniture, `${who}-M${i}`);
  putRect(x + w - 1, y, 1, 2, 342, furniture, `${who}-R`);
};

// --- WHERE EACH OBJECT GOES (read what the sprite is DRAWN as) ---
// * The mirror is drawn as a framed glass panel with NO legs and no ground shadow =>
//   WALL-MOUNTED. Its segments are 1x2, so it fits the 2-row wall band exactly (oy = cap,
//   oy+1 = face) — the 1x2 rule: it is the only height that hangs correctly. Both of its rows
//   are wall, which the Walls layer already makes solid, so putting it wholly on Furniture
//   adds no obstacle and no stray floor blocker (same as gen-kitchen's wall cupboards).
// * The machines (@490 treadmill, @486 bike, @404/@402 racks) are TOP-DOWN / full-height art
//   with topPad = 0 (measured: their art starts at the very first pixel row of their rect).
//   The (oy+2)-(h-1) back-wall formula is for sprites with a transparent top pad; applying it
//   here would push the art up over the wall cap. They START at the first floor row (oy+2),
//   so their top edge touches the wall base => flush against the back wall, no floor strip.
const FLOOR0 = oy + 2;  // first floor row = 5

// Room zones: cardio along the LEFT of the back wall, the mirrored free-weights area on the
// RIGHT, and a clear central aisle on the door columns (12-13) from the door to the back.
// wall band: the mirror wall, above the free-weights area
putMirror(ox + 11, oy, 6);                                       // cols 14-19, rows 3-4

// back wall: the cardio line + the free-weights corner (top row on the first floor row)
putTall(ox + 1, FLOOR0, 2, 3, 490, 'treadmill-1');               // cols 4-5,  rows 5-7
putTall(ox + 4, FLOOR0, 2, 3, 490, 'treadmill-2');               // cols 7-8,  rows 5-7
putTall(ox + 7, FLOOR0, 2, 2, 486, 'exercise-bike');             // cols 10-11, rows 5-6
putTall(ox + 11, FLOOR0, 2, 2, 404, 'dumbbell-rack-1');          // cols 14-15, rows 5-6 (under the mirror)
putTall(ox + 14, FLOOR0, 2, 2, 408, 'dumbbell-rack-2');          // cols 17-18, rows 5-6 (under the mirror)
putTall(ox + 17, FLOOR0, 1, 2, 478, 'punching-bag');             // col 20,    rows 5-6

// free-weights floor
putTall(ox + 1, oy + 6, 2, 2, 402, 'barbell-rack');              // cols 4-5,  rows 9-10
putTall(ox + 4, oy + 6, 2, 3, 484, 'weight-bench-1');            // cols 7-8,  rows 9-11
putTall(ox + 7, oy + 6, 2, 2, 377, 'weight-plates-1');           // cols 10-11, rows 9-10
putTall(ox + 11, oy + 6, 2, 3, 484, 'weight-bench-2');           // cols 14-15, rows 9-11
putTall(ox + 14, oy + 6, 2, 2, 377, 'weight-plates-2');          // cols 17-18, rows 9-10
putRect(ox + 1, oy + 9, 1, 1, 525, furniture, 'radio');          // col 4,     row 12

// --- Decor: the exercise mats. Flat decals you WALK ON -> the Decor layer (over the floor,
// under the player, never colliding). On Furniture a mat would be an invisible wall.
// GREEN, not the grey @441/@442 family: rendered, a block of the grey mats reads as a pit in
// the floor rather than as a mat. The green ones are unmistakable.
putRect(ox + 14, oy + 9, 1, 2, 435, decor, 'mat-green-1');       // col 17, rows 12-13
putRect(ox + 15, oy + 9, 1, 2, 435, decor, 'mat-green-2');       // col 18, rows 12-13
putRect(ox + 1, oy + 10, 2, 1, 433, decor, 'mat-green-3');       // cols 4-5, row 13

// --- VERIFY: nothing collidable blocks the door; the interior is fully reachable -----
// Collision model: Walls + Furniture are solid; Ground/Shadows/Decor/Over never collide.
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
// the spawn tile must itself be walkable and reachable (it is where players appear)
const spawnTX = ox + RW / 2, spawnTY = oy + RH - 2;
if (solid(spawnTX, spawnTY)) throw new Error(`spawn tile (${spawnTX},${spawnTY}) is SOLID`);
if (!seen.has(spawnTY * W + spawnTX)) throw new Error(`spawn tile (${spawnTX},${spawnTY}) is unreachable`);
console.error(`door OK: gap ${DOOR_W} wide at x=${dStart}..${dStart + DOOR_W - 1}, y=${by}; ${free} interior floor cells all reachable`);
console.error(`spawn OK: tile (${spawnTX},${spawnTY}) walkable + reachable`);
console.error(`cells claimed: ${claimed.size}`);

const layer = (name, data) => ({ type: 'tilelayer', name, width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data });
const map = {
  type: 'map', version: '1.10', orientation: 'orthogonal', renderorder: 'right-down',
  width: W, height: H, tilewidth: 32, tileheight: 32, infinite: false, nextlayerid: 7, nextobjectid: 1,
  tilesets: SETS.map((s) => ({ firstgid: s.firstgid, name: s.name, image: s.image, imagewidth: s.cols * 32, imageheight: (s.tilecount / s.cols) * 32, tilewidth: 32, tileheight: 32, columns: s.cols, tilecount: s.tilecount, margin: 0, spacing: 0 })),
  layers: [layer('Ground', ground), layer('Shadows', shadows), layer('Decor', decor), layer('Walls', walls), layer('Furniture', furniture), layer('Over', over)],
  properties: [{ name: 'spawnX', type: 'int', value: (ox + RW / 2) * 32 }, { name: 'spawnY', type: 'int', value: (oy + RH - 2) * 32 }],
};
writeFileSync(out, JSON.stringify(map));
console.error(`gym ${RW}x${RH} in ${MW}x${MH} -> ${out}`);
