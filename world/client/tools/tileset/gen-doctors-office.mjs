// Doctor's office = the 3D-walls room (see gen-room2 / gen-classroom) + a Furniture layer
// of LimeZu Modern Interiors HOSPITAL items (exam bed, doctor's desk, supply shelf, lockers,
// privacy screen, plants, wall posters) + an outdoor waiting patio (bench, couch, plants).
// Preview with render-map.mjs. `node gen-doctors-office.mjs <out.json>`.
import { writeFileSync } from 'node:fs';
const out = process.argv[2] || 'world/client/public/assets/map/doctorsOfficeMap.json';

// The exam room proper is deliberately SHORT (RH 15 -> 11, i.e. 8 interior floor rows): a
// doctor's office should read as compact and a bit cramped. The waiting seats are NOT in it —
// they sit on an outdoor PATIO below the bottom wall, by the door (see WAITING AREA below),
// so the room holds only what an exam room holds. `oy` is pinned near the top rather than
// centred, to leave the lower half of the map for that patio.
const MW = 26, MH = 20, RW = 18, RH = 11;
const ox = (MW - RW) >> 1, oy = 2;
// Patio: 4 rows immediately below the room's bottom wall, spanning the interior columns.
const PY = oy + RH, PH = 4;

const SETS = [
  { name: 'floors', image: '../tileset/Room_Builder_Floors_32x32.png', cols: 15, tilecount: 15 * 40 },
  { name: 'walls',  image: '../tileset/Room_Builder_3d_walls_32x32.png', cols: 24, tilecount: 24 * 59 },
  { name: 'sky',    image: '../tileset/Room_Builder_Sky_32x32.png', cols: 1, tilecount: 1 },
  { name: 'hosp',   image: '../tileset/Hospital_Modern_32x32.png', cols: 16, tilecount: 16 * 110 },
];
let g = 1; for (const s of SETS) { s.firstgid = g; g += s.tilecount; }
const FL = SETS[0].firstgid, WL = SETS[1].firstgid, SKY = SETS[2].firstgid, HS = SETS[3].firstgid;

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
// The outdoor waiting patio needs a floor of its own, or the benches float on sky.
for (let y = PY; y < PY + PH; y++) for (let x = ox + 1; x < ox + RW - 1; x++) ground[y * W + x] = FL + FLOOR;

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

