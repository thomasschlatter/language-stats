// Bedroom = the 3D-walls room (see gen-room2) + a Furniture layer of LimeZu Modern
// Interiors bedroom items (bed, wardrobe, nightstand, mirror, lamp, plants). Same recipe
// as gen-classroom.mjs. Preview with render-map.mjs.
// `node world/client/tools/tileset/gen-bedroom.mjs [out.json]`.
//
// This is a LANGUAGE-LEARNING room: every object is a recognisable, nameable A1
// "daily routine" noun (bed / wardrobe / nightstand / lamp / mirror / teddy / plant).
import { writeFileSync } from 'node:fs';
const out = process.argv[2] || 'world/client/public/assets/map/bedroomMap.json';

const MW = 22, MH = 18, RW = 14, RH = 12;
const ox = (MW - RW) >> 1, oy = (MH - RH) >> 1; // ox=4, oy=3

const SETS = [
  { name: 'floors',  image: '../tileset/Room_Builder_Floors_32x32.png', cols: 15, tilecount: 15 * 40 },
  { name: 'walls',   image: '../tileset/Room_Builder_3d_walls_32x32.png', cols: 24, tilecount: 24 * 59 },
  { name: 'sky',     image: '../tileset/Room_Builder_Sky_32x32.png', cols: 1, tilecount: 1 },
  { name: 'bedroom', image: '../tileset/Bedroom_Modern_32x32.png', cols: 16, tilecount: 16 * 107 },
];
let g = 1; for (const s of SETS) { s.firstgid = g; g += s.tilecount; }
const FL = SETS[0].firstgid, WL = SETS[1].firstgid, SKY = SETS[2].firstgid, BD = SETS[3].firstgid;

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

// --- bedroom furniture ----------------------------------------------------------
// The Bedroom sheet is 16 cols (Theme_Sorter_32x32/4_Bedroom_32x32.png, 16x107).
// EVERY footprint below was derived, never guessed — each was template-matched from the
// pack's per-object singles (Theme_Sorter_Shadowless_Singles_32x32/4_Bedroom_Singles_
// Shadowless_32x32/, matched against the shadowless sheet so neighbours' drop shadows
// can't bleed), then cross-checked with the navy-outline test (no bare fill running to a
// LEFT/RIGHT tile boundary) and an 8-connected flood fill. Verified footprints:
//   bed (double, top view)  930  2x3  single #217   <- 2 WIDE, and 3 TALL:
//                                       r58 headboard+pillows / r59 mattress / r60 footboard
//   wardrobe                1568 3x3  singles #513+#515+#516 (three 1x3 modules that abut;
//                                       flood confirms c0..c2 is ONE isolated component)
//   cupboard / linen press  1624 2x3  single #537
//   nightstand              1144 1x2  single #429
//   chest of drawers        1176 1x2  single #431
//   mirror                  1174 1x2  single #420
//   table lamp              1307 1x2  single #540
//   pinboard / photos       1208 1x2  single #451
//   teddy bear              1040 1x2  single #301
//   plant                   1195 1x1  single #443 / 1194 1x1 single #442
// REJECTED because the three checks disagreed (never guess): the curtained window at
// (c0,r75) — its single says 2x3 but the navy test finds 38px of bare fill on the right
// edge and the flood fill returns 3x3, so its true width is unresolved. The framed
// pictures 1140/1141 are likewise part of a 3x2 group, not standalone 1x2s.
const BDCOLS = 16;

// Overlap guard: each furniture/over cell may be claimed exactly once. A silent
// double-write is a clipped hybrid that still looks plausible — so throw instead.
const claimed = new Map();
const claim = (x, y, what) => {
  const k = y * W + x;
  if (claimed.has(k)) throw new Error(`overlap at (${x},${y}): ${what} collides with ${claimed.get(k)}`);
  claimed.set(k, what);
};

const putRect = (x, y, w, h, id0, what, target = furniture) => {
  if (x < ox + 1 || y < oy || x + w > ox + RW - 1 || y + h > oy + RH - 1)
    throw new Error(`${what} out of the room at (${x},${y}) ${w}x${h}`);
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    claim(x + c, y + r, what);
    target[(y + r) * W + (x + c)] = BD + id0 + r * BDCOLS + c;
  }
};
// A tall object: its BASE row collides (Furniture); the rows above go to Over so the
// player is occluded walking behind it and can stand in that space.
const putTall = (x, y, w, h, id0, what) => {
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    claim(x + c, y + r, what);
    const tgt = r === h - 1 ? furniture : over;
    tgt[(y + r) * W + (x + c)] = BD + id0 + r * BDCOLS + c;
  }
};

