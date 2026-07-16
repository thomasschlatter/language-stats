// Mom & Pop Shop = the 3D-walls room (see gen-room2 / gen-classroom) + a Furniture layer of
// LimeZu Modern Interiors GROCERY STORE items (checkout + till, stocked aisle shelving, a
// fridge, a chest freezer, produce crates, a display cart, plants, signage).
// Preview with render-map.mjs.  `node gen-shop.mjs <out.json>`.
import { writeFileSync } from 'node:fs';
const out = process.argv[2] || 'world/client/public/assets/map/shopMap.json';

// A corner shop is SMALL: a 14x10 interior, snug enough that the fixtures nearly fill it.
const MW = 24, MH = 20, RW = 16, RH = 13;
const ox = (MW - RW) >> 1, oy = (MH - RH) >> 1;

const SETS = [
  { name: 'floors', image: '../tileset/Room_Builder_Floors_32x32.png', cols: 15, tilecount: 15 * 40 },
  { name: 'walls',  image: '../tileset/Room_Builder_3d_walls_32x32.png', cols: 24, tilecount: 24 * 59 },
  { name: 'sky',    image: '../tileset/Room_Builder_Sky_32x32.png', cols: 1, tilecount: 1 },
  { name: 'shop',   image: '../tileset/Shop_Modern_32x32.png', cols: 16, tilecount: 16 * 78 },
];
let g = 1; for (const s of SETS) { s.firstgid = g; g += s.tilecount; }
const FL = SETS[0].firstgid, WL = SETS[1].firstgid, SKY = SETS[2].firstgid, SH = SETS[3].firstgid;

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

// --- shop furniture -------------------------------------------------------------
// The Grocery sheet (16_Grocery_store_32x32) is 16 cols x 78 rows. Every object is placed as
// a COMPLETE rect walked from its top-left id, so it is never clipped.
//
// HOW THE FOOTPRINTS BELOW WERE DERIVED (never eyeballed — eyeballing is what ships clipped
// shelves and headless objects). Three independent, mechanical checks, all of which had to
// agree before an object was used:
//  1. GROUND TRUTH — the pack ships every object as its own PNG under
//     Theme_Sorter_Singles_32x32/16_Grocery_Store_Singles_32x32/. Template-matching all 489
//     singles into this sheet (rare-colour anchor + exact stencil verify) pinned 273 of them
//     to a unique pixel rect; that rect -> tile rect is the authority.
//  2. NAVY-OUTLINE EDGE TEST — LimeZu outlines every FINISHED edge in dark navy (lum < 95).
//     A BARE-FILL edge running to the tile boundary means the object CONTINUES into the next
//     tile. NB: a bare BOTTOM edge is normal (ground contact + drop shadow) and is NOT a clip
//     signal; bare LEFT/RIGHT edges are.
//  3. 8-CONNECTED FLOOD FILL from the rect. Objects are packed with ZERO gutter, so a "leak"
//     often just means a touching NEIGHBOUR, not a clip — it is only meaningful read together
//     with (1) and (2). The naive "grow until a blank row/col" scan cascades into one giant
//     blob (the whole row-11 signage strip is a single 10x2 blob) and is useless here.
//
// REJECTED by these checks (each would have "looked fine" placed naively):
//   checkout @390 as 2x2 -> right edge BARE, flood runs on to px 281: that rect is only the
//     LEFT PART of the checkout and cuts the till in half. Complete unit is 3x2. This is the
//     one that looks plausible and is not.
//   fridge @246/@248 as 2x4 -> the sheet stacks the modular top cap with a design GAP under
//     it; placed as a rect it renders a detached lid floating over the body. Rejected.
//   upright cooler @368 2x3 -> the rect slices a second, unrelated appliance. Rejected.
//   bush @1047/@1049 -> bare inner edges, they are halves of a wider packed bush group.
//   crate stacks @980/@1012 -> bare right edge (they are middle sections of a tileable run).
//
// Verified footprints (# = the pack's own object PNG that pins it):
//   steel double-door fridge 2x3 @556 (#256) · checkout counter + till 3x2 @390 (blob-pinned)
//   stocked gondola shelf 2x3 @240 (#113) / @288 (#114) · produce crate stack 1x3 @962 (#401)
//   / @963 (#402) · potted bushes 2x2 @1045 (#450) · cactus pots 2x2 @1136 · glass display
//   counter 2x2 @622 (#261) · chest freezer 2x2 @326 (#145) · wooden produce cart 2x3 @1022
//   (#426) · wooden crate table 2x2 @1036 (#421) · open crate of tomatoes 2x2 @826 (#356)
//   wicker baskets 1x2 @1043 (#439) · shopping cart 2x2 @32 (#3) · OPEN sign 1x2 @785 (#2)
//   "-50%" round sale sign 1x1 @183 (#95) · framed cat picture 1x2 @587 (#263)
const SHCOLS = 16;
// Every furniture cell may be claimed exactly once. Two objects overlapping would silently
// overwrite each other and render as a clipped hybrid — the exact failure this file exists to
// prevent — and it is far too easy to do by miscounting an offset. So make it a hard error
// rather than something to notice (or miss) in the preview. Wall decor is exempt: it is meant
// to sit on the wall band, which no floor object claims.
const claimed = new Map();
const claim = (x, y, tag) => {
  if (x < ox || x >= ox + RW || y < oy || y >= oy + RH) throw new Error(`${tag}: (${x},${y}) is outside the room`);
  const k = y * W + x, prev = claimed.get(k);
  if (prev) throw new Error(`${tag}: cell (${x},${y}) already used by ${prev}`);
  claimed.set(k, tag);
};
const putRect = (x, y, w, h, id0, target = furniture, tag = `@${id0}`) => {
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    claim(x + c, y + r, tag);
    target[(y + r) * W + (x + c)] = SH + id0 + r * SHCOLS + c;
  }
};
// A tall object: its BASE row collides (Furniture); the rows above it go to Over so the
// player is occluded walking behind it and can stand in that space.
const putTall = (x, y, w, h, id0) => {
  putRect(x, y, w, h - 1, id0, over, `@${id0}`);                            // upper part -> Over
  putRect(x, y + h - 1, w, 1, id0 + (h - 1) * SHCOLS, furniture, `@${id0}`); // base -> collides
};