// --- hospital furniture ---------------------------------------------------------
// The Hospital sheet (19_Hospital_32x32) is 16 cols x 110 rows. Every object is placed as
// a COMPLETE rect (or explicit grid) walked from its top-left id, so it is never clipped.
//
// HOW THE FOOTPRINTS BELOW WERE DERIVED (do not "read the sheet carefully" — that is what
// produced half-beds and a headless IV stand). Mechanical checks only:
//  1. GROUND TRUTH: this sheet is byte-identical to the pack's Theme_Sorter_32x32/
//     19_Hospital_32x32.png, and the pack ships most objects as their own PNG under
//     Theme_Sorter_Singles_32x32/19_Hospital_SIngles_32x32/. Template-matching each single
//     into the sheet gives that object's exact pixel rect. That is the authority WHERE IT
//     EXISTS — but it does not cover everything (see the IV stand).
//  2. PER-PIXEL ALPHA / FLOOD FILL: 8-connected fill over opaque pixels from a seed tile.
//     Useful, but it CANNOT see a sprite that is cut at a tile boundary (again: IV stand).
//     A naive "grow until a blank tile row/col" walk is useless here — objects are packed
//     with zero gutter and it cascades into one 16x107 blob.
//
// CLIPPED vs FINISHED EDGE: LimeZu outlines every finished edge in dark navy (lum < 95).
// If an edge is BARE FILL running to the tile boundary, the sprite continues / is meant to
// butt -> placing it at that size renders a hard flat cut. Trust this over "nothing looks
// adjacent to it in the sheet" — the matching half may be parked elsewhere in the sheet.
//
// Verified footprints (single # = the pack's own object PNG that pins it):
//   supply shelf 2x3 @101 (#57) · locker teal 2x3 @1088 (#338) · locker white 2x3 @1091
//   (#339) · doctor's desk 3x3 @1037 (#545) · office chair, SIDE view 2x2 @1204 (#362)
//   (1200/1206 are the front views; 1202/1204 are the two side views — near-mirrors, pads
//   L2/R26 vs L28/R2. @1204's art sits almost entirely in its RIGHT tile: 28px of left pad,
//   which is why the 2x2 rect is still required and is NOT a clip.)
//   chair (yellow, front) 2x2 @1206 (#366) · privacy screen 2x3 @631 (#245)
//   plant big 2x3 @227 · plant small 1x2 @193 (#69) · filing cabinet 1x2 @1139 (#344)
//   framed poster 2x1 @624 (#248) / @658 (#251) · wall sign 1x2 @224 (#68)
//   waiting bench 3x2 @1005
//
// THE "IV STAND" AT 461 IS NOT IN THIS ROOM — AND DO NOT RE-ADD IT. It went through three
// passes (1x4 @461 -> 1x3 @477 -> a 2x4 grid) before the user had it removed outright, so if
// tile 461 ever looks tempting, read this first:
//   - It is NOT an IV drip stand. Assembled it is plainly a TWO-POST ROPE BARRIER (which also
//     explains tiles 335/367 — barrier posts reusing the identical rope tube). This sheet does
//     not appear to contain a single-pole drip stand at all.
//   - 461 ALONE IS HALF AN OBJECT. Its left edge column (x=416) reads navy / rgba(80,133,180)
//     BARE FILL / navy: a rope sliced across its middle, no cap. It renders as a rope stopping
//     dead in mid-air. Its other half is 415 — parked in the sheet's LAST column, four rows
//     away, because its own cut edge runs to the sheet border and its partner physically
//     cannot sit beside it. Height pairs: (413,479) 2 tall, (414,478) 3 tall, (415,461) 4 tall
//     — THREE 2-wide objects, not "six stand variants".
//   - The two traps, both worth remembering for any other object on this sheet:
//     FLOOD FILL STOPS AT A CUT, NOT AT AN END. The component containing 461 is exactly
//     {461,477,493,509}, which reads as a tidy "1x4, done" — that is how 1x4 got locked in
//     twice. And THE PACK'S SINGLES DO NOT COVER EVERYTHING: #199 lands on sheet row 27 and
//     #200 jumps to row 32.5, straight over the row 25-31 block, so template matching had
//     nothing to match and the pixels had to settle it.
//     The way to find a cut sprite's other half: scan every tile for one whose opposite edge
//     column carries the SAME cut face (same colours, same tile-relative y).

const HSCOLS = 16;
const putRect = (x, y, w, h, id0, target = furniture) => {
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++)
    target[(y + r) * W + (x + c)] = HS + id0 + r * HSCOLS + c;
};
// Some objects are NOT a contiguous rect in the sheet (see COUCH below), so allow an
// explicit tile grid too. `null` = leave the cell alone.
const putGrid = (x, y, grid, target = furniture) => {
  for (let r = 0; r < grid.length; r++) for (let c = 0; c < grid[r].length; c++) {
    const id = grid[r][c];
    if (id != null) target[(y + r) * W + (x + c)] = HS + id;
  }
};
// A tall object: its BASE row collides (Furniture); the rows above it go to Over so the
// player is occluded walking behind it and can stand in that space.
const putTall = (x, y, w, h, id0) => {
  putRect(x, y, w, h - 1, id0, over);                            // upper part -> Over
  putRect(x, y + h - 1, w, 1, id0 + (h - 1) * HSCOLS, furniture); // base -> collides
};

