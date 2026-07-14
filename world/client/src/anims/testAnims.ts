import Phaser from 'phaser'

// Derived by measuring Bodies/32x32/Body_32x32_08.png against the labels in
// Spritesheet_animations_GUIDE.png (rows detected via alpha-band scan, frame
// counts via 32px column occupancy, and the user's row-by-row confirmation).
//
// `y` is the top of the 54px-tall sprite band (same convention as the existing
// idle/walk/sit POSITIONS: band-top minus ~8px of head padding). `frames` is the
// number of 32px cells in the row INCLUDING any prop frames (carts, books, guns)
// that trail the character frames — for this first test pass each row plays its
// whole strip left-to-right so we can eyeball where the real animation ends.
export interface TestRow {
  name: string
  label: string
  y: number
  frames: number
  fps: number
}

export const TEST_ROWS: TestRow[] = [
  { name: 'idle', label: 'idle (4×6)', y: 74, frames: 24, fps: 8 },
  { name: 'walk', label: 'walk (4×6)', y: 138, frames: 24, fps: 12 },
  { name: 'sleep', label: 'sleep (6)', y: 192, frames: 13, fps: 6 },
  { name: 'sit_rl', label: 'sit R/L (6+6)', y: 266, frames: 12, fps: 6 },
  { name: 'sit_ud', label: 'sit U/D (12)', y: 330, frames: 12, fps: 6 },
  { name: 'phone', label: 'phone (12)', y: 394, frames: 14, fps: 8 },
  { name: 'book', label: 'book read (12)', y: 458, frames: 26, fps: 8 },
  { name: 'push_cart', label: 'push cart (4×6)', y: 508, frames: 48, fps: 10 },
  { name: 'pick_up', label: 'pick up', y: 588, frames: 48, fps: 10 },
  { name: 'gift', label: 'gift', y: 652, frames: 42, fps: 10 },
  { name: 'lift', label: 'lift', y: 716, frames: 56, fps: 12 },
  { name: 'throw', label: 'throw', y: 780, frames: 56, fps: 12 },
  { name: 'hit', label: 'hit (4×6)', y: 844, frames: 24, fps: 12 },
  { name: 'punch', label: 'punch (4×6)', y: 908, frames: 24, fps: 12 },
  { name: 'stab', label: 'stab', y: 972, frames: 48, fps: 12 },
  { name: 'grab_gun', label: 'grab gun', y: 1036, frames: 16, fps: 10 },
  { name: 'gun_idle', label: 'gun idle (4×6)', y: 1098, frames: 24, fps: 8 },
  { name: 'shoot', label: 'shoot', y: 1164, frames: 13, fps: 12 },
  { name: 'hurt', label: 'hurt', y: 1228, frames: 13, fps: 10 },
]

const FW = 32
const FH = 54

/**
 * Slice every animation row out of the loaded body sheet (`sheetKey`) as named
 * frames and register a looping `test_<name>` animation for each. Idempotent and
 * guarded — safe to call once per scene create. Returns the rows it registered.
 */
export function buildTestAnims(scene: Phaser.Scene, sheetKey = 'bodytest'): TestRow[] {
  const tex = scene.textures.get(sheetKey)
  if (!tex || tex.key === '__MISSING') return []
  for (const row of TEST_ROWS) {
    const frameRefs: { key: string; frame: string }[] = []
    for (let i = 0; i < row.frames; i++) {
      const fn = `${row.name}_${i}`
      if (!tex.has(fn)) tex.add(fn, 0, i * FW, row.y, FW, FH)
      frameRefs.push({ key: sheetKey, frame: fn })
    }
    const animKey = `test_${row.name}`
    if (!scene.anims.exists(animKey)) {
      scene.anims.create({ key: animKey, frames: frameRefs, frameRate: row.fps, repeat: -1 })
    }
  }
  return TEST_ROWS
}
