import Phaser from 'phaser'
import { LEVELS, currentLevel, completedLevel, allDone } from '../game/progress'

// The word-games hub: pick a game, and see your current level/task. Each game
// reports back here (scene.start('gamemenu')) so progress stays visible.
export default class GameMenu extends Phaser.Scene {
  constructor() { super('gamemenu') }

  create() {
    const W = this.scale.width
    const H = this.scale.height
    this.cameras.main.setBackgroundColor('#12172b')

    this.add.text(W / 2, H * 0.12, '🎮  Word Games', { fontSize: '44px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)

    const done = completedLevel()
    const cur = currentLevel()
    const progTxt = allDone() ? `All ${LEVELS.length} levels complete! 🏆` : `Level ${done + 1} of ${LEVELS.length}`
    this.add.text(W / 2, H * 0.22, progTxt, { fontSize: '20px', color: '#9fb0d8' }).setOrigin(0.5)
    if (cur) this.add.text(W / 2, H * 0.26, `🎯 Task: ${cur.goal}`, { fontSize: '18px', color: '#ffd479' }).setOrigin(0.5)

    // Level ladder: a dot per level — cleared (teal), current (gold), locked (grey).
    const total = LEVELS.length
    const dotGap = Math.min(34, (W * 0.72) / Math.max(1, total - 1))
    const rowStart = W / 2 - ((total - 1) * dotGap) / 2
    LEVELS.forEach((lv, i) => {
      const x = rowStart + i * dotGap
      const isDone = lv.id <= done
      const isCurrent = lv.id === done + 1
      const dot = this.add.circle(x, H * 0.31, isCurrent ? 9 : 7, isDone ? 0x33ac96 : isCurrent ? 0xffd479 : 0x39456e)
      if (isCurrent) dot.setStrokeStyle(2, 0xffffff)
    })

    const games: { scene: string; emoji: string; name: string; desc: string }[] = [
      { scene: 'practice', emoji: '🎯', name: 'Shooter', desc: 'Shoot the correct word' },
      { scene: 'memory', emoji: '🧠', name: 'Memory Match', desc: 'Match words to their meanings' },
      { scene: 'wordfall', emoji: '🌧️', name: 'Word Fall', desc: 'Catch the correct meaning as it falls' },
      { scene: 'labyrinth', emoji: '🧩', name: 'Labyrinth', desc: 'Navigate a maze to the right word' },
    ]
    const cardW = Math.min(460, W * 0.86)
    games.forEach((g, i) => {
      const y = H * 0.36 + i * 78
      const card = this.add.rectangle(W / 2, y, cardW, 68, 0x232a49, 0.96)
        .setStrokeStyle(2, 0x3a4470).setInteractive({ useHandCursor: true })
      const left = W / 2 - cardW / 2
      this.add.text(left + 26, y, g.emoji, { fontSize: '32px' }).setOrigin(0, 0.5)
      this.add.text(left + 74, y - 11, g.name, { fontSize: '21px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0, 0.5)
      this.add.text(left + 74, y + 14, g.desc, { fontSize: '13px', color: '#9fb0d8' }).setOrigin(0, 0.5)
      card.on('pointerover', () => card.setStrokeStyle(2, 0x33ac96))
      card.on('pointerout', () => card.setStrokeStyle(2, 0x3a4470))
      card.on('pointerdown', () => this.scene.start(g.scene))
    })

    const exit = this.add.text(W - 16, 16, '✕ Exit', { fontSize: '18px', color: '#9fb0d8' })
      .setOrigin(1, 0).setInteractive({ useHandCursor: true })
    exit.on('pointerdown', () => window.location.reload())
    this.input.keyboard?.addKey('ESC').on('down', () => window.location.reload())
  }
}
