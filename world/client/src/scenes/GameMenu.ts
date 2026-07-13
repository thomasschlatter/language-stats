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
    if (cur) this.add.text(W / 2, H * 0.27, `🎯 Task: ${cur.goal}`, { fontSize: '18px', color: '#ffd479' }).setOrigin(0.5)

    const games: { scene: string; emoji: string; name: string; desc: string }[] = [
      { scene: 'practice', emoji: '🎯', name: 'Shooter', desc: 'Shoot the correct word' },
      { scene: 'memory', emoji: '🧠', name: 'Memory Match', desc: 'Match words to their meanings' },
    ]
    const cardW = Math.min(460, W * 0.86)
    games.forEach((g, i) => {
      const y = H * 0.44 + i * 100
      const card = this.add.rectangle(W / 2, y, cardW, 82, 0x232a49, 0.96)
        .setStrokeStyle(2, 0x3a4470).setInteractive({ useHandCursor: true })
      const left = W / 2 - cardW / 2
      this.add.text(left + 28, y, g.emoji, { fontSize: '36px' }).setOrigin(0, 0.5)
      this.add.text(left + 80, y - 13, g.name, { fontSize: '22px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0, 0.5)
      this.add.text(left + 80, y + 15, g.desc, { fontSize: '14px', color: '#9fb0d8' }).setOrigin(0, 0.5)
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
