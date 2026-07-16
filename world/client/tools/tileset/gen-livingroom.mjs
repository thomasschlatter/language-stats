// Living room = the 3D-walls room (see gen-room2) + a Furniture layer of LimeZu Modern
// Interiors living-room items (sofa, armchairs, coffee table, TV on a stand, bookshelf,
// lamp, plants). Same recipe as gen-classroom.mjs. Preview with render-map.mjs.
// `node gen-livingroom.mjs <out.json>`.
import { writeFileSync } from 'node:fs';
const out = process.argv[2] || 'world/client/public/assets/map/livingRoomMap.json';

const MW = 26, MH = 24, RW = 18, RH = 17;
const ox = (MW - RW) >> 1, oy = (MH - RH) >> 1;

const SETS = [
  { name: 'floors', image: '../tileset/Room_Builder_Floors_32x32.png', cols: 15, tilecount: 15 * 40 },
  { name: 'walls',  image: '../tileset/Room_Builder_3d_walls_32x32.png', cols: 24, tilecount: 24 * 59 },
  { name: 'sky',    image: '../tileset/Room_Builder_Sky_32x32.png', cols: 1, tilecount: 1 },
  { name: 'living', image: '../tileset/LivingRoom_Modern_32x32.png', cols: 16, tilecount: 16 * 45 },
];
let g = 1; for (const s of SETS) { s.firstgid = g; g += s.tilecount; }
const FL = SETS[0].firstgid, WL = SETS[1].firstgid, SKY = SETS[2].firstgid, LV = SETS[3].firstgid;

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

// --- living-room furniture -----------------------------------------------------
// The LivingRoom sheet (2_LivingRoom_32x32.png) is 16 cols -> that is the putRect stride.
// Every object is a RECT taken from its top-left id, so it is always placed COMPLETE.
// Footprints were derived from the pack's per-object singles
// (Theme_Sorter_Singles_32x32/2_Living_Room_Singles_32x32) by exact template match into
// the sheet, cross-checked with a navy-outline / zero-spill test on the sheet pixels:
//   bookshelf   2x3 @16   (single #1)    TV flat-screen 2x1 @21  (single #6)
//   potted tree 2x3 @10   (single #13)   potted plant   1x2 @332 (single #16)
//   coffee table 2x2 @114 (single #29)   TV stand/sideboard 2x2 @179 (single #51)
//   floor lamp  1x3 @156  (single #79)   chair          1x2 @300 (single #92)
//   sofa 3-seat (faces S) 3x2 @449 · sofa 2-seat (faces N) 2x2 @481 · ottoman 1x1 @483
//   armchair (faces E) 2x3 @517 · armchair (faces W) 2x3 @515
//   (the seating is modular so it ships no singles; each rect was verified by the
//    navy-outline test + zero spill outside the rect on the sheet.)
// Objects are spaced so every neighbouring cell (left/right/above/below) stays free.
const LVCOLS = 16;
const claimed = new Set(); // overlap guard: each furniture cell may be written once
const claim = (x, y, what) => {
  const k = y * W + x;
  if (claimed.has(k)) throw new Error(`furniture overlap at (${x},${y}) while placing ${what}`);
  if (x < ix0 || x > ix1 || y < oy || y > iy1) throw new Error(`${what} out of room at (${x},${y})`);
  claimed.add(k);
};
const putRect = (x, y, w, h, id0, target = furniture, what = `id${id0}`) => {
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    claim(x + c, y + r, what);
    target[(y + r) * W + (x + c)] = LV + id0 + r * LVCOLS + c;
  }
};
// A tall object: its BASE row collides (Furniture); the rows above it go to Over so the
// player is occluded walking behind it and can stand in that space.
const putTall = (x, y, w, h, id0, what = `id${id0}`) => {
  putRect(x, y, w, h - 1, id0, over, what);                            // upper part -> Over
  putRect(x, y + h - 1, w, 1, id0 + (h - 1) * LVCOLS, furniture, what); // base -> collides
};
// Back-wall placement: base lands on the first floor row, body covers the wall band, so
// there is never a strip of floor showing behind the object.
const backRow = (h) => (oy + 2) - (h - 1);

// ---- back wall (north) ----
putTall(ox + 1, backRow(3), 2, 3, 16, 'bookshelf');             // cols 5-6,  rows 3-5
putTall(ox + 4, backRow(2), 2, 2, 243, 'cabinet');              // cols 8-9,  rows 4-5
// TV: a floor-standing CRT television. Every TV in this pack is drawn with its own feet
// flush to the bottom of the sprite, and a TV(2)+stand(2) stack is 4 rows tall — one row
// more than the back wall allows (topRow would land above the wall cap and poke through the
// roofline), and no stand sprite's top surface lines up with the TV's feet anyway. So the
// set stands on the floor against the wall and the sideboard sits beside it as the media
// cabinet — see the report.
const tvx = ox + 8;                                             // cols 12-13
putTall(tvx, backRow(2), 2, 2, 37, 'tv');                       // rows 4-5, base row 5
putTall(ox + 11, backRow(2), 2, 2, 179, 'sideboard');           // cols 15-16, rows 4-5
putTall(ox + 15, backRow(3), 2, 3, 10, 'potted-tree');          // cols 19-20, rows 3-5

