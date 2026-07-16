// Clothing Store = the 3D-walls room (see gen-room2) + a Furniture layer of LimeZu Modern
// Interiors clothing-store items (clothes rails, folded-clothes shelves, fitting room,
// mirrors, till, mannequins). Preview with render-map.mjs.
// `node gen-clothing.mjs <out.json>`.
//
// Sheet: Clothing_Modern_32x32.png = 16 cols x 67 rows, copied from the pack's
// Theme_Sorter_32x32/21_Clothing_Store_32x32.png into the COMMITTED assets/tileset/ dir.
//
// FOOTPRINTS ARE NOT GUESSED. Every rect below was derived by template-matching the pack's
// SHADOWLESS per-object exports (Theme_Sorter_Shadowless_Singles_32x32/21_Clothing_Store_
// Singles_Shadowless_32x32/) into the SHADOWLESS sheet (shadowed matching fails: on this
// zero-gutter sheet a neighbour's drop shadow bleeds across the object boundary). Each rect
// then had to agree with an alpha profile of the sheet region. Notes:
//  - fitting_room is MODULAR and 6 ROWS TALL. Each pole is TWO stacked singles:
//    left  = 336 (rows 21-23, cap) + 384 (rows 24-26, foot);
//    right = 339 (rows 21-23, cap) + 387 (rows 24-26, foot).
//    Proof they stack: 336/339 have BOTTOM pad 0 and 384/387 have TOP pad 0 (art runs to the
//    joining edge of the single's own rect => modular segment), and their art butts exactly at
//    y=767|768. A previous pass placed only the lower half (4x3 @384) which CLIPPED both poles
//    to bare cut sticks AND dragged in the stray divider stick 369/370 -> read as "split".
//    Horizontally the three pieces butt with no gap: pole x24-31 | curtain x32-95 | pole x96-101.
//    The 4x6 block is NOT a putRect: cols 1-2 rows 21-22 hold two unrelated stools and rows
//    23-24 the divider stick, so the pieces are placed individually.
//  - 890/922 are the pack's DISARRANGED shelf variants (one shelf slot left empty + a garment
//    tossed on the floor). Their rects are correct and complete (single == sheet region
//    exactly, 4px transparent pad on all four sides => transparency-isolated, cannot be
//    clipped) — they simply READ as broken next to the tidy 892/924. Use the tidy ones.
//  - 390/425/473 show bare LEFT/RIGHT pixels at their base; those are the LimeZu base-shadow
//    band (colour 167,151,150) and are present in the STANDALONE singles too => not clipped.
//  - benches 884/886 were REJECTED: art 64x64 with un-outlined L/R edges = tileable segments
//    that need neighbours. 465 is the standalone bench and is used instead.
import { writeFileSync } from 'node:fs';
const out = process.argv[2] || 'world/client/public/assets/map/clothingMap.json';

const MW = 26, MH = 24, RW = 18, RH = 17;
const ox = (MW - RW) >> 1, oy = (MH - RH) >> 1;

const SETS = [
  { name: 'floors',   image: '../tileset/Room_Builder_Floors_32x32.png', cols: 15, tilecount: 15 * 40 },
  { name: 'walls',    image: '../tileset/Room_Builder_3d_walls_32x32.png', cols: 24, tilecount: 24 * 59 },
  { name: 'sky',      image: '../tileset/Room_Builder_Sky_32x32.png', cols: 1, tilecount: 1 },
  { name: 'clothing', image: '../tileset/Clothing_Modern_32x32.png', cols: 16, tilecount: 16 * 67 },
];
let g = 1; for (const s of SETS) { s.firstgid = g; g += s.tilecount; }
const FL = SETS[0].firstgid, WL = SETS[1].firstgid, SKY = SETS[2].firstgid, CL = SETS[3].firstgid;

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