// BACK WALL. The wall band is 2 rows — cap (oy) over face (oy+1) — and the floor starts at
// oy+2. Anything standing AGAINST the back wall must have its BASE on that first floor row
// (oy+2) with its body running UP OVER the wall band, exactly as gen-classroom's library
// does. Anchoring at oy+2 instead parks the object 2 rows out into the room and leaves a
// strip of floor showing behind it. So: y0 = oy + 2 - (h - 1).
const backY = (h) => oy + 2 - (h - 1);
putTall(ox + 1, backY(3), 2, 3, 556);   // steel fridge / dairy unit, back-left
putTall(ox + 4, backY(3), 2, 3, 240);   // stocked shelving against the wall
putTall(ox + 7, backY(3), 2, 3, 288);   // stocked shelving against the wall
putTall(ox + 10, backY(3), 1, 3, 962);  // crate stack (green produce), against the wall
putTall(ox + 12, backY(2), 2, 2, 1045); // potted bushes, back-right corner

// Wall decor. The wall band is only 2 rows (cap oy over face oy+1) and the usable FACE is the
// middle of that band, so only 1x2 sprites hang correctly: they carry their art at the bottom
// of their 2 tiles, which lands it mid-face. A 1x1 sign has nowhere to go — at oy+1 it drops
// onto the wall/floor junction and reads as propped against the skirting, at oy it pokes out
// above the wall cap into the sky. Both were tried and rejected in the preview; the round
// "-50%" sign (@183) therefore stays off the wall and the A-board (@1017) stands on the floor
// instead. The wall already collides on both rows, so this adds no new obstacle.
putRect(ox + 3, oy, 1, 2, 785);         // OPEN sign
putRect(ox + 9, oy, 1, 2, 587);         // framed cat picture (the shop cat)

// Produce corner, left wall: crates, a crate table and baskets.
putRect(ox + 1, oy + 4, 2, 2, 826);     // open crate of tomatoes
putRect(ox + 1, oy + 7, 2, 2, 1036);    // wooden crate table
putTall(ox + 1, oy + 10, 1, 2, 1043);   // stacked wicker baskets

// Centre of the shop: the produce cart and the chest freezer, and a second stocked gondola
// making a browsing aisle. The aisle stops well short of the bottom wall — the door is a gap
// in that wall at dStart..dStart+1, and nothing may sit in the two rows in front of it or you
// spawn inside the furniture.
putTall(ox + 4, oy + 4, 2, 3, 1022);    // wooden produce display cart
putRect(ox + 4, oy + 8, 2, 2, 326);     // glass-top chest freezer
putTall(ox + 7, oy + 4, 2, 3, 240);     // stocked gondola, aisle side

// Right: the till the shopkeeper stands behind, a deli case and a cactus.
// The checkout is waist-height and fully solid: every row collides, so the player can never
// overlap it and it needs no Over split.
putRect(ox + 10, oy + 4, 2, 2, 622);    // glass display counter, beside the till
putRect(ox + 11, oy + 7, 3, 2, 390);    // checkout counter + till — shopkeeper stands above
putTall(ox + 13, oy + 4, 2, 2, 1136);   // cactus pots
putTall(ox + 14, oy + 9, 1, 3, 963);    // crate stack (wooden), against the right wall

// By the door: a shopping cart and the A-board sign greeting you on the way in.
putRect(ox + 10, oy + 10, 2, 2, 32);    // shopping cart
putRect(ox + 9, oy + 9, 1, 1, 1017);    // yellow A-board sign

const layer = (name, data) => ({ type: 'tilelayer', name, width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data });
const map = {
  type: 'map', version: '1.10', orientation: 'orthogonal', renderorder: 'right-down',
  width: W, height: H, tilewidth: 32, tileheight: 32, infinite: false, nextlayerid: 6, nextobjectid: 1,
  tilesets: SETS.map((s) => ({ firstgid: s.firstgid, name: s.name, image: s.image, imagewidth: s.cols * 32, imageheight: (s.tilecount / s.cols) * 32, tilewidth: 32, tileheight: 32, columns: s.cols, tilecount: s.tilecount, margin: 0, spacing: 0 })),
  layers: [layer('Ground', ground), layer('Shadows', shadows), layer('Walls', walls), layer('Furniture', furniture), layer('Over', over)],
  properties: [{ name: 'spawnX', type: 'int', value: (ox + RW / 2) * 32 }, { name: 'spawnY', type: 'int', value: (oy + RH - 2) * 32 }],
};
writeFileSync(out, JSON.stringify(map));
console.error(`shop ${RW}x${RH} in ${MW}x${MH} -> ${out}`);