// COUCH / EXAM BED — the bug the 2x2 placement caused, and why it is 3 wide.
// The sheet stores each couch as TWO MIRRORED 2x2 HALVES: the 2x2 at 571 is the EXACT
// horizontal mirror of the 2x2 at 523 (verified: 0/4096 differing pixels; same for the
// teal pair 525/573). Each half has ONE outlined rounded end and one BARE FILL edge:
// single #220's left end is a dark outline at x=4-5, but its column x=63 is raw mattress
// fill (rgba 235,228,242) with no cap. So a 2x2 placement ALWAYS renders a hard flat cut —
// that was the reported bug, and "the flat end is the bed's foot" was wrong.
// The complete couch is 3 wide: [left cap][middle][mirrored left cap], i.e. the third
// column is the cap taken from the MIRRORED half — which is why this is not a plain rect
// and putRect cannot express it. Verified by assembling and looking: 3-wide gives two
// outlined rounded ends over ONE CONTINUOUS base.
// The alternative — butting the two halves into a 4-wide [523][524][571][572] — joins the
// mattress perfectly (cut edge meets cut edge by construction) but visibly BREAKS the base:
// a notch with two legs jammed together. That is not a rendering artifact; butting the
// pack's own singles #220+#222 reproduces it. So 4-wide is wrong and 3-wide is used.
// Known cosmetic wart of 3-wide: the legs land at ~14/60/81 of 96px, so the leftmost bay is
// wider than the others. That is inherent to reusing a mirrored cap and is much less
// obtrusive than either the flat cut (2-wide) or the broken base (4-wide).
const COUCH_WHITE = [[523, 524, 572], [539, 540, 588]]; // mattress row, tan base row
const COUCH_TEAL  = [[525, 526, 574], [541, 542, 590]];

// ---- WALL DECOR ---------------------------------------------------------------
// Hangs on the wall FACE. The 3D wall band is 2 rows — cap (oy) over face (oy+1) — but the
// painted face actually runs from the LOWER HALF of the cap row to the bottom of the face
// row. These sprites carry their art at the BOTTOM of their own tile (poster 624: 14px top
// pad, 0px bottom), so placing them on oy+1 dropped the art onto the wall/floor junction and
// they read as standing on the floor. Anchoring at `oy` lands the art on the face. The wall
// already collides on both rows, so this adds no obstacle and no stray floor blocker.
// NOTE: the back-wall storage now covers the wall face from the LEFT end to the cabinet, so
// the decor lives on the free wall above the desk and in the gap by the sign. Wall columns
// occupied by storage tops: ox+1..2, ox+4..5, ox+7..8 (and ox+10 on the face row only).
const wallY = oy;
putRect(ox + 11, wallY, 2, 1, 624);         // framed landscape, over the desk (left)
putRect(ox + 9, wallY, 1, 2, 224);          // wall sign, in the gap beside the filing cabinet
putRect(ox + 15, wallY, 2, 1, 658);         // framed landscape, back-right

// ---- BACK-WALL STORAGE --------------------------------------------------------
// THE RULE (SKILL.md, "WHY back-wall furniture floats"): an object that stands against the
// back wall must have its BASE ROW on the FIRST FLOOR ROW (`oy + 2`), so its body covers the
// wall band. For a 3-tall object that is exactly the skill's `topRow = oy` — but the
// invariant is the BASE, not the top, so this generator derives the top from the height:
//   topRow = (oy + 2) - (h - 1)
//   h = 3 (shelf, lockers)  -> topRow = oy      -> spans oy..oy+2   (== the skill's rule)
//   h = 2 (filing cabinet)  -> topRow = oy + 1  -> spans oy+1..oy+2
// Do NOT blindly force topRow = oy for the 2-tall cabinet: that would span oy..oy+1, i.e.
// ENTIRELY inside the wall band, and its art (12px top pad, 20px bottom pad in a 64px rect)
// would stop ~20px ABOVE the wall base — it would hang on the wall like a picture instead of
// standing on the floor. Basing off the floor row gives the same answer as `topRow = oy` for
// every 3-tall object while staying correct at other heights.
// Why any of this is needed: every sprite carries transparent TOP PADDING inside its own rect
// (measured: shelf 6px, lockers 18px, cabinet 12px), so on the first floor row its art starts
// BELOW the wall base and that delta is the visible "floor strip" that reads as floating.
// Collision is unaffected — only the base row goes on `Furniture`; the rows above go on
// `Over` (depth 10000, never collides), which is what lets them overlap the wall band.
const baseRow = oy + 2;                     // the first floor row
const backTop = (h) => baseRow - (h - 1);
putTall(ox + 1, backTop(3), 2, 3, 101);     // stocked supply shelf
putTall(ox + 4, backTop(3), 2, 3, 1088);    // teal locker cabinet
putTall(ox + 7, backTop(3), 2, 3, 1091);    // white locker cabinet
putTall(ox + 10, backTop(2), 1, 2, 1139);   // filing cabinet
// Back-wall budget, interior cols ox+1..ox+16: shelf 1-2 | 3 | teal 4-5 | 6 | white 7-8 | 9 |
// cabinet 10 | 11 | desk 12-14 | 15 | plant 16 — every object keeps an empty neighbour col.