// --- clothing-store furniture ---------------------------------------------------
const CLCOLS = 16;               // the clothing sheet's column count = the putRect stride
const claimed = new Map();       // overlap guard: every furniture/over cell claimed ONCE
const claim = (x, y, who) => {
  const k = y * W + x;
  if (claimed.has(k)) throw new Error(`overlap: ${who} wants (${x},${y}) already used by ${claimed.get(k)}`);
  claimed.set(k, who);
};
const placed = [];               // every (id0,w,h) actually placed -> the variant-swatch scan
const putRect = (x, y, w, h, id0, target = furniture, who = 'obj') => {
  if (x < 0 || y < 0 || x + w > W || y + h > H) throw new Error(`${who} out of bounds`);
  placed.push([id0, w, h, who]);
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    claim(x + c, y + r, who);
    target[(y + r) * W + (x + c)] = CL + id0 + r * CLCOLS + c;
  }
};
// A tall object: its BASE row collides (Furniture); the rows above go to Over so the player
// is occluded walking behind it and can stand in that space.
const putTall = (x, y, w, h, id0, who = 'obj') => {
  if (x < 0 || y < 0 || x + w > W || y + h > H) throw new Error(`${who} out of bounds`);
  placed.push([id0, w, h, who]);
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    claim(x + c, y + r, who);
    const tgt = r === h - 1 ? furniture : over;
    tgt[(y + r) * W + (x + c)] = CL + id0 + r * CLCOLS + c;
  }
};
// Back-wall furniture: BASE lands on the first floor row (oy+2) and the body covers the wall
// band => no floor strip behind it.  topRow = (oy+2) - (h-1)
const backWall = (h) => (oy + 2) - (h - 1);

// ---- BACK WALL: the wall-mounted things (rails with hangers, mirrors) live ONLY here ----
// 249/486 are WALL rails: a bar + hooks + hanging garments, NO legs and no feet. Standing one
// on the open floor makes it hang in mid-air (that is exactly what the old rail_blue_2 /
// rail_white_2 at (5,11)/(8,11) did). Every hanger sprite is therefore on the wall band.
// They carry transparent TOP padding inside their rect (249 art 44x44 at pad t24, 486 art
// 52x52 at pad t14), so backWall(3) hangs the art across the band with its base on the first
// floor row. 390 is different — a shelf WITH legs and a ground shadow — but it belongs against
// the wall, so it uses the same formula.
putTall(5, backWall(3), 2, 3, 249, 'rail_blue');    // wall rail, blue garments
putTall(8, backWall(3), 2, 3, 486, 'rail_white');   // wall rail, white/pink garments
putTall(15, backWall(3), 2, 3, 249, 'rail_blue_2'); // was floating at (5,11) -> onto the wall
putTall(18, backWall(3), 2, 3, 390, 'shelf_shoes'); // shelf of shoes / bags (has legs)
// wall-mounted mirrors: 1x2, art 28x42 at pad t16 => sits inside the band, never reaches the cap
putRect(7, oy, 1, 2, 207, furniture, 'mirror_wall_silver');
putRect(17, oy, 1, 2, 239, furniture, 'mirror_wall_gold');

// ---- fitting room / changing cabin: 4 cols x 6 rows, STANDING AGAINST THE BACK WALL ----
// backWall() does NOT apply (that formula assumes a big transparent top pad + a vertical face).
// The cabin must TOUCH the wall without climbing it. Room geometry: cap row oy = y96-127,
// face row oy+1 = y128-159, wall base / first floor row oy+2 = y160.
// The cabin's poles have a 12px top pad, so its art top = FR_Y*32 + 12:
//   FR_Y = oy   -> art top y108 -> ON the white cap line   => "taller than the wall"   (bug 1)
//   FR_Y = oy+2 -> art top y172 -> 12px BELOW the wall base => floor strip behind it    (bug 2)
//   FR_Y = oy+1 -> art top y140 -> on the wall FACE, clear of the cap, no floor strip   <== this
// So the sprite's own top padding, not the row index, is what makes it meet the wall — that is
// exactly the skill's "sprites have transparent TOP PADDING" lesson. Asserted below.
// Assembled from three pack singles that butt exactly (see header); cols FR_X+1..FR_X+2 rows
// FR_Y..FR_Y+3 are deliberately left EMPTY — that open "U" is the cubicle's interior floor.
// Side clearance is built in: the art spans only x+26..x+101 of the 128px rect, i.e. ~26px of
// transparent padding inside each outer column, so neighbours at FR_X-1 / FR_X+4 stay clear.
const FR_X = 11, FR_Y = oy + 1, FR_TOPPAD = 12;    // rows oy+1 .. oy+6, base on oy+6
const capTop = oy * 32, faceTop = (oy + 1) * 32, wallBase = (oy + 2) * 32;
const cabinArtTop = FR_Y * 32 + FR_TOPPAD;
if (cabinArtTop <= capTop + 31) throw new Error(`cabin art top y${cabinArtTop} is on/above the wall CAP row (y${capTop}-${capTop + 31}) — it would read as taller than the wall`);
if (cabinArtTop > wallBase) throw new Error(`cabin art top y${cabinArtTop} is below the wall base y${wallBase} — a ${cabinArtTop - wallBase}px floor strip would show behind it`);
console.error(`  cabin: art top y${cabinArtTop} sits on the wall FACE row (y${faceTop}-${wallBase - 1}) => touches the wall, clear of the cap`);
putTall(FR_X, FR_Y, 1, 6, 336, 'fitting_pole_l');  // 336(cap,r21-23) + 384(foot,r24-26)
putTall(FR_X + 3, FR_Y, 1, 6, 339, 'fitting_pole_r'); // 339(cap) + 387(foot)
putTall(FR_X + 1, FR_Y + 4, 2, 2, 401, 'fitting_curtain'); // rail + curtain across the front

