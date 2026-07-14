import Phaser from 'phaser'

// A quick, self-cleaning confetti + flash burst — played when a game round
// advances the player's level. Purely cosmetic; safe to call from any scene.
export function celebrate(scene: Phaser.Scene) {
  scene.cameras.main.flash(350, 40, 120, 60)
  const W = scene.scale.width
  const H = scene.scale.height
  const colors = [0xffd479, 0x33ac96, 0xff7eb6, 0x7ec8ff, 0xffffff]
  for (let i = 0; i < 26; i++) {
    const x = Phaser.Math.Between(0, W)
    const piece = scene.add.rectangle(x, -12, 6, 11, colors[i % colors.length]).setDepth(50)
    scene.tweens.add({
      targets: piece,
      y: H + 24,
      angle: Phaser.Math.Between(-220, 220),
      duration: Phaser.Math.Between(900, 1700),
      ease: 'Quad.in',
      onComplete: () => piece.destroy(),
    })
  }
}
