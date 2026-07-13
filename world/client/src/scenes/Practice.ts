import Phaser from 'phaser'
import { createCharacterAnims } from '../anims/CharacterAnims'

// A self-contained, single-player language mini-game (independent of the
// multiplayer worlds and Colyseus). A word from the player's decks appears; walk
// your character onto the correct meaning and press SPACE. Wrong answers cost a
// life. Difficulty/word source comes from the app API (the player's decks).
type QuizItem = { front: string; answer: string; choices: string[] }

export default class Practice extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private keySpace!: Phaser.Input.Keyboard.Key
  private items: QuizItem[] = []
  private idx = 0
  private score = 0
  private lives = 3
  private streak = 0
  private busy = true
  private lang = 'de-DE'
  private facing: 'up' | 'down' | 'left' | 'right' = 'down'
  private shots: { obj: Phaser.GameObjects.Arc; vx: number; vy: number }[] = []
  private walls: Phaser.GameObjects.Rectangle[] = []
  private zones: { rect: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; choice: string }[] = []
  private wordText!: Phaser.GameObjects.Text
  private hudText!: Phaser.GameObjects.Text
  private info!: Phaser.GameObjects.Text

  constructor() { super('practice') }

  init(data: { lang?: string }) { this.lang = data?.lang || 'de-DE' }

  async create() {
    createCharacterAnims(this.anims)
    const W = this.scale.width
    const H = this.scale.height
    this.cameras.main.setBackgroundColor('#1b2340')

    this.wordText = this.add.text(W / 2, 56, 'Loading…', { fontSize: '40px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(10)
    this.add.text(W / 2, 104, 'Arrow keys to move · SPACE to shoot the correct answer', { fontSize: '15px', color: '#9fb0d8' }).setOrigin(0.5).setDepth(10)
    this.hudText = this.add.text(16, 16, '', { fontSize: '18px', color: '#ffffff' }).setDepth(10)
    this.info = this.add.text(W / 2, H - 44, '', { fontSize: '20px', color: '#ffd479' }).setOrigin(0.5).setDepth(10)

    const exit = this.add.text(W - 16, 16, '✕ Exit', { fontSize: '18px', color: '#9fb0d8' })
      .setOrigin(1, 0).setDepth(10).setInteractive({ useHandCursor: true })
    exit.on('pointerdown', () => this.exit())
    this.input.keyboard.addKey('ESC').on('down', () => this.exit())

    this.player = this.physics.add.sprite(W / 2, H / 2, 'adam').setDepth(5)
    this.player.setCollideWorldBounds(true)
    this.physics.world.setBounds(0, 0, W, H)
    this.player.anims.play('adam_idle_down', true)

    // Obstacles: a loose central "maze" of isolated blocks. You navigate around
    // them, and they block your shots — so line up a clear lane before firing.
    // Kept small and spaced so the player can never be trapped, and clear of the
    // four answer positions (the corners).
    const wallSpecs: [number, number, number, number][] = [
      [W * 0.5, H * 0.32, W * 0.18, 18],
      [W * 0.5, H * 0.68, W * 0.18, 18],
      [W * 0.34, H * 0.5, 18, H * 0.16],
      [W * 0.66, H * 0.5, 18, H * 0.16],
    ]
    for (const [x, y, w, h] of wallSpecs) {
      const wall = this.add.rectangle(x, y, w, h, 0x3a4a72).setStrokeStyle(1, 0x556296).setDepth(2)
      this.physics.add.existing(wall, true)
      this.physics.add.collider(this.player, wall)
      this.walls.push(wall)
    }

    this.cursors = this.input.keyboard.createCursorKeys()
    this.keySpace = this.input.keyboard.addKey('SPACE')
    this.input.keyboard.addCapture('UP,DOWN,LEFT,RIGHT,SPACE')

    // Use the player's first learning language (falls back to the default).
    try {
      const me = await fetch('/api/auth/me', { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null))
      const learning = me?.user?.learning
      if (learning && learning.length) this.lang = learning[0]
    } catch { /* keep default */ }

    try {
      const res = await fetch(`/api/flashcards/quiz?lang=${encodeURIComponent(this.lang)}&n=10`, { credentials: 'same-origin' })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'could not load a quiz')
      }
      this.items = (await res.json()).items || []
    } catch (e: any) {
      this.wordText.setText(e.message || 'Could not load a quiz')
      this.info.setText('Add cards to a deck for this language, then try again. (Esc to exit)')
      return
    }
    if (!this.items.length) {
      this.wordText.setText('No cards to practise yet')
      this.info.setText('Make a flashcard deck first. (Esc to exit)')
      return
    }
    this.showQuestion()
  }

  private clearZones() {
    for (const z of this.zones) { z.rect.destroy(); z.label.destroy() }
    this.zones = []
    for (const s of this.shots) s.obj.destroy()
    this.shots = []
  }

  private showQuestion() {
    this.clearZones()
    if (this.idx >= this.items.length || this.lives <= 0) return this.finish()
    const item = this.items[this.idx]
    const W = this.scale.width
    const H = this.scale.height
    this.wordText.setText(item.front)
    const streakTxt = this.streak >= 2 ? `   🔥 ${this.streak}` : ''
    this.hudText.setText(`Score ${this.score}    ${'♥'.repeat(this.lives)}    ${this.idx + 1}/${this.items.length}${streakTxt}`)
    this.info.setText('')

    const bw = Math.min(280, W * 0.42)
    const spots = [[W * 0.26, H * 0.36], [W * 0.74, H * 0.36], [W * 0.26, H * 0.74], [W * 0.74, H * 0.74]]
    item.choices.forEach((choice, i) => {
      const [x, y] = spots[i] || [W / 2, H / 2]
      const rect = this.add.rectangle(x, y, bw, 92, 0x2c3f66, 0.92)
        .setStrokeStyle(2, 0x4a5f8f).setDepth(3)
        .setInteractive({ useHandCursor: true })
      const label = this.add.text(x, y, choice, { fontSize: '20px', color: '#ffffff', align: 'center', wordWrap: { width: bw - 24 } }).setOrigin(0.5).setDepth(4)
      const z = { rect, label, choice }
      // Tap/click the answer (works on touch + mouse); keyboard players can shoot it.
      rect.on('pointerdown', () => this.answer(z))
      this.zones.push(z)
    })
    this.busy = false
  }

  private answer(zone: { rect: Phaser.GameObjects.Rectangle; choice: string }) {
    if (this.busy) return
    this.busy = true
    const item = this.items[this.idx]
    if (zone.choice === item.answer) {
      this.streak += 1
      const bonus = Math.floor(this.streak / 3)
      this.score += 1 + bonus
      zone.rect.setFillStyle(0x2e7d32, 0.95)
      this.info.setText(this.streak >= 2 ? `✅  Correct!   🔥 ${this.streak} streak` : '✅  Correct!')
    } else {
      this.streak = 0
      this.lives -= 1
      zone.rect.setFillStyle(0x8e2f2f, 0.95)
      const right = this.zones.find((z) => z.choice === item.answer)
      if (right) right.rect.setFillStyle(0x2e7d32, 0.95)
      this.info.setText(`❌  It was:  ${item.answer}`)
    }
    this.idx += 1
    this.time.delayedCall(950, () => this.showQuestion())
  }

  private fire() {
    const dir = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[this.facing]
    const obj = this.add.circle(this.player.x, this.player.y - 6, 7, 0xffd479)
      .setStrokeStyle(2, 0xffffff).setDepth(6)
    this.shots.push({ obj, vx: dir[0] * 560, vy: dir[1] * 560 })
  }

  private finish() {
    this.clearZones()
    this.wordText.setText(this.lives <= 0 ? 'Out of lives!' : 'Level complete! 🎉')
    this.hudText.setText('')
    this.info.setText(`Score ${this.score}/${this.items.length}   ·   Esc to exit`)
    this.busy = true
  }

  private exit() {
    // Back to the world's room selection.
    window.location.reload()
  }

  update(_t: number, dt: number) {
    if (!this.player || !this.cursors) return
    const speed = 230
    let vx = 0
    let vy = 0
    if (this.cursors.left.isDown) vx = -speed
    else if (this.cursors.right.isDown) vx = speed
    if (this.cursors.up.isDown) vy = -speed
    else if (this.cursors.down.isDown) vy = speed
    this.player.setVelocity(vx, vy)

    if (vx < 0) { this.facing = 'left'; this.player.anims.play('adam_run_left', true) }
    else if (vx > 0) { this.facing = 'right'; this.player.anims.play('adam_run_right', true) }
    else if (vy < 0) { this.facing = 'up'; this.player.anims.play('adam_run_up', true) }
    else if (vy > 0) { this.facing = 'down'; this.player.anims.play('adam_run_down', true) }
    else this.player.anims.play('adam_idle_down', true)

    if (!this.busy && this.zones.length && Phaser.Input.Keyboard.JustDown(this.keySpace)) this.fire()

    // Move shots; a shot that reaches an answer selects it. Off-screen shots die.
    const W = this.scale.width
    const H = this.scale.height
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i]
      s.obj.x += s.vx * (dt / 1000)
      s.obj.y += s.vy * (dt / 1000)
      let hit = false
      // Walls stop shots.
      for (const wall of this.walls) {
        if (Phaser.Geom.Rectangle.Contains(wall.getBounds(), s.obj.x, s.obj.y)) { hit = true; break }
      }
      if (!hit && !this.busy) {
        for (const z of this.zones) {
          if (Phaser.Geom.Rectangle.Contains(z.rect.getBounds(), s.obj.x, s.obj.y)) { this.answer(z); hit = true; break }
        }
      }
      if (hit || s.obj.x < -20 || s.obj.x > W + 20 || s.obj.y < -20 || s.obj.y > H + 20) {
        s.obj.destroy()
        this.shots.splice(i, 1)
      }
    }
  }
}
