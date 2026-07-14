import Phaser from 'phaser'
import { createCharacterAnims } from '../anims/CharacterAnims'
import { recordResult } from '../game/progress'

// Labyrinth: a word appears; walk through a maze to the tile with its correct
// meaning. Reach a wrong tile and you lose a life. The maze is a fully-connected
// recursive-backtracker grid (every tile is reachable), regenerated each round.
type Answer = { rect: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; choice: string; cx: number; cy: number }

export default class Labyrinth extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wallGroup!: Phaser.Physics.Arcade.StaticGroup
  private items: { front: string; answer: string; choices: string[] }[] = []
  private idx = 0
  private score = 0
  private lives = 3
  private busy = true
  private lang = 'de-DE'
  private answers: Answer[] = []
  private pointer: { x: number; y: number } | null = null
  private facing: 'up' | 'down' | 'left' | 'right' = 'down'
  // maze geometry
  private cell = 76
  private cols = 6
  private rows = 5
  private ox = 0
  private oy = 110
  private openCells: [number, number][] = []
  private wordText!: Phaser.GameObjects.Text
  private hudText!: Phaser.GameObjects.Text
  private info!: Phaser.GameObjects.Text

  constructor() { super('labyrinth') }

  init() {
    this.items = []
    this.idx = 0
    this.score = 0
    this.lives = 3
    this.busy = true
    this.answers = []
    this.pointer = null
    this.facing = 'down'
    this.openCells = []
  }

  async create() {
    createCharacterAnims(this.anims)
    const W = this.scale.width
    const H = this.scale.height
    this.cameras.main.setBackgroundColor('#141a2c')

    this.wordText = this.add.text(W / 2, 34, 'Loading…', { fontSize: '32px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(20)
    this.add.text(W / 2, 72, 'Walk to the correct meaning', { fontSize: '13px', color: '#9fb0d8' }).setOrigin(0.5).setDepth(20)
    this.hudText = this.add.text(16, 14, '', { fontSize: '16px', color: '#ffffff' }).setDepth(20)
    this.info = this.add.text(W / 2, H - 22, '', { fontSize: '17px', color: '#ffd479' }).setOrigin(0.5).setDepth(20)

    const exit = this.add.text(W - 16, 14, '✕ Menu', { fontSize: '18px', color: '#9fb0d8' })
      .setOrigin(1, 0).setDepth(20).setInteractive({ useHandCursor: true })
    exit.on('pointerdown', () => this.scene.start('gamemenu'))
    this.input.keyboard?.addKey('ESC').on('down', () => this.scene.start('gamemenu'))

    // Maze grid sized to the screen.
    this.cell = Math.max(58, Math.min(84, Math.floor((H - 150) / 6)))
    this.cols = Math.max(5, Math.floor((W - 24) / this.cell))
    this.rows = Math.max(4, Math.floor((H - 150) / this.cell))
    this.ox = Math.floor((W - this.cols * this.cell) / 2)
    this.oy = 96

    this.wallGroup = this.physics.add.staticGroup()
    this.buildMaze()

    const start = this.cellCenter(0, 0)
    this.player = this.physics.add.sprite(start.x, start.y, 'adam').setDepth(10)
    this.player.setCollideWorldBounds(true)
    ;(this.player.body as Phaser.Physics.Arcade.Body).setSize(18, 20).setOffset(7, 24)
    this.physics.world.setBounds(this.ox, this.oy, this.cols * this.cell, this.rows * this.cell)
    this.physics.add.collider(this.player, this.wallGroup)
    this.player.anims.play('adam_idle_down', true)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.input.keyboard!.addCapture('UP,DOWN,LEFT,RIGHT')
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { this.pointer = { x: p.x, y: p.y } })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (p.isDown) this.pointer = { x: p.x, y: p.y } })
    this.input.on('pointerup', () => { this.pointer = null })

    try {
      const me = await fetch('/api/auth/me', { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null))
      const learning = me?.user?.learning
      if (learning && learning.length) this.lang = learning[0]
    } catch { /* keep default */ }

    try {
      const res = await fetch(`/api/flashcards/quiz?lang=${encodeURIComponent(this.lang)}&n=10`, { credentials: 'same-origin' })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'could not load a game')
      }
      this.items = (await res.json()).items || []
    } catch (e: any) {
      this.wordText.setText(e.message || 'Could not load a game')
      this.info.setText('Add cards to a deck, then try again. (Esc for menu)')
      return
    }
    if (this.items.length < 1) {
      this.wordText.setText('No cards to play yet')
      this.info.setText('Make a flashcard deck first. (Esc for menu)')
      return
    }
    this.showWord()
  }

  private cellCenter(c: number, r: number) {
    return { x: this.ox + c * this.cell + this.cell / 2, y: this.oy + r * this.cell + this.cell / 2 }
  }

  // Recursive-backtracker maze; renders closed walls as static bodies.
  private buildMaze() {
    const { cols, rows, cell, ox, oy } = this
    type Cell = { N: boolean; E: boolean; S: boolean; W: boolean }
    const grid: Cell[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ N: true, E: true, S: true, W: true }))
    )
    const visited = Array.from({ length: rows }, () => Array.from({ length: cols }, () => false))
    const dirs: [number, number, keyof Cell, keyof Cell][] = [
      [0, -1, 'N', 'S'], [1, 0, 'E', 'W'], [0, 1, 'S', 'N'], [-1, 0, 'W', 'E'],
    ]
    const stack: [number, number][] = [[0, 0]]
    visited[0][0] = true
    while (stack.length) {
      const [c, r] = stack[stack.length - 1]
      const nb = dirs.filter(([dc, dr]) => {
        const nc = c + dc, nr = r + dr
        return nc >= 0 && nr >= 0 && nc < cols && nr < rows && !visited[nr][nc]
      })
      if (nb.length) {
        const [dc, dr, wall, opp] = nb[Math.floor(Math.random() * nb.length)]
        const nc = c + dc, nr = r + dr
        grid[r][c][wall] = false
        grid[nr][nc][opp] = false
        visited[nr][nc] = true
        stack.push([nc, nr])
      } else {
        stack.pop()
      }
    }

    const t = 8 // wall thickness
    const addWall = (x: number, y: number, w: number, h: number) => {
      const rect = this.add.rectangle(x, y, w, h, 0x39456e).setDepth(4)
      this.wallGroup.add(rect)
      const body = rect.body as Phaser.Physics.Arcade.StaticBody
      body.updateFromGameObject()
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x0 = ox + c * cell
        const y0 = oy + r * cell
        if (grid[r][c].N) addWall(x0 + cell / 2, y0, cell + t, t)
        if (grid[r][c].W) addWall(x0, y0 + cell / 2, t, cell + t)
        if (c === cols - 1 && grid[r][c].E) addWall(x0 + cell, y0 + cell / 2, t, cell + t)
        if (r === rows - 1 && grid[r][c].S) addWall(x0 + cell / 2, y0 + cell, cell + t, t)
      }
    }
    // Every cell is open floor and reachable.
    this.openCells = []
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) this.openCells.push([c, r])
  }

  private clearAnswers() {
    for (const a of this.answers) { a.rect.destroy(); a.label.destroy() }
    this.answers = []
  }

  private showWord() {
    this.clearAnswers()
    if (this.idx >= this.items.length || this.lives <= 0) return this.finish()
    const item = this.items[this.idx]
    this.wordText.setText(item.front)
    this.hudText.setText(`Score ${this.score}    ${'♥'.repeat(this.lives)}    ${this.idx + 1}/${this.items.length}`)
    this.info.setText('')

    // Place each choice on a distinct cell, away from the player's current cell.
    const pc = this.worldToCell(this.player.x, this.player.y)
    const pool = this.openCells.filter(([c, r]) => Math.abs(c - pc[0]) + Math.abs(r - pc[1]) >= 2)
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[pool[i], pool[j]] = [pool[j], pool[i]] }
    const spots = pool.slice(0, item.choices.length)
    item.choices.forEach((choice, i) => {
      const [c, r] = spots[i] || this.openCells[i % this.openCells.length]
      const { x, y } = this.cellCenter(c, r)
      const bw = this.cell - 12
      const rect = this.add.rectangle(x, y, bw, 34, 0x2c3f66, 0.95).setStrokeStyle(2, 0x4a5f8f).setDepth(6)
      const label = this.add.text(x, y, choice, { fontSize: '13px', color: '#ffffff', align: 'center', wordWrap: { width: bw - 8 } }).setOrigin(0.5).setDepth(7)
      this.answers.push({ rect, label, choice, cx: x, cy: y })
    })
    this.busy = false
  }

  private worldToCell(x: number, y: number): [number, number] {
    return [
      Phaser.Math.Clamp(Math.floor((x - this.ox) / this.cell), 0, this.cols - 1),
      Phaser.Math.Clamp(Math.floor((y - this.oy) / this.cell), 0, this.rows - 1),
    ]
  }

  private resolve(correct: boolean, chosen: string) {
    if (this.busy) return
    this.busy = true
    const item = this.items[this.idx]
    if (correct) {
      this.score += 1
      this.info.setText('✅  Correct!')
    } else {
      this.lives -= 1
      this.cameras.main.shake(140, 0.006)
      this.info.setText(`❌  “${chosen}” — it was ${item.answer}`)
    }
    this.idx += 1
    this.time.delayedCall(850, () => this.showWord())
  }

  private finish() {
    this.clearAnswers()
    this.busy = true
    const W = this.scale.width
    const H = this.scale.height
    const prog = recordResult({ game: 'labyrinth', score: this.score, bestStreak: 0, won: this.lives > 0 })
    this.wordText.setText(prog.advanced ? `Level ${prog.level!.id} complete! 🎉` : (this.lives <= 0 ? 'Out of lives!' : 'Round complete! 🎉'))
    this.hudText.setText('')
    this.info.setText(`Reached ${this.score} of ${this.items.length}`)

    const again = this.add.text(W / 2, H * 0.5, '↻  Play again', { fontSize: '22px', color: '#ffffff', backgroundColor: '#2e7d32', padding: { x: 18, y: 10 } })
      .setOrigin(0.5).setDepth(30).setInteractive({ useHandCursor: true })
    again.on('pointerdown', () => this.scene.restart())
    const menu = this.add.text(W / 2, H * 0.6, '≡  Menu', { fontSize: '20px', color: '#9fb0d8' })
      .setOrigin(0.5).setDepth(30).setInteractive({ useHandCursor: true })
    menu.on('pointerdown', () => this.scene.start('gamemenu'))
  }

  update() {
    if (!this.player || !this.cursors) return
    const speed = 190
    let vx = 0
    let vy = 0
    if (this.cursors.left.isDown) vx = -speed
    else if (this.cursors.right.isDown) vx = speed
    if (this.cursors.up.isDown) vy = -speed
    else if (this.cursors.down.isDown) vy = speed
    // Touch: steer toward the held pointer.
    if (vx === 0 && vy === 0 && this.pointer) {
      const dx = this.pointer.x - this.player.x
      const dy = this.pointer.y - this.player.y
      if (Math.abs(dx) > 8) vx = Math.sign(dx) * speed
      if (Math.abs(dy) > 8) vy = Math.sign(dy) * speed
    }
    this.player.setVelocity(vx, vy)

    if (vx < 0) { this.facing = 'left'; this.player.anims.play('adam_run_left', true) }
    else if (vx > 0) { this.facing = 'right'; this.player.anims.play('adam_run_right', true) }
    else if (vy < 0) { this.facing = 'up'; this.player.anims.play('adam_run_up', true) }
    else if (vy > 0) { this.facing = 'down'; this.player.anims.play('adam_run_down', true) }
    else this.player.anims.play(`adam_idle_${this.facing}`, true)

    if (this.busy) return
    const item = this.items[this.idx]
    for (const a of this.answers) {
      if (Math.abs(a.cx - this.player.x) < 26 && Math.abs(a.cy - this.player.y) < 24) {
        this.resolve(a.choice === item.answer, a.choice)
        return
      }
    }
  }
}
