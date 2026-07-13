import Phaser from 'phaser'
import { recordResult } from '../game/progress'

// Memory Match: a grid of face-down tiles, half words and half meanings. Flip
// two; if a word meets its meaning they stay up. Clear the board to win. Reuses
// the same /api/flashcards/quiz data as the Shooter game.
type Tile = {
  pairId: number
  text: string
  rect: Phaser.GameObjects.Rectangle
  label: Phaser.GameObjects.Text
  matched: boolean
  faceUp: boolean
}

export default class Memory extends Phaser.Scene {
  private tiles: Tile[] = []
  private first?: Tile
  private matched = 0
  private pairs = 0
  private moves = 0
  private busy = true
  private lang = 'de-DE'
  private hud!: Phaser.GameObjects.Text
  private info!: Phaser.GameObjects.Text

  constructor() { super('memory') }

  init() {
    this.tiles = []
    this.first = undefined
    this.matched = 0
    this.pairs = 0
    this.moves = 0
    this.busy = true
  }

  async create() {
    const W = this.scale.width
    const H = this.scale.height
    this.cameras.main.setBackgroundColor('#141b30')

    this.add.text(W / 2, 34, '🧠  Memory Match', { fontSize: '30px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(10)
    this.hud = this.add.text(16, 16, '', { fontSize: '17px', color: '#ffffff' }).setDepth(10)
    this.info = this.add.text(W / 2, H - 30, 'Match each word to its meaning', { fontSize: '16px', color: '#9fb0d8' }).setOrigin(0.5).setDepth(10)

    const exit = this.add.text(W - 16, 16, '✕ Menu', { fontSize: '18px', color: '#9fb0d8' })
      .setOrigin(1, 0).setDepth(10).setInteractive({ useHandCursor: true })
    exit.on('pointerdown', () => this.scene.start('gamemenu'))
    this.input.keyboard?.addKey('ESC').on('down', () => this.scene.start('gamemenu'))

    // Language from the profile, then a small pool of cards.
    try {
      const me = await fetch('/api/auth/me', { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null))
      const learning = me?.user?.learning
      if (learning && learning.length) this.lang = learning[0]
    } catch { /* keep default */ }

    let items: { front: string; answer: string }[] = []
    try {
      const res = await fetch(`/api/flashcards/quiz?lang=${encodeURIComponent(this.lang)}&n=8`, { credentials: 'same-origin' })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'could not load a game')
      }
      items = (await res.json()).items || []
    } catch (e: any) {
      this.info.setText((e.message || 'Could not load a game') + '  ·  Esc for menu')
      return
    }
    // Unique fronts, up to 8 pairs (fits a 4-column board nicely).
    const seen = new Set<string>()
    const pairsData = items.filter((it) => (seen.has(it.front) ? false : seen.add(it.front))).slice(0, 8)
    this.pairs = pairsData.length
    if (this.pairs < 2) {
      this.info.setText('Add a few more cards to this deck to play.  ·  Esc for menu')
      return
    }

    // Build tiles: a word tile and a meaning tile per pair, then shuffle.
    const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] } return a }
    const specs: { pairId: number; text: string }[] = []
    pairsData.forEach((p, i) => { specs.push({ pairId: i, text: p.front }); specs.push({ pairId: i, text: p.answer }) })
    shuffle(specs)

    // Grid layout (4 columns), centred under the title.
    const cols = 4
    const rows = Math.ceil(specs.length / cols)
    const gap = 12
    const areaTop = 66
    const areaH = H - areaTop - 54
    const tileW = Math.min(160, (W * 0.94 - gap * (cols - 1)) / cols)
    const tileH = Math.min(96, (areaH - gap * (rows - 1)) / rows)
    const gridW = cols * tileW + (cols - 1) * gap
    const startX = (W - gridW) / 2 + tileW / 2
    const startY = areaTop + tileH / 2

    specs.forEach((spec, i) => {
      const cx = startX + (i % cols) * (tileW + gap)
      const cy = startY + Math.floor(i / cols) * (tileH + gap)
      const rect = this.add.rectangle(cx, cy, tileW, tileH, 0x2c3f66, 0.98).setStrokeStyle(2, 0x4a5f8f).setInteractive({ useHandCursor: true })
      const label = this.add.text(cx, cy, '?', { fontSize: '22px', color: '#8fa0c8', align: 'center', wordWrap: { width: tileW - 16 } }).setOrigin(0.5)
      const tile: Tile = { pairId: spec.pairId, text: spec.text, rect, label, matched: false, faceUp: false }
      rect.on('pointerdown', () => this.flip(tile))
      this.tiles.push(tile)
    })

    this.updateHud()
    this.busy = false
  }

  private updateHud() {
    this.hud.setText(`Pairs ${this.matched}/${this.pairs}    Moves ${this.moves}`)
  }

  private setFace(tile: Tile, up: boolean) {
    tile.faceUp = up
    tile.label.setText(up ? tile.text : '?')
    tile.label.setColor(up ? '#ffffff' : '#8fa0c8')
    tile.label.setFontSize(up ? 18 : 22)
    tile.rect.setFillStyle(up ? 0x35507e : 0x2c3f66, 0.98)
  }

  private flip(tile: Tile) {
    if (this.busy || tile.matched || tile.faceUp) return
    this.setFace(tile, true)

    if (!this.first) { this.first = tile; return }

    // Second tile of the move.
    this.moves += 1
    this.updateHud()
    const a = this.first
    const b = tile
    this.first = undefined

    if (a.pairId === b.pairId) {
      a.matched = b.matched = true
      a.rect.setStrokeStyle(3, 0x33ac96)
      b.rect.setStrokeStyle(3, 0x33ac96)
      a.rect.setFillStyle(0x2e7d32, 0.95)
      b.rect.setFillStyle(0x2e7d32, 0.95)
      this.matched += 1
      this.updateHud()
      if (this.matched >= this.pairs) this.time.delayedCall(400, () => this.win())
    } else {
      this.busy = true
      this.time.delayedCall(750, () => {
        this.setFace(a, false)
        this.setFace(b, false)
        this.busy = false
      })
    }
  }

  private win() {
    this.busy = true
    const W = this.scale.width
    const H = this.scale.height
    const res = recordResult({ game: 'memory', score: this.pairs, bestStreak: 0, pairs: this.pairs, won: true })
    const banner = res.advanced ? `Level ${res.level!.id} complete! 🎉` : 'Board cleared! 🎉'
    this.add.text(W / 2, H * 0.4, banner, { fontSize: '30px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(20)
    this.info.setText(`${this.pairs} pairs in ${this.moves} moves`)

    const again = this.add.text(W / 2, H * 0.52, '↻  Play again', { fontSize: '22px', color: '#ffffff', backgroundColor: '#2e7d32', padding: { x: 18, y: 10 } })
      .setOrigin(0.5).setDepth(20).setInteractive({ useHandCursor: true })
    again.on('pointerdown', () => this.scene.restart())
    const menu = this.add.text(W / 2, H * 0.62, '≡  Menu', { fontSize: '20px', color: '#9fb0d8' })
      .setOrigin(0.5).setDepth(20).setInteractive({ useHandCursor: true })
    menu.on('pointerdown', () => this.scene.start('gamemenu'))
  }
}
