// Museum = the 3D-walls room (see gen-room2) + a Furniture layer of LimeZu Modern
// Interiors museum items: a gallery wall of framed paintings, plinth exhibits (statues,
// vases, crystal), two dinosaur skeletons, rope barriers, benches, an info sign, plants.
// Same recipe as gen-kitchen.mjs / gen-classroom.mjs. Preview with render-map.mjs.
// `node gen-museum.mjs <out.json>`.
import { writeFileSync } from 'node:fs';
const out = process.argv[2] || 'world/client/public/assets/map/museumMap.json';

// A gallery hall: wide enough to walk around free-standing exhibits, deep enough for
// a back-wall row + a barrier row + a centrepiece row + seating.
const MW = 26, MH = 21, RW = 20, RH = 15;
const ox = (MW - RW) >> 1, oy = (MH - RH) >> 1;

const SETS = [
  { name: 'floors',  image: '../tileset/Room_Builder_Floors_32x32.png', cols: 15, tilecount: 15 * 40 },
  { name: 'walls',   image: '../tileset/Room_Builder_3d_walls_32x32.png', cols: 24, tilecount: 24 * 59 },
  { name: 'sky',     image: '../tileset/Room_Builder_Sky_32x32.png', cols: 1, tilecount: 1 },
  { name: 'museum',  image: '../tileset/Museum_Modern_32x32.png', cols: 16, tilecount: 16 * 122 },
];
let g = 1; for (const s of SETS) { s.firstgid = g; g += s.tilecount; }
const FL = SETS[0].firstgid, WL = SETS[1].firstgid, SKY = SETS[2].firstgid, MU = SETS[3].firstgid;

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
const decor = new Array(W * H).fill(0);      // floor decals (walk-on, never collides)
const furniture = new Array(W * H).fill(0);
const over = new Array(W * H).fill(0);       // tall-object tops: above the player, no collision
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

// --- museum furniture ----------------------------------------------------------------
// Museum_Modern_32x32.png is 16 cols x 122 rows -> STRIDE = 16.
// Footprints are ground-truth: every rect below was derived by REQUIRING AGREEMENT of
//   (1) template-matching the pack's shadowless per-object singles
//       (Theme_Sorter_Shadowless_Singles_32x32/22_Museum_Singles_Shadowless_32x32) into the
//       shadowless sheet with a rare-colour anchor + exact stencil verify,
//   (2) the navy-outline / edge-ink test (a bare LEFT or RIGHT edge running to the tile
//       boundary with ink in the neighbouring column = clipped),
//   (3) an 8-connected flood fill over the shadowless sheet, tile-snapped,
// and then RENDERING the map and looking at it. Where the sources disagreed the singles won:
//   * stone statue @802/@804: flood said 2x4, the single says 2x3 — the 4th row is the HEAD
//     of the next statue variant below, which touches the plinth across a zero gutter.
//     Rendered both: 2x4 visibly grows a second head. 2x3 is correct.
//   * info sign @630: flood said 10x4 — it over-merged the whole sign+planter strip. The
//     single says 1x2 (the long-post variant; @613/@629 are two 1x1 short-post variants
//     stacked with no gutter, which is what fooled the flood fill).
//   * portraits @409/@412: flood said one 4x2 blob — four 1x2 paintings hung side by side.
//   * Mona Lisa is @444 2x3 (not @460 2x2 — that crop decapitates the frame). NOT USED:
//     3 rows of art cannot fit the 2-row wall band, it would poke into the sky.
const MCOLS = 16;
const claimed = new Map(); // overlap guard: each furniture/over cell may be claimed once
const putRect = (x, y, w, h, id0, target = furniture, who = 'obj') => {
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const cx = x + c, cy = y + r, k = cy * W + cx;
    if (cx < ox + 1 || cx > ox + RW - 2 || cy < oy || cy > oy + RH - 2)
      throw new Error(`${who}: cell (${cx},${cy}) is outside the room interior`);
    if (claimed.has(k)) throw new Error(`${who}: cell (${cx},${cy}) already claimed by ${claimed.get(k)}`);
    claimed.set(k, who);
    target[k] = MU + id0 + r * MCOLS + c;
  }
};
// A tall object: its BASE row collides (Furniture); the rows above go to Over so the
// player is occluded walking behind it and can stand in that space.
const putTall = (x, y, w, h, id0, who = 'tall') => {
  putRect(x, y, w, h - 1, id0, over, who);                            // upper part -> Over
  putRect(x, y + h - 1, w, 1, id0 + (h - 1) * MCOLS, furniture, who); // base -> collides
};

