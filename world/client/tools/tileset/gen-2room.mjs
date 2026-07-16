// Two-room "front/back" construct for LimeZu Room_Builder: a back room (top) and a
// front room (bottom) sharing a horizontal DIVIDING wall with a connecting door, all
// inside one outer frame, floating on a sky surround. Reuses the verified single-room
// role map (see gen-room2.mjs) + adds a horizontal interior wall with a 2-tall door.
// Preview with render-map.mjs before wiring. `node gen-2room.mjs <out.json>`.
import { writeFileSync } from 'node:fs';
const out = process.argv[2] || 'world/client/public/assets/map/twoRoomMap.json';

const MW = 24, MH = 26;                 // map
const RW = 14;                          // building interior width (+ side walls)
const RHb = 6, RHf = 6;                 // back / front room interior heights
const ox = (MW - RW) >> 1;
const BH = 2 + RHb + 2 + RHf + 1;       // top band + back + divider band + front + baseboard
const oy = (MH - BH) >> 1;

const SETS = [
  { name: 'floors', image: '../tileset/Room_Builder_Floors_32x32.png', cols: 15, tilecount: 15 * 40 },
  { name: 'walls',  image: '../tileset/Room_Builder_3d_walls_32x32.png', cols: 24, tilecount: 24 * 59 },
  { name: 'sky',    image: '../tileset/Room_Builder_Sky_32x32.png', cols: 1, tilecount: 1 },
];
let g = 1; for (const s of SETS) { s.firstgid = g; g += s.tilecount; }
const FL = SETS[0].firstgid, WL = SETS[1].firstgid, SKY = SETS[2].firstgid;

// --- verified role map (grey walls, cream floor) ---
const FLOOR = 50;
const TL = 201, TR = 206, TL2 = 203, TR2 = 204;     // top-band outer corners (cap / face)
const CAP = [227, 228], FACE = [251, 252];          // horizontal wall band fill (cap / face rows)
const LWALL = 297, RWALL = 302;                     // vertical side walls
const BL = 298, BR = 301, BOT = [299, 300];         // bottom baseboard
const DOOR_L = 301, DOOR_R = 298;                   // baseboard door caps (entrance)
const DJL = [248, 272], DJR = [176, 200];           // dividing-wall door jambs: left [cap,face], right [cap,face]
const SHADOW = { tl: 4, top: 5, tr: 6, left: 19 };  // mid floor-shadow overlay

const W = MW, H = MH;
const ground = new Array(W * H).fill(0);
const walls = new Array(W * H).fill(0);
const shadows = new Array(W * H).fill(0);
const wput = (x, y, id) => { if (id != null) walls[y * W + x] = WL + id; };
const sput = (x, y, id) => { if (id != null) shadows[y * W + x] = FL + id; };
const alt = (arr, i) => arr[i % arr.length];

// key rows
const topY = oy;                 // outer top band rows: topY, topY+1
const backY0 = oy + 2;           // back room floor first row
const divY = backY0 + RHb;       // dividing band rows: divY, divY+1
const frontY0 = divY + 2;        // front room floor first row
const botY = frontY0 + RHf;      // bottom baseboard row
const L = ox, R = ox + RW - 1;   // left / right wall columns

// sky everywhere, then stamp both room floors (cream) — interior spans backY0..botY-1
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ground[y * W + x] = SKY;
for (let y = backY0; y < botY; y++) for (let x = L; x <= R; x++) ground[y * W + x] = FL + FLOOR;