// Room geometry: oy = wall cap row, oy+1 = wall face row, oy+2 = FIRST FLOOR ROW.
const FLOOR0 = oy + 2; // 5
// Back-wall furniture with a vertical face (wardrobe/cupboard/nightstand/chest): these
// sprites carry ~16px of transparent TOP PADDING, so `topRow = FLOOR0 - (h-1)` lands the
// BASE on the first floor row and lets the body cover the wall band — no floor strip.
const backWall = (x, w, h, id0, what, tall) =>
  (tall ? putTall : putRect)(x, FLOOR0 - (h - 1), w, h, id0, what);

// --- against the back wall ---
backWall(5, 3, 3, 1568, 'wardrobe', true);    // der Kleiderschrank — tall: top rows -> Over
backWall(15, 2, 3, 1624, 'cupboard', true);   // der Schrank — tall: top rows -> Over
backWall(11, 1, 2, 1144, 'nightstand');       // der Nachttisch, right beside the headboard

// Wall-mounted: only a 1x2 sprite hangs correctly on the 2-row wall band (oy cap, oy+1
// face). A 1x1 has no valid row, so nothing 1x1 goes on the wall here.
// Being 1x2 is necessary but NOT sufficient: the sprite's ART must also fit the band's
// face. The mirror (art 24x28, topPad=14) hangs cleanly; the pinboard 1208 (art 32x44,
// topPad=8) was tried here and its top cards poked out of the wall into the sky, so it
// is not used. Checked in the PNG preview, not assumed.
putRect(13, oy, 1, 2, 1174, 'mirror');        // der Spiegel

// --- on the floor ---
// The bed is NOT a vertical-faced object: it is drawn top-down with topPad=0 and extends
// INTO the room. Its headboard must touch the wall base line, so its TOP row goes on the
// first floor row (FLOOR0). Using the vertical-face rule here would mount it up the wall.
// Same intent as that rule (no floor strip behind it), verified in the PNG preview.
putRect(9, FLOOR0, 2, 3, 930, 'bed');         // das Bett (double, headboard at the wall)
// The pack's table lamps are drawn to stand ON furniture (art ends 22px above the rect
// base), so one cannot share a tile with the nightstand without a double-write. It goes
// on the floor beside the bed instead. 1307 (grey, lit base) reads as a lamp; the green
// 1308 is indistinguishable from a plant at 32px.
putRect(12, 6, 1, 2, 1307, 'lamp');           // die Lampe — floor lamp beside the bed
putRect(5, 8, 1, 2, 1176, 'chest of drawers');// die Kommode
putTall(15, 8, 2, 2, 1348, 'bookshelf');      // das Regal — shelving: base collides, top -> Over
putRect(8, 10, 1, 2, 1040, 'teddy bear');     // der Teddybär
putRect(16, 11, 1, 1, 1195, 'plant');         // die Pflanze
putRect(5, 12, 1, 1, 1194, 'plant2');         // die Pflanze

// --- NOTHING COLLIDABLE MAY BLOCK THE DOOR: verify by flood fill, not by eye ---------
// Everything on Walls and Furniture is solid; Ground/Shadows/Over never collide.
const solid = (x, y) => walls[y * W + x] !== 0 || furniture[y * W + x] !== 0;
{
  const seen = new Set(); const q = [[dStart, by + 1]]; // start OUTSIDE, below the door gap
  seen.add((by + 1) * W + dStart);
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const k = ny * W + nx;
      if (seen.has(k) || solid(nx, ny)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  // the door gap itself must be walkable
  for (let x = dStart; x < dStart + DOOR_W; x++)
    if (!seen.has(by * W + x)) throw new Error(`door gap (${x},${by}) is blocked`);
  // every non-solid interior floor tile must be reachable from outside through that door
  const unreachable = [];
  for (let y = oy + 2; y <= oy + RH - 2; y++) for (let x = ox + 1; x <= ox + RW - 2; x++)
    if (!solid(x, y) && !seen.has(y * W + x)) unreachable.push(`(${x},${y})`);
  if (unreachable.length) throw new Error(`interior not reachable through the door: ${unreachable.join(' ')}`);
  // and the door's approach corridor must be clear of furniture
  for (let x = dStart; x < dStart + DOOR_W; x++) for (let y = by - 1; y >= by - 2; y--)
    if (furniture[y * W + x]) throw new Error(`furniture blocks the door corridor at (${x},${y})`);
  console.error(`door OK: gap x=${dStart}..${dStart + DOOR_W - 1} @y=${by}, ${seen.size} walkable tiles reachable from outside`);
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
console.error(`bedroom ${RW}x${RH} in ${MW}x${MH} -> ${out}`);
