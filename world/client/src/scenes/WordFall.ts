import Phaser from 'phaser'
import { createCharacterAnims } from '../anims/CharacterAnims'
import { recordResult } from '../game/progress'
import { celebrate } from '../game/celebrate'
import { loadQuiz } from '../game/quiz'

// Word Fall: a word appears up top and its possible meanings drift down the
// screen. Move along the bottom and catch the correct one. Catch a wrong one
// (or let the right one fall past) and you lose a life. Reuses the quiz data.
type Faller = {
  rect: Phaser.GameObjects.Rectangle
  label: Phaser.GameObjects.Text
  choice: string
  vy: number
}

export default class WordFall extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private items: { front: string; answer: string; choices: string[] }[] = []
  private idx = 0
  private score = 0
  private lives = 3
  private busy = true
  private lang = 'de-DE'
  private fallers: Faller[] = []
  private answered = false // current word already resolved (caught/missed)
  private pointerX: number | null = null
  private wordText!: Phaser.GameObjects.Text
  private hudText!: Phaser.GameObjects.Text
  private info!: Phaser.GameObjects.Text

  constructor() { super('wordfall') }

  init() {
    this.items = []
    this.idx = 0
    this.score = 0
    this.lives = 3
    this.busy = true
    this.fallers = []
    this.answered = false
    this.pointerX = null
  }

  async create() {
    createCharacterAnims(this.anims)
    const W = this.scale.width
    const H = this.scale.height
    this.cameras.main.setBackgroundColor('#171b2e')

    this.wordText = this.add.text(W / 2, 40, 'Loading…', { fontSize: '38px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(10)
    this.add.text(W / 2, 84, 'Move with ← → (or drag) · catch the correct meaning', { fontSize: '14px', color: '#9fb0d8' }).setOrigin(0.5).setDepth(10)
    this.hudText = this.add.text(16, 16, '', { fontSize: '17px', color: '#ffffff' }).setDepth(10)
    this.info = this.add.text(W / 2, H - 26, '', { fontSize: '18px', color: '#ffd479' }).setOrigin(0.5).setDepth(10)

    const exit = this.add.text(W - 16, 16, '✕ Menu', { fontSize: '18px', color: '#9fb0d8' })
      .setOrigin(1, 0).setDepth(10).setInteractive({ useHandCursor: true })
    exit.on('pointerdown', () => this.scene.start('gamemenu'))
    this.input.keyboard?.addKey('ESC').on('down', () => this.scene.start('gamemenu'))

    this.player = this.physics.add.sprite(W / 2, H - 70, 'adam').setDepth(5)
    this.player.anims.play('adam_idle_down', true)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.input.keyboard!.addCapture('LEFT,RIGHT')
    // Touch/drag: steer toward the pointer.
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (p.isDown) this.pointerX = p.x })
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { this.pointerX = p.x })
    this.input.on('pointerup', () => { this.pointerX = null })

    try {
      const me = await fetch('/api/auth/me', { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null))
      const learning = me?.user?.learning
      if (learning && learning.length) this.lang = learning[0]
    } catch { /* keep default */ }

    const { items } = await loadQuiz(this.lang, 12)
    this.items = items
    if (this.items.length < 1) {
      this.wordText.setText('No words to play yet')
      this.info.setText('Add cards to a deck for this language. (Esc for menu)')
      return
    }
    this.nextWord()
  }

  private clearFallers() {
    for (const f of this.fallers) { f.rect.destroy(); f.label.destroy() }
    this.fallers = []
  }

  private nextWord() {
    this.clearFallers()
    if (this.idx >= this.items.length || this.lives <= 0) return this.finish()
    const item = this.items[this.idx]
    const W = this.scale.width
    this.wordText.setText(item.front)
    this.hudText.setText(`Score ${this.score}    ${'♥'.repeat(this.lives)}    ${this.idx + 1}/${this.items.length}`)
    this.info.setText('')
    this.answered = false

    // Spawn each choice as a faller at a random x and staggered start height.
    const bw = Math.min(190, W * 0.4)
    const order = [...item.choices]
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[order[i], order[j]] = [order[j], order[i]] }
    order.forEach((choice, i) => {
      const x = Phaser.Math.Between(Math.floor(bw / 2 + 10), Math.floor(W - bw / 2 - 10))
      const y = 110 - i * 90 // stagger above the screen so they arrive one by one
      const rect = this.add.rectangle(x, y, bw, 46, 0x2c3f66, 0.96).setStrokeStyle(2, 0x4a5f8f).setDepth(3)
      const label = this.add.text(x, y, choice, { fontSize: '17px', color: '#ffffff', align: 'center', wordWrap: { width: bw - 16 } }).setOrigin(0.5).setDepth(4)
      this.fallers.push({ rect, label, choice, vy: Phaser.Math.Between(90, 130) })
    })
    this.busy = false
  }

  private resolve(correct: boolean, caughtAnswer?: string) {
    if (this.answered) return
    this.answered = true
    this.busy = true
    const item = this.items[this.idx]
    if (correct) {
      this.score += 1
      this.info.setText('✅  Caught it!')
    } else {
      this.lives -= 1
      this.cameras.main.shake(140, 0.006)
      this.info.setText(caughtAnswer ? `❌  “${caughtAnswer}” was wrong · it was ${item.answer}` : `❌  Missed · it was ${item.answer}`)
    }
    this.idx += 1
    this.time.delayedCall(850, () => this.nextWord())
  }

  private finish() {
    this.clearFallers()
    this.busy = true
    const W = this.scale.width
    const H = this.scale.height
    const prog = recordResult({ game: 'wordfall', score: this.score, bestStreak: 0, won: this.lives > 0 })
    if (prog.advanced) celebrate(this)
    this.wordText.setText(prog.advanced ? `Level ${prog.level!.id} complete! 🎉` : (this.lives <= 0 ? 'Out of lives!' : 'Round complete! 🎉'))
    this.hudText.setText('')
    this.info.setText(`Caught ${this.score} of ${this.items.length}`)

    const again = this.add.text(W / 2, H * 0.5, '↻  Play again', { fontSize: '22px', color: '#ffffff', backgroundColor: '#2e7d32', padding: { x: 18, y: 10 } })
      .setOrigin(0.5).setDepth(20).setInteractive({ useHandCursor: true })
    again.on('pointerdown', () => this.scene.restart())
    const menu = this.add.text(W / 2, H * 0.6, '≡  Menu', { fontSize: '20px', color: '#9fb0d8' })
      .setOrigin(0.5).setDepth(20).setInteractive({ useHandCursor: true })
    menu.on('pointerdown', () => this.scene.start('gamemenu'))
  }

  update(_t: number, dt: number) {
    if (!this.player || !this.cursors) return
    const W = this.scale.width
    const H = this.scale.height
    const speed = 320

    // Movement: arrows, or steer toward a held pointer.
    let vx = 0
    if (this.cursors.left.isDown) vx = -speed
    else if (this.cursors.right.isDown) vx = speed
    else if (this.pointerX != null) {
      const d = this.pointerX - this.player.x
      if (Math.abs(d) > 6) vx = Math.sign(d) * speed
    }
    this.player.x = Phaser.Math.Clamp(this.player.x + vx * (dt / 1000), 20, W - 20)
    if (vx < 0) this.player.anims.play('adam_run_left', true)
    else if (vx > 0) this.player.anims.play('adam_run_right', true)
    else this.player.anims.play('adam_idle_down', true)

    if (this.busy) return

    // Advance fallers; catch on overlap with the player; a wrong-catch or the
    // correct one falling past ends the word.
    const item = this.items[this.idx]
    const catchY = this.player.y
    for (let i = this.fallers.length - 1; i >= 0; i--) {
      const f = this.fallers[i]
      f.rect.y += f.vy * (dt / 1000)
      f.label.y = f.rect.y
      const caught = f.rect.y >= catchY - 26 && Math.abs(f.rect.x - this.player.x) < (f.rect.width / 2 + 16)
      if (caught) {
        this.resolve(f.choice === item.answer, f.choice)
        return
      }
      if (f.rect.y > H + 30) {
        const wasCorrect = f.choice === item.answer
        f.rect.destroy(); f.label.destroy()
        this.fallers.splice(i, 1)
        if (wasCorrect) { this.resolve(false); return } // let the right one slip → miss
      }
    }
  }
}