// ---- seating: sofa faces north at the TV, armchairs flank it, coffee table between ----
putRect(tvx, oy + 7, 2, 2, 114, furniture, 'coffee-table');     // cols 12-13, rows 10-11
putRect(tvx, oy + 10, 2, 2, 481, furniture, 'sofa-2seat');      // cols 12-13, rows 13-14
putTall(ox + 4, oy + 8, 2, 3, 521, 'armchair-facing-E');        // cols 8-9,   rows 11-13
putTall(ox + 12, oy + 8, 2, 3, 519, 'armchair-facing-W');       // cols 16-17, rows 11-13
putRect(ox + 11, oy + 12, 1, 1, 483, furniture, 'ottoman');     // col 15,     row 15

// ---- edges: lamp, second sofa, chair, plants ----
putTall(ox + 15, oy + 6, 1, 3, 156, 'floor-lamp');              // col 19, rows 9-11
putRect(ox + 1, oy + 5, 3, 2, 449, furniture, 'sofa-3seat');    // cols 5-7, rows 8-9
putRect(ox + 1, oy + 9, 1, 2, 332, furniture, 'plant-left');    // col 5,  rows 12-13
putRect(ox + 1, oy + 13, 1, 2, 300, furniture, 'chair');        // col 5,  rows 16-17
putRect(ox + 16, oy + 13, 1, 2, 332, furniture, 'plant-corner'); // col 20, rows 16-17

// --- verification: nothing collidable may block the door -------------------------
// Solid = any Walls tile or any Furniture tile. Flood-fill walkable tiles from OUTSIDE the
// door and assert the doorway + the room interior are reachable.
{
  const solid = (x, y) => walls[y * W + x] !== 0 || furniture[y * W + x] !== 0;
  const seen = new Set(); const st = [];
  for (let x = dStart; x < dStart + DOOR_W; x++) {
    if (solid(x, by)) throw new Error(`door gap tile (${x},${by}) is blocked by furniture`);
    st.push([x, by]); seen.add(by * W + x);
  }
  while (st.length) {
    const [x, y] = st.pop();
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const k = ny * W + nx;
      if (seen.has(k) || solid(nx, ny)) continue;
      seen.add(k); st.push([nx, ny]);
    }
  }
  // the corridor straight up from the door must be clear
  for (let y = by; y >= iy1 - 2; y--) for (let x = dStart; x < dStart + DOOR_W; x++)
    if (solid(x, y)) throw new Error(`door corridor blocked at (${x},${y})`);
  // every free interior floor tile must be reachable from the door
  let free = 0, unreachable = [];
  for (let y = oy + 2; y <= iy1; y++) for (let x = ix0; x <= ix1; x++) {
    if (solid(x, y)) continue;
    free++;
    if (!seen.has(y * W + x)) unreachable.push(`${x},${y}`);
  }
  if (unreachable.length) throw new Error(`unreachable floor tiles: ${unreachable.join(' ')}`);
  // the player must actually spawn somewhere walkable
  const sx = ox + (RW >> 1), sy = oy + RH - 2;
  if (solid(sx, sy) || !seen.has(sy * W + sx)) throw new Error(`spawn (${sx},${sy}) is blocked`);
  console.error(`door OK: gap ${DOOR_W} wide at x=${dStart}..${dStart + DOOR_W - 1}; ` +
    `${free} free interior tiles, all reachable; spawn (${sx},${sy}) walkable; ` +
    `${claimed.size} furniture cells claimed`);
}

const layer = (name, data) => ({ type: 'tilelayer', name, width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data });
const map = {
  type: 'map', version: '1.10', orientation: 'orthogonal', renderorder: 'right-down',
  width: W, height: H, tilewidth: 32, tileheight: 32, infinite: false, nextlayerid: 6, nextobjectid: 1,
  tilesets: SETS.map((s) => ({ firstgid: s.firstgid, name: s.name, image: s.image, imagewidth: s.cols * 32, imageheight: (s.tilecount / s.cols) * 32, tilewidth: 32, tileheight: 32, columns: s.cols, tilecount: s.tilecount, margin: 0, spacing: 0 })),
  layers: [layer('Ground', ground), layer('Shadows', shadows), layer('Walls', walls), layer('Furniture', furniture), layer('Over', over)],
  properties: [{ name: 'spawnX', type: 'int', value: (ox + RW / 2) * 32 }, { name: 'spawnY', type: 'int', value: (oy + RH - 2) * 32 }],
};
writeFileSync(out, JSON.stringify(map));
console.error(`living room ${RW}x${RH} in ${MW}x${MH} -> ${out}`);
