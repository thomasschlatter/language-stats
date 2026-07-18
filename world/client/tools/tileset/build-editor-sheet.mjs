// build-editor-sheet.mjs — a CLASSIFIED OBJECT LIBRARY for the level editor (create-level.html),
// packed into ONE compact 32-column sheet + a manifest the editor loads.
//
// BATCH 1 of a progressive rollout. Objects come from the SINGLES of three LimeZu themes (each
// single is one complete, pre-isolated object on transparency — so rects are trivial by
// construction, exactly like build-bangkok-sheet.mjs's `single:` path):
//   2_City_Terrains_Singles  -> GROUND tiles (pavement / asphalt / kerb / zebra / cracks)
//   3_City_Props_Singles     -> street props, clutter, nature, food, vehicles, signage
//   5_Floor_Modular_Building -> building PIECES (roof / storey / shopfront bands) that we COMPOSE
//                               into WHOLE buildings, plus self-contained specialty storefronts.
//
// *** WHY COMPOSE FOR 5_Floor. *** The user's rule, proven on the Bangkok tables: "i dont want this
// modularity in the app, just create combinations." The Floor_Modular singles are BANDS, not whole
// buildings: Roof_N (7x6/7x7), Middle_Floor_N (7x4), Ground_Floor_Shop_N (7x3). A whole building is
// a vertical stack roof+storey+shopfront (all 7 wide, so they abut seamlessly). RENDERED every combo
// and looked (_scratch/buildings.png): each reads as one coherent front-elevation building ending in
// a tiled roofline — no cut-off, no two-camera-angles. Only the FRONT-ELEVATION tiled roofs are used
// (Roof_2/4/6/8/9/11); the top-down roof planes (Roof_1/3/5/7/10) are the "roof seen from above on a
// front elevation" defect the Bangkok street spent days killing, so they are not stacked.
//
// The specialty storefronts (Bakery/Butchery/Gym/Ice_Cream/Bait_Shop/Music/Gun) are already WHOLE
// one-storey shops — the big sign protrudes above the shopfront as the top of the object — so they
// are exposed as standalone building singles, no composition needed.
//
// *** THE MODULAR FRAGMENTS ARE NOT EXPOSED. *** Container_Modular, Trash_Pile_Modular,
// Pedestrian_Barrier_Post_Modular, Traffic_*_Mod and the 5_Floor *_Modular 1-wide slices are tiling
// PIECES, not objects. The palette gets the WHOLE versions (Container, Trash_Pile, Pedestrian_
// Barrier_Post, Traffic_Sign) and the composed buildings instead — never a lone band or half.
//
// SOURCE KINDS (all exact multiples of 32 — rect is ground truth by construction):
//   single: 'Name'          one pre-isolated single PNG.
//   dup:    ['Name', n]     one single tiled horizontally n times (for the 2-wide zebra objects the
//                           editor's City-street preset addresses as id0 and id0+1).
//   vstack: ['A','B','C']   several EQUAL-WIDTH singles composited top-to-bottom into one building.
//
// Output: ME_Editor_32x32.png (32 cols, id = row*32 + col) + ME_Editor_32x32.json
//   node world/client/tools/tileset/build-editor-sheet.mjs
import sharp from 'sharp';
import { writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUB = resolve(HERE, '../../public/assets');
const PACK = `${PUB}/modern_exteriors_pack/ME_Theme_Sorter_32x32`;
const OUT_PNG = `${PUB}/tileset/ME_Editor_32x32.png`;
const OUT_JSON = `${PUB}/tileset/ME_Editor_32x32.json`;

// ===========================================================================================
// THEME REGISTRY — adding a theme later is: point at its singles dir + give its name-rules.
// (Terrain and Buildings need bespoke composition/preset work, so they are built explicitly below;
// the PROP themes are the ones this registry drives generically.)
// ===========================================================================================
const DIR = {
  terr: `${PACK}/2_City_Terrains_Singles_32x32`,
  prop: `${PACK}/3_City_Props_Singles_32x32`,
  mod: `${PACK}/5_Floor_Modular_Building_Singles_32x32`,
  genb: `${PACK}/4_Generic_Building_Singles_32x32`,
};
const terr = (n) => `${DIR.terr}/ME_Singles_City_Terrains_32x32_${n}.png`;
const prop = (n) => `${DIR.prop}/ME_Singles_City_Props_32x32_${n}.png`;
const modb = (n) => `${DIR.mod}/ME_Singles_Floor_Modular_Building_32x32_${n}.png`;
const genb = (n) => `${DIR.genb}/ME_Singles_Generic_Building_32x32_${n}.png`;

const PROP_THEMES = [
  { dir: DIR.prop, prefix: 'ME_Singles_City_Props_32x32_', load: (base) => prop(base) },
  // Later batches append { dir, prefix, load } here and the classify rules below cover them.
];

// -------------------------------------------------------------------------------------------
// CLASSIFY BY NAME — regex rules, not per-item judgement. Order matters: first match wins.
// -------------------------------------------------------------------------------------------
// Files that are fragments / duplicate variants / non-objects: never packed.
// Trash_Truck: the 3_City_Props directional trash-truck FRAMES (Left/Right/Up/Down) are skipped —
// the Vehicles tab is now populated by the dedicated VEHICLES pass below (whole side-view vehicles).
const SKIP = /(_Modular|Modular_|_Mod$|_Mod_|_Example|_Hollow|_Empty($|_)|Shutter_Closed|Giant_Cone|Helix_Propeller|Trash_Truck|desktop)/i;

// category (editor tab). Buildings/structures, Vehicles, Nature, Food, Street, Furniture, Clutter,
// else "City Props". (Vehicles are built by the dedicated VEHICLES pass, not name-classified here.)
function categorize(name) {
  if (/Tree|Shrub|Flower|Bush|\bPot\b|Pigeon/i.test(name)) return { category: 'Nature' };
  if (/Candies_Cart|_Cart|Stall/i.test(name)) return { category: 'Food' };
  if (/Kiosk|Water_Tower|Power_House|Container_House|Junk_Shack|Wind_Turbine|Solar_Panel|Underground_Parking|Phone_Booth/i.test(name))
    return { category: 'Buildings' };
  if (/Traffic_Sign|Traffic_Light|Danger_Sign|Info_Sign|Hydrant_Sign|\bSign\b|Billboard|Barrier|Parking_Meter|Mailbox|Electric_Pole|\bPole\b|Street_Lamp|\bLamp\b|Hydrant|EV_Charging|Drinking_Fountain|\bFountain\b|\bATM\b|Phone/i.test(name))
    return { category: 'Street' };
  if (/Bench|Chair|Stool|Seat/i.test(name)) return { category: 'Furniture' };
  if (/Barrel|Trash|\bBin\b|Trashbin|Dumpster|\bBox\b|Cardboard|\bCone\b|\bJunk\b|Scrap|\bTire\b|\bBrick\b|Manhole|\bGrate\b|Holes|Brake_Marks|Container|Debris|Rubble|_Pile|Stake|Milk|_Can|Paper|Pizza|\bDrone\b|Antenna|Structure|Roof_Prop|Hanging_Clothes|Car_Wreck/i.test(name))
    return { category: 'Clutter' };
  return { category: 'City Props' };
}

// layer + solid. Flat decals -> Decor/0; roof-mounted -> Over/0; buildings -> Walls/full;
// everything else a prop -> Furniture/1 (bottom-row footprint = 2.5D walk-behind).
function placement(name, category) {
  if (category === 'Terrain') return { layer: 'Ground', solid: 0 };
  if (category === 'Buildings') return { layer: 'Walls', solid: 2 }; // base collide, upper facade walk-behind
  if (/Manhole|\bGrate\b|Holes|Brake_Marks|Small_Trash_Pile|Trash_Pile_Props/i.test(name)) return { layer: 'Decor', solid: 0 };
  if (/Structure_Roof|Roof_Prop|Structure_Yellow_Light|Structure_Red_Light|Structure_Roof_Red/i.test(name)) return { layer: 'Over', solid: 0 };
  return { layer: 'Furniture', solid: 1 };
}

// interactions (editor flags). Reasonable name-based defaults; multiple may apply.
function interactions(name) {
  const t = new Set();
  if (/Bench|Chair|Stool|Seat/i.test(name)) { t.add('sittable'); t.add('moveable'); }
  if (/Barrel|Trashbin|Trash_Can|\bBin\b|Dumpster|\bPot\b/i.test(name)) { t.add('container'); t.add('moveable'); t.add('breakable'); }
  if (/\bBox\b|Cardboard|\bBrick\b|\bTire\b|_Can_Trash|Milk|Paper_Trash|Pizza_Trash|Juice|\bJunk\b|Scrap|Single_Trash|\bTrash\b/i.test(name)) { t.add('takeable'); t.add('moveable'); t.add('breakable'); }
  if (/\bLamp\b|Street_Light|Traffic_Light|Lantern|Yellow_Light|Red_Light/i.test(name)) { t.add('lightSource'); t.add('breakable'); }
  if (/\bSign\b|Billboard|Board|Info_Sign|Danger_Sign/i.test(name)) t.add('readable');
  if (/Ladder/i.test(name)) t.add('climbable');
  if (/\bATM\b|Phone|Vending|Machine|Meter|Charging|EV_|Drinking_Fountain/i.test(name)) t.add('usable');
  if (/\bCone\b|Glass|Window|Bottle/i.test(name)) t.add('breakable');
  return [...t];
}

// word (vocab) — only the obvious ones; blank otherwise. Matched against the base name.
const WORD_RULES = [
  [/Tree/i, 'tree'], [/Shrub|Bush/i, 'bush'], [/Flower/i, 'flower'], [/\bPot\b/i, 'plant pot'],
  [/Bench/i, 'bench'], [/Street_Lamp|\bLamp\b/i, 'lamp'], [/Hydrant/i, 'hydrant'],
  [/Mailbox/i, 'mailbox'], [/Barrel/i, 'barrel'], [/\bCone\b/i, 'cone'], [/Broken_Ladder|Ladder/i, 'ladder'],
  [/Phone_Booth/i, 'phone booth'], [/\bATM\b/i, 'ATM'], [/Fountain/i, 'fountain'],
  [/Trashbin|Trash_Can/i, 'trash can'], [/Pigeon/i, 'pigeon'], [/Trash_Truck/i, 'truck'],
  [/Car_Wreck/i, 'car'], [/Billboard/i, 'billboard'], [/Traffic_Light/i, 'traffic light'],
  [/Dumpster/i, 'dumpster'], [/Bicycle|Bike/i, 'bicycle'],
];
const wordOf = (name) => (WORD_RULES.find(([re]) => re.test(name)) || [null, undefined])[1];

// ===========================================================================================
// 1) TERRAIN — the editor's built-in "City street" preset needs these EXACT keys. Every mapping
// below was verified by simulating the preset and rendering a street strip (_scratch/strip.png):
// pavement -> kerb_n -> asphalt+dash -> zebra crossing -> kerb_s -> pavement all read correctly and
// the Sidewalk-1 asphalt matches the Asphalt_1 road tile.
// *** THE PRESET USES EACH TERRAIN KEY AS A 1x1 GROUND CELL (it addresses only id0), so the fill
// tiles MUST be 1x1 — a 2x2 pavement would only ever show its top-left quadrant. The zebra keys are
// the one exception: the preset paints a 2-wide crossing addressing id0 AND id0+1, so those must be
// exactly 2 wide. Sidewalk_1_9 is the one uniform 1x1 pavement fill (mean-luma 203, std 17); the
// Asphalt_1 road base (85,81,83) matches the Sidewalk kerb asphalt exactly (measured).
//   pave/pave_s  Sidewalk_1_9 (1x1 pavement fill; reused for both — a symmetric street)
//   asph         Asphalt_1_Variation_16 (1x1 plain asphalt; 1..15 are ROAD PAINT, 16..27 plain/cracks)
//   dash         Asphalt_1_Variation_2  (1x1 centre lane line)
//   kerb_n       Sidewalk_1_6  (1x1 pavement TOP / asphalt BOTTOM — road edge leaving the pavement)
//   kerb_s       Sidewalk_1_2  (1x1 asphalt TOP / pavement BOTTOM)
//   zebra_t/m/b  Sidewalk_1_29 / _30 / _32 — already 2x1 in the source; packed as-is (id0, id0+1)
// ===========================================================================================
const TERRAIN_PRESET = [
  { key: 'pave', single: 'Sidewalk_1_9' },
  { key: 'pave_s', single: 'Sidewalk_1_9' },
  { key: 'asph', single: 'Asphalt_1_Variation_16' },
  { key: 'dash', single: 'Asphalt_1_Variation_2' },
  { key: 'kerb_n', single: 'Sidewalk_1_6' },
  { key: 'kerb_s', single: 'Sidewalk_1_2' },
  { key: 'zebra_t', single: 'Sidewalk_1_29' },
  { key: 'zebra_m', single: 'Sidewalk_1_30' },
  { key: 'zebra_b', single: 'Sidewalk_1_32' },
];
// Extra terrain spread (Terrain tab, Ground/0): the whole Sidewalk_1 street kit (edges, corners,
// zebra, drains, parking, bus-stop) minus the tiles already claimed as preset keys; the full
// Asphalt_1 set (road paint 1..15 + cracks 17..27) minus the two preset asphalt tiles; and one
// pavement fill from each of the other five sidewalk colourways.
const SW1_USED = new Set([2, 6, 9, 29, 30, 32]);
const ASPH_USED = new Set([2, 16]);
const TERRAIN_EXTRA = [];
for (let i = 1; i <= 54; i++) if (!SW1_USED.has(i)) TERRAIN_EXTRA.push({ key: `sw1_${i}`, single: `Sidewalk_1_${i}` });
for (let i = 1; i <= 27; i++) if (!ASPH_USED.has(i)) TERRAIN_EXTRA.push({ key: `asphv_${i}`, single: `Asphalt_1_Variation_${i}` });
for (let s = 2; s <= 6; s++) TERRAIN_EXTRA.push({ key: `pave_${'_bcdef'[s - 1]}`, single: `Sidewalk_${s}_25` });

const TERRAIN = [...TERRAIN_PRESET, ...TERRAIN_EXTRA].map((s) => ({
  ...s, load: terr, category: 'Terrain', layer: 'Ground', solid: 0,
}));

// ===========================================================================================
// 2) BUILDINGS from 5_Floor. Six WHOLE buildings (front-elevation tiled roof + storey + signed
// shopfront, all 7 wide) + seven self-contained specialty storefronts. Colourways coordinated and
// eyeballed in _scratch/buildings.png / _scratch/specialty.png.
// ===========================================================================================
const BUILDINGS = [
  { key: 'bldg_red_plume', vstack: ['Roof_2', 'Middle_Floor_1', 'Ground_Floor_Shop_1'], word: 'building' },   // red roof / orange
  { key: 'bldg_red_groove', vstack: ['Roof_8', 'Middle_Floor_5', 'Ground_Floor_Shop_5'], word: 'building' },  // red+chimneys / orange
  { key: 'bldg_grey_coolies', vstack: ['Roof_4', 'Middle_Floor_7', 'Ground_Floor_Shop_19'], word: 'building' },// grey roof / blue
  { key: 'bldg_grey_plume', vstack: ['Roof_9', 'Middle_Floor_10', 'Ground_Floor_Shop_13'], word: 'building' }, // grey+chimneys / blue
  { key: 'bldg_olive_groove', vstack: ['Roof_6', 'Middle_Floor_13', 'Ground_Floor_Shop_29'], word: 'building' },// olive roof / grey
  { key: 'bldg_olive_bimbum', vstack: ['Roof_11', 'Middle_Floor_17', 'Ground_Floor_Shop_33'], word: 'building' },// olive+chimneys / grey
  { key: 'shop_bakery', single: 'Ground_Floor_Bakery_1', word: 'bakery' },
  { key: 'shop_butchery', single: 'Ground_Floor_Butchery_1', word: 'butcher' },
  { key: 'shop_gym', single: 'Ground_Floor_Gym_1', word: 'gym' },
  { key: 'shop_icecream', single: 'Ground_Floor_Ice_Cream_Shop_1', word: 'ice cream' },
  { key: 'shop_baitshop', single: 'Ground_Floor_Bait_Shop_1', word: 'shop' },
  { key: 'shop_music', single: 'Ground_Floor_Music_Store_1', word: 'music store' },
  { key: 'shop_gun', single: 'Ground_Floor_Gun_Store_1', word: 'shop' },
].map((s) => ({ ...s, load: modb, category: 'Buildings', layer: 'Walls', solid: 2, interactions: ['enterable'] }));

// 2b) MORE BUILDINGS from 4_Generic_Building — whole pre-isolated condo / apartment / storefront
// singles (a taller, modern look next to the shophouses). Complete by construction (singles).
const CONDOS = [
  { key: 'condo_brick_a', single: 'Condo_4_38', word: 'apartment' },
  { key: 'condo_brick_b', single: 'Condo_4_39', word: 'apartment' },
  { key: 'condo_stone', single: 'Condo_6', word: 'building' },
  { key: 'condo_tower', single: 'Condo_3_46', word: 'apartment' },
  { key: 'condo_terrace', single: 'Condo_8', word: 'building' },
  { key: 'condo_round', single: 'Condo_9', word: 'building' },
  { key: 'condo_teal', single: 'Condo_4_40', word: 'building' },
  { key: 'shop_grey_a', single: 'Condo_5_1', word: 'shop' },
  { key: 'shop_grey_b', single: 'Condo_5_2', word: 'shop' },
  { key: 'shop_hardware', single: 'Hardware_Store', word: 'hardware store' },
].map((s) => ({ ...s, load: genb, category: 'Buildings', layer: 'Walls', solid: 2, interactions: ['enterable'] }));

// ===========================================================================================
// 3) VEHICLES — real drivable vehicles, ONE clean static side-view frame each, cut from the
// ANIMATED source sheets (Modern Exteriors Animated_32x32 pack, committed under modern_exteriors_pack).
// These are NOT ME_Theme_Sorter singles: each crop rect below was derived by opaque-BBOX MEASUREMENT
// on the source sheet's side-view driving band and verified by rendering the frame ×N on magenta
// (scratch renders), so it is one whole vehicle — not clipped, not two overlapping, no neighbour.
// This REPLACES the old 8 directional trash-truck frames that used to fill the Vehicles tab.
//
//   kind:'vehicle'  — dynamic road agent (placed on roads; runtime, not static collision).
//   canTurn         — the source sheet HAS turn/rotation frames, so the agent can round junctions.
//                     Cars: yes (left/right/diagonal turn rows w/ red arrows). Buses: yes (same turn
//                     rows + diagonal frames — verified on Buses_32x32_1). Trash trucks: NO — the
//                     sheet is straight-drive frames only, zero turn/rotation rows.
//   driveable       — a player can enter + steer it GTA-style; needs turn frames, so it implies
//                     canTurn. Cars/buses: yes. Trash trucks: no (can't steer without turn frames).
//
// Crop rects (px, whole tiles) — verified extents (opaque bbox inside the crop):
//   car_*   Car_classic_<color>_complete: cols1-4 rows4-6  (128x96, bbox x34-159 y150-223) — all 5
//           colours share ONE template (identical alpha mask + 7264 opaque px each, measured).
//   bus_N   Buses_32x32_N:                cols1-7 rows7-10 (224x128, bbox x32-255 y228-351) — all 6
//           sheets share ONE template (identical mask + 26720 opaque px each, measured).
//   trash*  Trash_Truck[_2]_32x32:        cols0-7 rows10-14 (256x160, bbox x20-255 y328-479).
// ===========================================================================================
const AVEH = `${PUB}/modern_exteriors_pack/Animated_32x32/Vehicles_32x32`;
const carVeh = (color) => ({
  key: `car_${color}`, word: 'car', canTurn: true, driveable: true,
  crop: { file: `${AVEH}/Cars_32x32/Car_classic_${color}_complete_32x32.png`, left: 32, top: 128, w: 128, h: 96 },
});
const busVeh = (n) => ({
  key: `bus_${n}`, word: 'bus', canTurn: true, driveable: true,
  crop: { file: `${AVEH}/Buses_32x32/Buses_32x32_${n}.png`, left: 32, top: 224, w: 224, h: 128 },
});
const trashVeh = (key, file) => ({
  key, word: 'truck', canTurn: false, driveable: false,
  crop: { file: `${AVEH}/Trash_Truck_32x32/${file}`, left: 0, top: 320, w: 256, h: 160 },
});
const VEHICLES = [
  ...['blue', 'green', 'grey', 'orange', 'red'].map(carVeh),
  ...[1, 2, 3, 4, 5, 6].map(busVeh),
  trashVeh('trash_truck', 'Trash_Truck_32x32.png'),
  trashVeh('trash_truck_orange', 'Trash_Truck_2_32x32.png'),
].map((s) => ({ ...s, category: 'Vehicles', kind: 'vehicle', layer: 'Furniture', solid: 1 }));

// ===========================================================================================
// 4) PROPS — generated from the singles directory by the name rules above.
// ===========================================================================================
const PROPS = [];
for (const theme of PROP_THEMES) {
  for (const f of readdirSync(theme.dir)) {
    if (!f.endsWith('.png')) continue;
    const base = f.slice(theme.prefix.length, -4);
    if (!f.startsWith(theme.prefix) || SKIP.test(base)) continue;
    const { category, kind } = categorize(base);
    const { layer, solid } = placement(base, category);
    const inter = interactions(base);
    const word = wordOf(base);
    const key = base.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    PROPS.push({
      key, single: base, load: theme.load, category, layer, solid,
      ...(kind ? { kind } : {}), ...(inter.length ? { interactions: inter } : {}), ...(word ? { word } : {}),
    });
  }
}

// ===========================================================================================
// LOAD every object, MEASURING w/h from pixels (never trusting the name).
// ===========================================================================================
const SPEC = [...TERRAIN, ...BUILDINGS, ...CONDOS, ...VEHICLES, ...PROPS];
const seen = new Set();
for (const s of SPEC) { if (seen.has(s.key)) throw new Error(`duplicate key: ${s.key}`); seen.add(s.key); }

const shortSrc = (p) => p.slice(p.indexOf('ME_Theme_Sorter'));
const bleedWarnings = [];

async function loadSingle(p) {
  const m = await sharp(p).metadata();
  if (m.width % 32 || m.height % 32) throw new Error(`${p}: single ${m.width}x${m.height} not tile-aligned`);
  return { buf: await sharp(p).png().toBuffer(), w: m.width / 32, h: m.height / 32 };
}

// EDGE-BLEED CHECK (the skill's MODULAR detector): a pre-isolated single should be padded or drawn
// flush on its L/R edges. A single whose left OR right edge is >60% opaque is a suspect half meant to
// pair — flag it (we don't auto-combine props; the only true modular set here is 5_Floor, composed).
async function edgeBleed(p, w, h) {
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  let L = 0, R = 0;
  for (let y = 0; y < H; y++) { if (data[(y * W) * 4 + 3] >= 128) L++; if (data[(y * W + W - 1) * 4 + 3] >= 128) R++; }
  if (L / H > 0.6 || R / H > 0.6) bleedWarnings.push(`${shortSrc(p)} (${w}x${h}) L=${(100 * L / H) | 0}% R=${(100 * R / H) | 0}%`);
}

const objs = [];
for (const s of SPEC) {
  let buf, w, h, src;
  if (s.dup) {
    const [name, n] = s.dup;
    const one = await loadSingle(s.load(name));
    w = one.w * n; h = one.h;
    buf = await sharp({ create: { width: w * 32, height: h * 32, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite(Array.from({ length: n }, (_, i) => ({ input: one.buf, left: i * one.w * 32, top: 0 }))).png().toBuffer();
    src = `${shortSrc(s.load(name))} x${n}`;
  } else if (s.crop) {
    // VEHICLE FRAME — extract a measured, tile-aligned rect from an animated source sheet. The rect
    // is whole tiles by construction; guard alignment + in-bounds so a bad rect fails loudly (never
    // silently slices a vehicle in half — the recurring clipped-object bug).
    const { file, left, top, w: pw, h: ph } = s.crop;
    if (left % 32 || top % 32 || pw % 32 || ph % 32) throw new Error(`${s.key}: crop ${left},${top} ${pw}x${ph} not tile-aligned`);
    const m = await sharp(file).metadata();
    if (left + pw > m.width || top + ph > m.height) throw new Error(`${s.key}: crop ${left},${top} ${pw}x${ph} out of ${m.width}x${m.height}`);
    buf = await sharp(file).extract({ left, top, width: pw, height: ph }).png().toBuffer();
    w = pw / 32; h = ph / 32;
    src = `${file.slice(file.indexOf('Animated_32x32'))} @${left},${top} ${w}x${h}`;
  } else if (s.vstack) {
    // WHOLE BUILDING = equal-width singles composited top-to-bottom. Each is a complete band by
    // construction, so there is no rect to slice; the guard just enforces one width and tile-align.
    const parts = [];
    let y = 0; w = null; h = 0;
    for (const name of s.vstack) {
      const one = await loadSingle(s.load(name));
      if (w === null) w = one.w; else if (one.w !== w) throw new Error(`${s.key}/${name}: width ${one.w} != stack width ${w} — a building must be one width`);
      parts.push({ input: one.buf, left: 0, top: y * 32 }); y += one.h; h += one.h;
    }
    buf = await sharp({ create: { width: w * 32, height: h * 32, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite(parts).png().toBuffer();
    src = `vstack ${s.vstack.join('+')} ${w}x${h}`;
  } else {
    const p = s.load(s.single);
    const one = await loadSingle(p);
    buf = one.buf; w = one.w; h = one.h; src = shortSrc(p);
    if (s.category !== 'Terrain') await edgeBleed(p, w, h);
  }
  objs.push({ ...s, buf, w, h, src });
}

// ===========================================================================================
// SHELF-PACK into 32 columns, tallest first (same packer as build-bangkok-sheet.mjs).
// ===========================================================================================
const COLS = 32;
const order = [...objs].sort((a, b) => b.h - a.h || b.w - a.w);
const shelves = [];
for (const o of order) {
  if (o.w > COLS) throw new Error(`${o.key}: ${o.w} wide does not fit ${COLS} columns`);
  let shelf = shelves.find((s) => s.x + o.w <= COLS && s.h >= o.h);
  if (!shelf) { shelf = { y: shelves.reduce((a, s) => a + s.h, 0), x: 0, h: o.h }; shelves.push(shelf); }
  o.tx = shelf.x; o.ty = shelf.y; shelf.x += o.w;
}
const ROWS = shelves.reduce((a, s) => a + s.h, 0);

await sharp({ create: { width: COLS * 32, height: ROWS * 32, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(objs.map((o) => ({ input: o.buf, left: o.tx * 32, top: o.ty * 32 }))).png().toFile(OUT_PNG);

const manifest = { image: 'ME_Editor_32x32.png', cols: COLS, rows: ROWS, tilecount: COLS * ROWS, objects: {} };
for (const o of objs) {
  const solid = o.solid === 'full' ? o.h : (o.solid ?? 0);
  manifest.objects[o.key] = {
    id0: o.ty * COLS + o.tx, w: o.w, h: o.h, category: o.category, layer: o.layer, solid,
    ...(o.interactions?.length ? { interactions: o.interactions } : {}),
    ...(o.word ? { word: o.word } : {}), ...(o.kind ? { kind: o.kind } : {}),
    ...(o.canTurn !== undefined ? { canTurn: o.canTurn } : {}),
    ...(o.driveable !== undefined ? { driveable: o.driveable } : {}), src: o.src,
  };
}
// GUARD: the "City street" preset addresses each fill key as a 1x1 ground cell (id0 only) and each
// zebra key as a 2-wide crossing (id0, id0+1). A wrong-sized tile renders as a corner/half — this
// was a real bug (Sidewalk_1_25 pavement is 2x2). Fail loudly if a preset tile is the wrong shape.
for (const k of ['pave', 'pave_s', 'asph', 'dash', 'kerb_n', 'kerb_s']) {
  const o = manifest.objects[k]; if (!o) throw new Error(`preset key ${k} missing`);
  if (o.w !== 1 || o.h !== 1) throw new Error(`preset fill '${k}' is ${o.w}x${o.h}, must be 1x1 (the preset uses only id0)`);
}
for (const k of ['zebra_t', 'zebra_m', 'zebra_b']) {
  const o = manifest.objects[k]; if (!o) throw new Error(`preset key ${k} missing`);
  if (o.w !== 2 || o.h !== 1) throw new Error(`preset zebra '${k}' is ${o.w}x${o.h}, must be 2x1 (preset reads id0 and id0+1)`);
}

writeFileSync(OUT_JSON, JSON.stringify(manifest, null, 2));

// ===========================================================================================
// REPORT
// ===========================================================================================
const byCat = {};
for (const o of objs) byCat[o.category] = (byCat[o.category] || 0) + 1;
const px = COLS * 32 * ROWS * 32;
console.error(`ME_Editor_32x32.png  ${COLS}x${ROWS} tiles (${COLS * 32}x${ROWS * 32}px, ${(px / 1e6).toFixed(2)}MP) — ${objs.length} objects, ${objs.reduce((a, o) => a + o.w * o.h, 0)} tiles used`);
console.error('per category: ' + Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(', '));
console.error(`preset terrain keys present: ${['pave', 'pave_s', 'asph', 'dash', 'kerb_n', 'kerb_s', 'zebra_t', 'zebra_m', 'zebra_b'].every((k) => manifest.objects[k]) ? 'ALL 9 OK' : 'MISSING'}`);
if (bleedWarnings.length) console.error(`edge-bleed suspects (${bleedWarnings.length}): ${bleedWarnings.slice(0, 20).join(' | ')}${bleedWarnings.length > 20 ? ' …' : ''}`);
else console.error('edge-bleed suspects: none (all singles padded/flush)');
const veh = Object.entries(manifest.objects).filter(([, o]) => o.kind === 'vehicle');
console.error(`vehicles (${veh.length}): ` + veh.map(([k, o]) => `${k} ${o.w}x${o.h} turn=${o.canTurn} drive=${o.driveable}`).join(', '));