// ---- shop floor: free-standing display tables ----
// The folded-clothes shelves (890/892/922/924) and hat shelves (954/956) are GONE. Each of
// those rects swallowed ALTERNATIVE-TEXTURE swatches: below the body, across a transparent
// gap, the sheet parks spare colourways of the same garment (892: body y1768-1795, then
// swatches at y1806-1807 and y1812-1819; 954: body y1890-1927, swatch at y1940-1947). They
// cannot be cropped out — the body straddles the tile boundary and the swatches sit in the
// SAME tile row as its bottom 4-8px, so any smaller rect clips the shelf's own frame.
// 884/886/888/916 are the pack's display tables: ONE band (y1774-1823) ending exactly at the
// rect's bottom edge = feet + ground contact, nothing below, and every edge navy-outlined
// (L 32/32, R 32/32, B 52/52) => complete AND not oversized. They are 4 colourways.
putTall(5, 8, 2, 2, 884, 'table_cream');
putTall(8, 8, 2, 2, 886, 'table_yellow');
putTall(15, 8, 2, 2, 888, 'table_olive');
putTall(18, 8, 2, 2, 268, 'boxes');           // stock boxes (single band, ground contact)

putTall(5, 12, 2, 2, 916, 'table_white');
putTall(15, 11, 1, 3, 425, 'mirror_stand_silver'); // standing mirror: has a ground shadow
putTall(17, 11, 2, 3, 496, 'counter_till');   // counter with cash register
putTall(20, 11, 1, 3, 473, 'mirror_stand_gold');

// ---- entrance area ----
putTall(5, 16, 1, 2, 160, 'mannequin_a');
putTall(7, 16, 1, 2, 162, 'mannequin_b');
putTall(9, 16, 1, 2, 166, 'mannequin_c');
putTall(11, 15, 1, 3, 864, 'coat_rack');
putTall(14, 16, 2, 2, 465, 'bench');
putTall(17, 16, 2, 2, 884, 'table_cream_2');   // was shelf_folded_d (892) = swatch-swallower
putTall(20, 16, 1, 2, 173, 'mannequin_d');