// ---- CONSULTING CORNER (right) ------------------------------------------------
// The desk is waist-height and fully solid: every row collides, so it needs no Over split. It
// stays on the floor row — free-standing office furniture, not back-wall storage.
putRect(ox + 12, oy + 2, 3, 3, 1037);       // desk: monitor, supplies, tablet
putRect(ox + 12, oy + 5, 2, 2, 1204);       // doctor's chair, tucked in (faces the desk)
putRect(ox + 15, oy + 6, 2, 2, 1206);       // patient's chair, across from the desk
putTall(ox + 16, oy + 2, 1, 2, 193);        // small plant, back-right, flush to the right wall

// ---- EXAM AREA (left) ---------------------------------------------------------
putTall(ox + 1, oy + 7, 2, 3, 631);         // privacy screen
putGrid(ox + 4, oy + 8, COUCH_TEAL);        // exam bed, 3 wide (mattress + tan base)

// ---- WAITING AREA — OUTSIDE THE OFFICE, ON THE PATIO --------------------------
// Patients wait OUTSIDE the exam room: the seating sits on the patio below the bottom wall,
// flanking the door, on its own floor (filled above) rather than floating on sky. Nothing
// here is on the room's interior.
//
// THE DOOR CORRIDOR IS SACRED. The door gap is cols `dStart..dStart+DOOR_W-1` (= ox+8, ox+9
// for RW=18/DOOR_W=2, since dStart = ox + ((RW - DOOR_W) >> 1)). NOTHING solid may sit in
// those columns anywhere between the patio's last row and the room's back wall — furniture is
// ALL solid, so a piece parked there is a collision bug, not just a visual one. The barrier
// below used to sit at `ox+8`, i.e. exactly ON dStart, standing in the doorway. Note the trap:
// `ox+8` looks like an innocent "beside the bed" offset and is nowhere near the `dStart`
// expression by eye — they only collide once you evaluate both. Anything placed in the lower
// half of the room must be checked against dStart NUMERICALLY, and the walkability check at
// the bottom of this file BFSes patio -> door -> interior so this cannot regress silently.
//
// Patio column budget, cols ox+1..ox+16, symmetric about the door, every object with an
// empty gutter column beside it:
//   plant 1-2 | 3 | bench 4-6 | 7 | DOOR 8-9 | 10 | couch 11-13 | 14 | plant 15-16
// (2+1+3+1 = 7 cols left of the door, 1+3+1+2 = 7 right — seating either side, plants at the
// ends.) Row PY itself is left clear as a walkway along the front wall.
putTall(ox + 1, PY + 1, 2, 3, 227);         // big plant, left end
putRect(ox + 4, PY + 1, 3, 2, 1005);        // 3-seat waiting bench, left of the door
putGrid(ox + 11, PY + 1, COUCH_WHITE);      // waiting couch, 3 wide, right of the door
putTall(ox + 15, PY + 1, 2, 3, 227);        // big plant, right end

const layer = (name, data) => ({ type: 'tilelayer', name, width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data });
const map = {
  type: 'map', version: '1.10', orientation: 'orthogonal', renderorder: 'right-down',
  width: W, height: H, tilewidth: 32, tileheight: 32, infinite: false, nextlayerid: 6, nextobjectid: 1,
  tilesets: SETS.map((s) => ({ firstgid: s.firstgid, name: s.name, image: s.image, imagewidth: s.cols * 32, imageheight: (s.tilecount / s.cols) * 32, tilewidth: 32, tileheight: 32, columns: s.cols, tilecount: s.tilecount, margin: 0, spacing: 0 })),
  layers: [layer('Ground', ground), layer('Shadows', shadows), layer('Walls', walls), layer('Furniture', furniture), layer('Over', over)],
  properties: [{ name: 'spawnX', type: 'int', value: (ox + RW / 2) * 32 }, { name: 'spawnY', type: 'int', value: (oy + RH - 2) * 32 }],
};
writeFileSync(out, JSON.stringify(map));
console.error(`doctor's office ${RW}x${RH} + ${PH}-row patio in ${MW}x${MH} -> ${out}`);
