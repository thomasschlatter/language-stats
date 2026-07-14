import Phaser from 'phaser'
import { AVATAR_STYLES } from '../components/characterstyles'
import { FRAMES } from './frames'

// Re-composites another player's custom avatar locally from the layer indices
// they broadcast over Colyseus — so we can show everyone's real character
// without any external image bucket. Mirrors the self-avatar compositing in
// CharacterCreation exactly (same POSITIONS, same layer order) so the resulting
// 52-frame sheet is identical and the shared animation names line up.

// Source→dest rects for each pose block, copied verbatim from CharacterCreation.
const POSITIONS: Record<string, { sx: number; sy: number; sWidth: number; sHeight: number; dx: number; dy: number; dWidth: number; dHeight: number }> = {
  IDLE_RIGHT: { sx: 0, sy: 74, sWidth: 192, sHeight: 54, dx: 0, dy: 0, dWidth: 192, dHeight: 48 },
  IDLE_UP: { sx: 192, sy: 74, sWidth: 192, sHeight: 54, dx: 192, dy: 0, dWidth: 192, dHeight: 48 },
  IDLE_LEFT: { sx: 384, sy: 74, sWidth: 192, sHeight: 54, dx: 384, dy: 0, dWidth: 192, dHeight: 48 },
  IDLE_DOWN: { sx: 576, sy: 74, sWidth: 192, sHeight: 54, dx: 576, dy: 0, dWidth: 192, dHeight: 48 },
  RUN_RIGHT: { sx: 0, sy: 138, sWidth: 192, sHeight: 54, dx: 768, dy: 0, dWidth: 192, dHeight: 48 },
  RUN_UP: { sx: 192, sy: 138, sWidth: 192, sHeight: 54, dx: 960, dy: 0, dWidth: 192, dHeight: 48 },
  RUN_LEFT: { sx: 384, sy: 138, sWidth: 192, sHeight: 54, dx: 1152, dy: 0, dWidth: 192, dHeight: 48 },
  RUN_DOWN: { sx: 576, sy: 138, sWidth: 192, sHeight: 54, dx: 1344, dy: 0, dWidth: 192, dHeight: 48 },
  SIT_RIGHT: { sx: 0, sy: 268, sWidth: 32, sHeight: 54, dx: 1600, dy: 0, dWidth: 32, dHeight: 48 },
  SIT_LEFT: { sx: 192, sy: 268, sWidth: 32, sHeight: 54, dx: 1568, dy: 0, dWidth: 32, dHeight: 48 },
  SIT_UP: { sx: 192, sy: 524, sWidth: 32, sHeight: 54, dx: 1632, dy: 0, dWidth: 32, dHeight: 48 },
  SIT_DOWN: { sx: 576, sy: 524, sWidth: 32, sHeight: 54, dx: 1536, dy: 0, dWidth: 32, dHeight: 48 },
}

// The layers the complete sheet is built from, drawn bottom-to-top.
const LAYERS = ['Bodies', 'Hairstyles', 'Eyes', 'Accessories', 'Outfits']

const loadImage = (src: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })

// Register idle/run/sit animations for a freshly-composited texture key.
function ensureAnims(scene: Phaser.Scene, key: string) {
  for (const [suffix, f] of Object.entries(FRAMES)) {
    const animKey = `${key}_${suffix}`
    if (scene.anims.exists(animKey)) continue
    scene.anims.create({
      key: animKey,
      frames: scene.anims.generateFrameNumbers(key, { start: f.start, end: f.end }),
      repeat: f.repeat,
      frameRate: f.frameRate,
    })
  }
}

/**
 * Build the character sheet for `index` and register it under `key` (plus its
 * animations). Idempotent and fully guarded — returns false on any failure so
 * callers fall back to the default character. `index` is the avatarStyleIndex
 * object the other player broadcast (Bodies/Hairstyles/Eyes/Accessories/Outfits).
 */
export async function loadRemoteAvatar(
  scene: Phaser.Scene,
  key: string,
  index: Record<string, number>
): Promise<boolean> {
  try {
    if (!key || !index) { console.warn('[avatar] bad key/index', key, index); return false }
    if (scene.textures.exists(key)) {
      ensureAnims(scene, key)
      return true
    }
    console.log('[avatar] compositing', key, index)

    const styles = AVATAR_STYLES as Record<string, string[]>
    const imgs: Record<string, HTMLImageElement | null> = {}
    await Promise.all(
      LAYERS.map(async (layer) => {
        const src = styles[layer]?.[index[layer] ?? 0]
        imgs[layer] = src ? await loadImage(src) : null
      })
    )
    console.log('[avatar] layers loaded', LAYERS.map((l) => `${l}:${imgs[l] ? 'ok' : 'MISSING'}`).join(' '))

    const canvas = document.createElement('canvas')
    canvas.width = 1664 // 52 frames * 32px
    canvas.height = 48
    const ctx = canvas.getContext('2d')
    if (!ctx) return false
    for (const p of Object.values(POSITIONS)) {
      for (const layer of LAYERS) {
        const img = imgs[layer]
        if (!img) continue
        ctx.drawImage(img, p.sx, p.sy, p.sWidth, p.sHeight, p.dx, p.dy, p.dWidth, p.dHeight)
      }
    }

    // Phaser's texture manager wants an <img>, so round-trip through a data URL.
    const dataURL = canvas.toDataURL('image/png')
    const sheet = await loadImage(dataURL)
    if (!sheet) { console.warn('[avatar] sheet image failed to load', key); return false }
    if (!scene.textures.exists(key)) {
      scene.textures.addSpriteSheet(key, sheet as any, { frameWidth: 32, frameHeight: 48 })
    }
    if (!scene.textures.exists(key)) { console.warn('[avatar] addSpriteSheet failed', key); return false }
    ensureAnims(scene, key)
    console.log('[avatar] composite OK', key)
    return true
  } catch (e) {
    console.error('[avatar] composite FAILED', key, e)
    return false
  }
}
