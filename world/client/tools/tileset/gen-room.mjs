// Generate a simple rectangular room as a Tiled map: floor fill + 4 walls border.
// Walls go in their own tile layer so the engine can collide them by exclusion.
//   node gen-room.mjs <out.json> [w=40] [h=30] [floorId=133] [wallId=597]
import { writeFileSync } from 'node:fs';
const [out, W = 40, H = 30, floorId = 133, wallId = 597] = process.argv.slice(2);
const w = +W, h = +H, FG = 1; // FloorAndGround firstgid = 1
const floor = FG + Number(floorId), wall = FG + Number(wallId);

const ground = [], walls = [];
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  ground.push(floor);
  const border = (x === 0 || y === 0 || x === w - 1 || y === h - 1);
  walls.push(border ? wall : 0);
}
const layer = (name, data) => ({ type: 'tilelayer', name, width: w, height: h, x: 0, y: 0, opacity: 1, visible: true, data });
const map = {
  type: 'map', version: '1.10', tiledversion: '1.10.0', orientation: 'orthogonal', renderorder: 'right-down',
  width: w, height: h, tilewidth: 32, tileheight: 32, infinite: false, nextlayerid: 3, nextobjectid: 1,
  tilesets: [{ firstgid: FG, name: 'FloorAndGround', image: 'FloorAndGround.png', imagewidth: 2048, imageheight: 1280, tilewidth: 32, tileheight: 32, columns: 64, tilecount: 2560, margin: 0, spacing: 0 }],
  layers: [layer('Ground', ground), layer('Walls', walls)],
};
writeFileSync(out, JSON.stringify(map));
console.error(`room ${w}x${h} -> ${out} | floor gid ${floor}, wall gid ${wall}, ${walls.filter(Boolean).length} wall tiles`);
