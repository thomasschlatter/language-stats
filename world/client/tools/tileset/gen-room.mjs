// Generate a rectangular room inside a map as a Tiled map. The room can be smaller
// than the map (centred, with empty/void around it). Floor + walls each accept a
// COLOR NAME (resolved via floorandground-palette.json) or a raw tile ID.
//   node gen-room.mjs <out.json> <mapW> <mapH> <roomW> <roomH> <floor> <wall>
//   e.g. node gen-room.mjs roomMap.json 40 30 18 14 wood grey-stone
import { writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [out, mapW = 40, mapH = 30, roomW = 18, roomH = 14, floorArg = 'wood', wallArg = 'grey-stone'] = process.argv.slice(2);
const MW = +mapW, MH = +mapH, RW = +roomW, RH = +roomH, FG = 1;
const pal = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'floorandground-palette.json'), 'utf8'));
const resolve = (arg, kind) => {
  if (/^\d+$/.test(arg)) return +arg;
  const id = pal[kind][arg];
  if (id === undefined) { console.error(`unknown ${kind.slice(0, -1)} color "${arg}". options: ${Object.keys(pal[kind]).join(', ')}`); process.exit(1); }
  return id;
};
const floor = FG + resolve(floorArg, 'floors'), wall = FG + resolve(wallArg, 'walls');

// centre the room in the map
const ox = Math.floor((MW - RW) / 2), oy = Math.floor((MH - RH) / 2);
const ground = [], walls = [];
for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
  const inRoom = x >= ox && x < ox + RW && y >= oy && y < oy + RH;
  const border = inRoom && (x === ox || y === oy || x === ox + RW - 1 || y === oy + RH - 1);
  ground.push(inRoom ? floor : 0);   // floor only inside the room; void outside
  walls.push(border ? wall : 0);
}
const layer = (name, data) => ({ type: 'tilelayer', name, width: MW, height: MH, x: 0, y: 0, opacity: 1, visible: true, data });
const map = {
  type: 'map', version: '1.10', tiledversion: '1.10.0', orientation: 'orthogonal', renderorder: 'right-down',
  width: MW, height: MH, tilewidth: 32, tileheight: 32, infinite: false, nextlayerid: 3, nextobjectid: 1,
  // spawn point (object) so the engine can centre the player inside the room
  tilesets: [{ firstgid: FG, name: 'FloorAndGround', image: 'FloorAndGround.png', imagewidth: 2048, imageheight: 1280, tilewidth: 32, tileheight: 32, columns: 64, tilecount: 2560, margin: 0, spacing: 0 }],
  layers: [layer('Ground', ground), layer('Walls', walls)],
  properties: [
    { name: 'spawnX', type: 'int', value: (ox + RW / 2) * 32 },
    { name: 'spawnY', type: 'int', value: (oy + RH / 2) * 32 },
  ],
};
writeFileSync(out, JSON.stringify(map));
console.error(`map ${MW}x${MH}, room ${RW}x${RH} at (${ox},${oy}) | floor ${floorArg}=gid${floor}, wall ${wallArg}=gid${wall} | spawn (${(ox + RW / 2) * 32},${(oy + RH / 2) * 32})`);