// helper: a horizontal wall band (2 rows) across the interior columns with alternating fill
const band = (y0, doorL, doorW) => {
  for (let x = L + 1; x < R; x++) {
    const i = (x - L - 1) % 2;
    // carve a door if within [doorL, doorL+doorW)
    if (doorW > 0 && x >= doorL && x < doorL + doorW) continue;             // opening (both rows empty)
    if (doorW > 0 && x === doorL - 1) { wput(x, y0, DJL[0]); wput(x, y0 + 1, DJL[1]); continue; } // left jamb
    if (doorW > 0 && x === doorL + doorW) { wput(x, y0, DJR[0]); wput(x, y0 + 1, DJR[1]); continue; } // right jamb
    wput(x, y0, alt(CAP, i)); wput(x, y0 + 1, alt(FACE, i));
  }
};

// outer top band + corners
wput(L, topY, TL); wput(R, topY, TR);
wput(L, topY + 1, TL2); wput(R, topY + 1, TR2);
band(topY, -1, 0);

// dividing wall band (with a centered 2-wide door front<->back)
const dW = 2, dL = L + ((RW - dW) >> 1);
band(divY, dL, dW);
// dividing band ends butt into the side walls (approximate with the side-wall tiles)
wput(L, divY, LWALL); wput(L, divY + 1, LWALL);
wput(R, divY, RWALL); wput(R, divY + 1, RWALL);

// side walls: down the back room, and down the front room (skip the divider band rows)
for (let y = topY + 2; y < divY; y++) { wput(L, y, LWALL); wput(R, y, RWALL); }
for (let y = divY + 2; y < botY; y++) { wput(L, y, LWALL); wput(R, y, RWALL); }

// bottom baseboard with entrance door
wput(L, botY, BL); wput(R, botY, BR);
const eW = 2, eL = L + ((RW - eW) >> 1);
for (let x = L + 1; x < R; x++) {
  if (x >= eL && x < eL + eW) continue;
  if (x === eL - 1) { wput(x, botY, DOOR_L); continue; }
  if (x === eL + eW) { wput(x, botY, DOOR_R); continue; }
  wput(x, botY, alt(BOT, (x - L - 1) % 2));
}

// floor-shadow overlay: top+left ring inside EACH room (back under outer top band, front under divider)
const ring = (roomTopY, roomBotY) => {
  const ix0 = L + 1, ix1 = R - 1, iy0 = roomTopY, iy1 = roomBotY;
  sput(ix0, iy0, SHADOW.tl);
  for (let x = ix0 + 1; x <= ix1; x++) sput(x, iy0, SHADOW.top);
  sput(ix1 + 1, iy0, SHADOW.tr);
  for (let y = iy0 + 1; y <= iy1; y++) sput(ix0, y, SHADOW.left);
};
ring(backY0, divY - 1);       // back room interior rows
const frontShY = frontY0 + 1; // front room's shadow sits one row below the divider (per user)
ring(frontShY, botY - 1);     // front room interior rows
// no shadow under the door gap (no wall above the opening casts there)
for (let x = dL; x < dL + dW; x++) shadows[frontShY * W + x] = 0;

const layer = (name, data) => ({ type: 'tilelayer', name, width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data });
const map = {
  type: 'map', version: '1.10', orientation: 'orthogonal', renderorder: 'right-down',
  width: W, height: H, tilewidth: 32, tileheight: 32, infinite: false, nextlayerid: 4, nextobjectid: 1,
  tilesets: SETS.map((s) => ({ firstgid: s.firstgid, name: s.name, image: s.image, imagewidth: s.cols * 32, imageheight: (s.tilecount / s.cols) * 32, tilewidth: 32, tileheight: 32, columns: s.cols, tilecount: s.tilecount, margin: 0, spacing: 0 })),
  layers: [layer('Ground', ground), layer('Shadows', shadows), layer('Walls', walls)],
  properties: [{ name: 'spawnX', type: 'int', value: (L + RW / 2) * 32 }, { name: 'spawnY', type: 'int', value: (frontY0 + RHf / 2) * 32 }],
};
writeFileSync(out, JSON.stringify(map));
console.error(`2-room ${RW}x${BH} | back ${RHb} / front ${RHf} | divider@${divY} door@${dL} -> ${out}`);