// --- the gallery wall: framed art hangs ON the 2-row wall band (rows oy..oy+1) ---------
// These are wall-mounted sprites: a frame + its museum plaque, no legs and no ground
// shadow. Each is exactly 2 rows of art, so it fits the band without poking into the sky
// (measured: @436 art y4..57, @438 y0..55, @405/@407 y4..55, @404/@409/@412 y2..55 — all
// inside the band's 64px). Rows oy/oy+1 are already solid wall, so the Furniture layer's
// collision there changes nothing.
// Every piece here is a PLAQUE variant. The sheet also carries plaque-less variants of the
// same art (@376/@380/@342/@478) in a thinner frame; those measure 10px more top pad, and
// the first render showed @376 hanging visibly lower than its neighbours with its bottom
// edge crossing the wall/floor junction. Keep the whole wall on the plaque variants so the
// hanging line matches.
const art = (x, w, id0, who) => putRect(x, oy, w, 2, id0, furniture, who);
art(4, 2, 436, 'painting-great-wave');     // Hokusai's Great Wave + plaque
art(7, 1, 404, 'painting-portrait-dune');
art(9, 2, 438, 'painting-starry-night');   // Starry Night + plaque
art(12, 2, 405, 'painting-figures');       // + plaque
art(15, 1, 409, 'painting-portrait-red');
art(17, 2, 407, 'painting-landscape');     // + plaque
art(20, 1, 412, 'painting-portrait-green');

// --- back exhibit row (y oy+2..oy+4): plinths and statues along the far wall -----------
// All are free-standing 3-tall floor pieces drawn in 3/4 view (a front face + a top).
// @802/@804 have topPad 0 so their art meets the wall base exactly on the first floor row.
const ey = oy + 2;
putTall(4, ey, 2, 3, 802, 'statue-stone-a');
putTall(7, ey, 2, 3, 888, 'plinth-gold-vases');
putTall(10, ey, 2, 3, 912, 'plinth-figurines');
putTall(14, ey, 2, 3, 936, 'plinth-crystal');
putTall(17, ey, 2, 3, 804, 'statue-stone-b');
putTall(20, ey, 2, 3, 753, 'palm-big');

// --- rope barriers, held back a row from the exhibits so they read as a cordon ---------
putTall(4, oy + 6, 3, 2, 277, 'rope-gold');     // 3 posts + 2 chains
putTall(17, oy + 6, 3, 2, 272, 'rope-silver');

// --- the centrepieces: two mounted dinosaur skeletons ---------------------------------
putTall(4, oy + 9, 3, 3, 1344, 'dino-skeleton');
putTall(17, oy + 9, 3, 3, 1347, 'dino-skeleton-2');   // the mirrored variant

// --- seating in the middle of the hall, facing the gallery wall -----------------------
putTall(9, oy + 10, 2, 2, 146, 'bench-left');
putTall(14, oy + 10, 2, 2, 146, 'bench-right');

// --- wayfinding + greenery, flanking the entrance -------------------------------------
putTall(8, oy + 12, 1, 2, 630, 'info-sign');
putTall(21, oy + 12, 1, 2, 752, 'plant-pot');

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
console.error(`door OK: gap ${DOOR_W} wide at x=${dStart}..${dStart + DOOR_W - 1}, y=${by}; ${free} interior floor cells all reachable`);
console.error(`furniture cells claimed: ${claimed.size}`);

const layer = (name, data) => ({ type: 'tilelayer', name, width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data });
const map = {
  type: 'map', version: '1.10', orientation: 'orthogonal', renderorder: 'right-down',
  width: W, height: H, tilewidth: 32, tileheight: 32, infinite: false, nextlayerid: 7, nextobjectid: 1,
  tilesets: SETS.map((s) => ({ firstgid: s.firstgid, name: s.name, image: s.image, imagewidth: s.cols * 32, imageheight: (s.tilecount / s.cols) * 32, tilewidth: 32, tileheight: 32, columns: s.cols, tilecount: s.tilecount, margin: 0, spacing: 0 })),
  layers: [layer('Ground', ground), layer('Shadows', shadows), layer('Decor', decor), layer('Walls', walls), layer('Furniture', furniture), layer('Over', over)],
  properties: [{ name: 'spawnX', type: 'int', value: (ox + RW / 2) * 32 }, { name: 'spawnY', type: 'int', value: (oy + RH - 2) * 32 }],
};
writeFileSync(out, JSON.stringify(map));
console.error(`museum ${RW}x${RH} in ${MW}x${MH} -> ${out}`);
