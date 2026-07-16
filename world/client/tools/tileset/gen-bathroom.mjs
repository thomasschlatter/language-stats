// Bathroom = the 3D-walls room (see gen-room2) + a Furniture layer of LimeZu Modern
// Interiors bathroom items (bathtub, shower, toilet, washbasin + mirror, towel rails,
// tall cabinet) + a Decor layer for the bath mat. Same recipe as gen-kitchen.mjs.
// Preview with render-map.mjs. `node gen-bathroom.mjs <out.json>`.
import { writeFileSync } from 'node:fs';
const out = process.argv[2] || 'world/client/public/assets/map/bathroomMap.json';

// A domestic bathroom: compact (a hall-sized room reads as empty).
const MW = 24, MH = 14, RW = 18, RH = 8;
const ox = (MW - RW) >> 1, oy = (MH - RH) >> 1;

const SETS = [
  { name: 'floors',   image: '../tileset/Room_Builder_Floors_32x32.png', cols: 15, tilecount: 15 * 40 },
  { name: 'walls',    image: '../tileset/Room_Builder_3d_walls_32x32.png', cols: 24, tilecount: 24 * 59 },
  { name: 'sky',      image: '../tileset/Room_Builder_Sky_32x32.png', cols: 1, tilecount: 1 },
  { name: 'bathroom', image: '../tileset/Bathroom_Modern_32x32.png', cols: 16, tilecount: 16 * 56 },
];
let g = 1; for (const s of SETS) { s.firstgid = g; g += s.tilecount; }
const FL = SETS[0].firstgid, WL = SETS[1].firstgid, SKY = SETS[2].firstgid, BA = SETS[3].firstgid;

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
const decor = new Array(W * H).fill(0);     // flat floor decals (bath mat) — never collides
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

// --- bathroom furniture ---------------------------------------------------------
// Bathroom_Modern_32x32.png is 16 cols x 56 rows -> STRIDE = 16.
// Every object is placed as a COMPLETE rect from its top-left id. Footprints were derived
// with all of: template-matching the pack's SHADOWLESS singles into the SHADOWLESS sheet,
// the navy-outline edge test, 8-connected flood fill, and finally rendering each rect IN
// ISOLATION (neighbours removed) and looking at it. Every source lied at least once here:
//   * flood fill OVER-MERGED the 3x3 tubs at row 37 (cols 0-5 = two bays sharing posts) and
//     merged TWO 1-wide towel rails into one 2x2 (each rail is 1 wide -> 647 and 648).
//   * the only single for that tub was a 16px LEFT-POST segment (modular, not the object).
//   * 128 2x3 was rejected as TOO BIG: a transparent gap and THEN a detached beige variant.
//   * 598 2x3 passed flood fill as an isolated component yet renders CLIPPED — it is a tub
//     bay missing its left post (it borrows the previous tub's). Flood stopped at a CUT.
// Verified footprints used here (id0, w x h, measured topPad):
//   bathtub+shower 234 2x4 pad12 · washing machine 514 2x2 pad0 · toilet(white) 741 1x3 pad14
//   washbasin+tap 386 2x2 pad0(tap)/10(counter) · wall mirror 331 2x2 pad2
//   towel rail 647 / 648 1x2 pad14 · tall cabinet 668 1x4 pad24 · towel stool 537 1x2 pad14
//   bath mat 452 2x2 pad20 (Decor)
const BCOLS = 16;
const claimed = new Map(); // overlap guard: each furniture/decor cell may be claimed once
const putRect = (x, y, w, h, id0, target = furniture, who = 'obj') => {
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const cx = x + c, cy = y + r, k = cy * W + cx;
    if (cx < ox + 1 || cx > ox + RW - 2 || cy < oy || cy > oy + RH - 2)
      throw new Error(`${who}: cell (${cx},${cy}) is outside the room interior`);
    if (claimed.has(k)) throw new Error(`${who}: cell (${cx},${cy}) already claimed by ${claimed.get(k)}`);
    claimed.set(k, who);
    target[k] = BA + id0 + r * BCOLS + c;
  }
};
// A tall object: its BASE row collides (Furniture); the rows above go to Over so the
// player is occluded walking behind it and can stand in that space.
const putTall = (x, y, w, h, id0, who = 'tall') => {
  putRect(x, y, w, h - 1, id0, over, who);                            // upper part -> Over
  putRect(x, y + h - 1, w, 1, id0 + (h - 1) * BCOLS, furniture, who); // base -> collides
};
// WHERE AN OBJECT GOES — from its measured topPad and how it is DRAWN. Room geometry:
// oy = wall cap row, oy+1 = wall face row, oy+2 = first floor row; the wall BASE LINE is
// the top of row oy+2. The goal is always: the object's ART TOP meets (or slightly
// overlaps) the wall base line — an art top BELOW it is the "floating / floor strip" bug.
//   art_top = topRow*32 + topPad
//
// Front-drawn with a vertical face and a transparent top pad, art ~3 tiles tall (toilet h=3
// pad14; cabinet h=4 pad24; bath h=4 pad12 — its shower head reads as WALL-MOUNTED up in the
// band, exactly right). topRow = oy: the art top lands 12-24px into the cap row so the body
// covers the whole wall band with no floor strip, and the foot sits on a floor row.
// The h=4 pieces cannot use topRow = (oy+2)-(h-1) = oy-1 — that is the sky.
const frontWall = (x, w, h, id0, who) => putTall(x, oy, w, h, id0, who);
// topPad = 0 (washing machine; washbasin's tap): the art fills the rect from its very top, so
// its top row goes ON the first floor row and the art meets the wall base flush (skill: "art
// fills the rect? -> first floor row"). Mounting it up the wall would overdraw the wall cap.
// (386's counter has a 10px backsplash pad below the tap — that is the sprite's own designed
// mirror-to-counter spacing, which is how the sheet itself stacks 369/371 above it.)
const floorTop = (x, w, h, id0, who) => putTall(x, oy + 2, w, h, id0, who);
// Wall-mounted (mirror, towel rail): drawn with a hook/rail top, no legs, no ground shadow.
// Hangs on the 2-row wall band (oy = cap, oy+1 = face). Only h=2 fits.
const onWall = (x, w, id0, who) => putRect(x, oy, w, 2, id0, furniture, who);