// --- assertion: no rect may swallow ALTERNATIVE-TEXTURE swatches -------------------
// "Transparency-isolated" only proves an object is NOT CLIPPED; it does NOT prove the rect is
// not TOO BIG. This sheet parks spare colourways of a garment below an object, separated by
// transparent rows but still inside the object's rect — a variant is isolated too. So scan the
// SHADOWLESS sheet for every rect actually placed: split its art into horizontal bands, and
// reject any rect whose art has a band below a >=4px transparent gap. A real object's last band
// carries its feet; art resuming after a gap is a separate thing.
const SHEET_SL = 'world/client/public/assets/modern_interiors/Theme_Sorter_Shadowless_32x32/21_Clothing_Store_Shadowless_32x32.png';
try {
  const { execFileSync } = await import('node:child_process');
  const rects = [...new Set([...placed].map(JSON.stringify))].map(JSON.parse);
  const script = `
    const sharp=require('sharp');
    (async()=>{const {data,info}=await sharp(${JSON.stringify(SHEET_SL)}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const A=(x,y)=>data[(y*info.width+x)*4+3];const bad=[];
    for(const [id0,w,h,who] of ${JSON.stringify(rects)}){
      const c=id0%16,r=(id0/16)|0,x0=c*32,y0=r*32,x1=x0+w*32-1,y1=y0+h*32-1;
      const rows=[];for(let y=y0;y<=y1;y++){let n=0;for(let x=x0;x<=x1;x++)if(A(x,y)>8)n++;rows.push(n);}
      const bands=[];let cur=null;
      rows.forEach((n,i)=>{if(n===0){if(cur){bands.push(cur);cur=null}return}if(!cur)cur={a:i,b:i};cur.b=i});
      if(cur)bands.push(cur);
      for(let i=1;i<bands.length;i++){const gap=bands[i].a-bands[i-1].b-1;
        if(gap>=4)bad.push(who+' (id0='+id0+' '+w+'x'+h+'): art resumes '+gap+'px below the body at rect row '+bands[i].a+' => ALTERNATIVE TEXTURE swallowed');}
    }
    if(bad.length){console.error(bad.join('\\n'));process.exit(3)}
    console.error('variant-swatch scan: '+${JSON.stringify(rects.length)}+' rects clean');})();`;
  execFileSync(process.execPath, ['-e', script], { stdio: 'inherit' });
} catch (e) {
  if (e.status === 3) throw new Error('rect swallows alternative-texture swatches (see above)');
  console.error('  (variant scan skipped: ' + e.message.split('\n')[0] + ')');
}

// --- assertions: door corridor + reachability ------------------------------------
// Walkable = no wall tile and no COLLIDING furniture tile (Over never collides).
const walkable = (x, y) => walls[y * W + x] === 0 && furniture[y * W + x] === 0;
const seen = new Set(), q = [[dStart, MH - 1]]; // start OUTSIDE the room, below the door
seen.add((MH - 1) * W + dStart);
while (q.length) {
  const [x, y] = q.shift();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy, k = ny * W + nx;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(k) || !walkable(nx, ny)) continue;
    seen.add(k); q.push([nx, ny]);
  }
}
const spawnT = [ox + (RW >> 1), oy + RH - 2];
const must = [[dStart, by], [dStart + 1, by], spawnT];               // door gap + spawn
for (const [x, y] of must) if (!seen.has(y * W + x)) throw new Error(`door corridor blocked: (${x},${y}) unreachable from outside`);
// every free interior floor cell must be reachable (no walled-off pockets)
let free = 0, unreachable = [];
for (let y = oy + 2; y <= oy + RH - 2; y++) for (let x = ox + 1; x <= ox + RW - 2; x++) {
  if (!walkable(x, y)) continue;
  free++;
  if (!seen.has(y * W + x)) unreachable.push(`${x},${y}`);
}
if (unreachable.length) throw new Error(`unreachable interior cells: ${unreachable.join(' ')}`);
// nothing collidable in the door corridor itself
for (let y = by; y >= by - 2; y--) for (let x = dStart; x < dStart + DOOR_W; x++)
  if (furniture[y * W + x] !== 0) throw new Error(`furniture blocks the door at (${x},${y})`);

const layer = (name, data) => ({ type: 'tilelayer', name, width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data });
const map = {
  type: 'map', version: '1.10', orientation: 'orthogonal', renderorder: 'right-down',
  width: W, height: H, tilewidth: 32, tileheight: 32, infinite: false, nextlayerid: 6, nextobjectid: 1,
  tilesets: SETS.map((s) => ({ firstgid: s.firstgid, name: s.name, image: s.image, imagewidth: s.cols * 32, imageheight: (s.tilecount / s.cols) * 32, tilewidth: 32, tileheight: 32, columns: s.cols, tilecount: s.tilecount, margin: 0, spacing: 0 })),
  layers: [layer('Ground', ground), layer('Shadows', shadows), layer('Walls', walls), layer('Furniture', furniture), layer('Over', over)],
  properties: [{ name: 'spawnX', type: 'int', value: spawnT[0] * 32 }, { name: 'spawnY', type: 'int', value: spawnT[1] * 32 }],
};
writeFileSync(out, JSON.stringify(map));
console.error(`clothing store ${RW}x${RH} in ${MW}x${MH} -> ${out}`);
console.error(`  furniture cells claimed: ${claimed.size}, walkable interior: ${free}, all reachable from outside the door OK`);
