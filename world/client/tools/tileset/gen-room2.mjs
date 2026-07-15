// Config-driven room generator for LimeZu Room_Builder: floor fill + a wall frame
// placed by ROLE (corners/edges) from the 3D-walls sheet + a floor-shadow ring.
// Three tilesets (floor, walls, shadows) each get a firstgid range. Edit ROLES and
// re-run; preview with render-map.mjs before deploying.
import { writeFileSync } from 'node:fs';
const out = process.argv[2] || 'world/client/public/assets/map/roomMap.json';
// Material selection (proves the role map generalizes):
//   WALL_OFF = column offset into the 3d_walls sheet: -8 brown · 0 grey · +8 blue-grey
//   FLOOR_ID = floor center tile: 46 blue · 50 cream · 54 red · 58 green (row3 centers)
const WALL_OFF = Number(process.argv[3] ?? 0);
const FLOOR_ID = Number(process.argv[4] ?? 50);
const MW = 24, MH = 18, RW = 14, RH = 10;              // map + room (centered)
const ox = ((MW - RW) >> 1), oy = ((MH - RH) >> 1);

// tilesets (name, image path relative to the map, cols) — firstgid assigned below
const SETS = [
  { name: 'floors', image: '../tileset/Room_Builder_Floors_32x32.png', cols: 15, tilecount: 15 * 40 },
  { name: 'walls',  image: '../tileset/Room_Builder_3d_walls_32x32.png', cols: 24, tilecount: 24 * 59 },
  { name: 'sky',    image: '../tileset/Room_Builder_Sky_32x32.png', cols: 1, tilecount: 1 },
];
let g = 1; for (const s of SETS) { s.firstgid = g; g += s.tilecount; }
const FL = SETS[0].firstgid, WL = SETS[1].firstgid, SKY = SETS[2].firstgid;

// ROLE map (0-based tile ids within each sheet) — fully verified for the grey wall
// material + cream floor. Change material via WALL_OFF / FLOOR_ID (see top). The wall
// frame is a 2-row top band + descending single-column sides + a bottom baseboard row
// with a door gap; the floor carries a transparent shadow overlay along top + left.
const FLOOR = FLOOR_ID;           // floor center fill (no baked shadow); default 50 = cream
// Grey 3D wall (per user). The TOP wall is a 2-row band: a cap row over a face
// row. The LEFT/RIGHT walls descend as single vertical columns from that band.
const TL = 201, TR = 206;         // top corners, cap row (outer corners that wrap the edge)
const TL2 = 203, TR2 = 204;       // top corners, face row
const TOP_CAP = [227, 228];       // top-band cap-row fill (alternating)
const TOP_FACE = [251, 252];      // top-band face-row fill (alternating)
const RWALL = 302;                // right wall body (confirmed, below 204)
const LWALL = 297;                // left wall body (confirmed)
const BL = 298, BR = 301;         // bottom corners
const BOT = [299, 300];           // bottom edge fill (alternating)
const DOOR_W = 2;                 // door opening width (tiles); 0 = closed wall
const DOOR_L = 301, DOOR_R = 298; // wall caps flanking the door (left/right)
// Floor-shadow overlay (transparent tiles from the FLOORS sheet), cast along the
// top + left interior edges. Three thicknesses (confirmed by user + alpha analysis):
//   thin {tl:0,top:1,tr:2,left:15} · mid {4,5,6,19} · thick {8,9,10,23}
const SHADOW = { tl: 4, top: 5, tr: 6, left: 19 };

const W = MW, H = MH;
const ground = new Array(W * H).fill(0);
const walls = new Array(W * H).fill(0);
const put = (arr, x, y, gid) => { if (gid != null) arr[y * W + x] = WL + gid + WALL_OFF; };
// sky everywhere (flying-castle surround), then stamp the cream room floor on top
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ground[y * W + x] = SKY;
for (let y = oy; y < oy + RH; y++) for (let x = ox; x < ox + RW; x++) ground[y * W + x] = FL + FLOOR;

// top wall band (2 rows) with corners
put(walls, ox, oy, TL); put(walls, ox + RW - 1, oy, TR);
put(walls, ox, oy + 1, TL2); put(walls, ox + RW - 1, oy + 1, TR2);
for (let x = ox + 1; x < ox + RW - 1; x++) {
  const i = (x - ox - 1) % 2;
  put(walls, x, oy, TOP_CAP[i]);
  put(walls, x, oy + 1, TOP_FACE[i]);
}
// side walls descending below the band (down to the row above the bottom)
for (let y = oy + 2; y < oy + RH - 1; y++) {
  put(walls, ox, y, LWALL);
  put(walls, ox + RW - 1, y, RWALL);
}
// bottom edge row: corners + alternating fill, with a centered door gap
const by = oy + RH - 1;
const dStart = ox + ((RW - DOOR_W) >> 1);   // first door-opening column
put(walls, ox, by, BL);
put(walls, ox + RW - 1, by, BR);
for (let x = ox + 1; x < ox + RW - 1; x++) {
  if (DOOR_W > 0 && x >= dStart && x < dStart + DOOR_W) continue;        // door opening (floor shows through)
  if (DOOR_W > 0 && x === dStart - 1) { put(walls, x, by, DOOR_L); continue; }      // left cap
  if (DOOR_W > 0 && x === dStart + DOOR_W) { put(walls, x, by, DOOR_R); continue; } // right cap
  put(walls, x, by, BOT[(x - ox - 1) % 2]);
}

// floor-shadow overlay layer: TL corner + top edge + TR corner along the first
// interior row, and the left edge running down the first interior column.
const shadows = new Array(W * H).fill(0);
const sput = (x, y, id) => { if (id != null) shadows[y * W + x] = FL + id; };
const ix0 = ox + 1, ix1 = ox + RW - 2, iy0 = oy + 2, iy1 = oy + RH - 2; // interior floor bounds
sput(ix0, iy0, SHADOW.tl);
for (let x = ix0 + 1; x <= ix1; x++) sput(x, iy0, SHADOW.top); // top edge runs to the rightmost interior cell
sput(ix1 + 1, iy0, SHADOW.tr);                                 // TR corner shifted one right, into the wall cell
for (let y = iy0 + 1; y <= iy1; y++) sput(ix0, y, SHADOW.left);

const layer = (name, data) => ({ type: 'tilelayer', name, width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data });
const map = {
  type: 'map', version: '1.10', orientation: 'orthogonal', renderorder: 'right-down',
  width: W, height: H, tilewidth: 32, tileheight: 32, infinite: false, nextlayerid: 3, nextobjectid: 1,
  tilesets: SETS.map((s) => ({ firstgid: s.firstgid, name: s.name, image: s.image, imagewidth: s.cols * 32, imageheight: (s.tilecount / s.cols) * 32, tilewidth: 32, tileheight: 32, columns: s.cols, tilecount: s.tilecount, margin: 0, spacing: 0 })),
  layers: [layer('Ground', ground), layer('Shadows', shadows), layer('Walls', walls)],
  properties: [{ name: 'spawnX', type: 'int', value: (ox + RW / 2) * 32 }, { name: 'spawnY', type: 'int', value: (oy + RH / 2) * 32 }],
};
writeFileSync(out, JSON.stringify(map));
console.error(`room ${RW}x${RH} in ${MW}x${MH} | floor gid ${FL + FLOOR} | wall firstgid ${WL} -> ${out}`);