// --- back wall (left to right: bath, washer, [door], basin+mirror, toilet, cabinet) ---
// The bath 234 is a clawfoot tub WITH a shower head + hose over it, so it carries both the
// "bath" and the "shower" vocabulary in one unmistakable sprite. (232 is the same family
// with a plain tray instead of the tub — in-room it reads as an oven/appliance, so it is
// deliberately NOT used; see the note above about picking the readable variant.)
frontWall(ox + 1, 2, 4, 234, 'bathtub');      // cols 4-5, rows 3-6 (clawfoot tub + shower head)
floorTop(ox + 4, 2, 2, 514, 'washing-machine'); // cols 7-8, rows 5-6
onWall(ox + 7, 1, 647, 'towel-rail-L');       // col 10, beside the washer
onWall(ox + 10, 2, 331, 'mirror');            // cols 13-14, on the wall band
floorTop(ox + 10, 2, 2, 386, 'washbasin');    // cols 13-14, rows 5-6, under the mirror
frontWall(ox + 13, 1, 3, 741, 'toilet');      // col 16, rows 3-5
onWall(ox + 14, 1, 648, 'towel-rail-R');      // col 17, beside the toilet
frontWall(ox + 15, 1, 4, 668, 'cabinet');     // col 18, rows 3-6

// --- out in the room ---
putTall(ox + 5, oy + 4, 1, 2, 537, 'towel-stool');   // col 8, rows 7-8: stool of folded towels

// --- floor decal: bath mat in front of the bath (Decor -> walk on it, never collides) ---
putRect(ox + 1, oy + 4, 2, 2, 452, decor, 'bath-mat');

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
const start = [dStart, by + 1];
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
console.error(`furniture/decor cells claimed: ${claimed.size}`);

const layer = (name, data) => ({ type: 'tilelayer', name, width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data });
const map = {
  type: 'map', version: '1.10', orientation: 'orthogonal', renderorder: 'right-down',
  width: W, height: H, tilewidth: 32, tileheight: 32, infinite: false, nextlayerid: 7, nextobjectid: 1,
  tilesets: SETS.map((s) => ({ firstgid: s.firstgid, name: s.name, image: s.image, imagewidth: s.cols * 32, imageheight: (s.tilecount / s.cols) * 32, tilewidth: 32, tileheight: 32, columns: s.cols, tilecount: s.tilecount, margin: 0, spacing: 0 })),
  layers: [layer('Ground', ground), layer('Shadows', shadows), layer('Decor', decor), layer('Walls', walls), layer('Furniture', furniture), layer('Over', over)],
  properties: [{ name: 'spawnX', type: 'int', value: (ox + RW / 2) * 32 }, { name: 'spawnY', type: 'int', value: (oy + RH - 2) * 32 }],
};
writeFileSync(out, JSON.stringify(map));
console.error(`bathroom ${RW}x${RH} in ${MW}x${MH} -> ${out}`);
