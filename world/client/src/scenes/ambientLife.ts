import Phaser from 'phaser'

// Ambient life for the worlds: fluttering butterflies (nature worlds) and cars
// driving along fixed street lanes (Osaka). Purely decorative — no physics, no
// collision with players — so it stays cheap and never traps anyone. Movement is
// integrated from Game.update(dt).

interface Car {
  s: Phaser.GameObjects.Image
  vx: number
  vy: number
  min: number // wrap bounds along the axis of travel
  max: number
  axis: 'x' | 'y'
  cross: number // fixed lane coord on the perpendicular axis
  phase: number // per-car bob offset
  stop: number // coord to hold at when the light is red (before the junction)
}

interface Flit {
  s: Phaser.GameObjects.Sprite
  cx: number
  cy: number
  r: number
  ang: number
  spd: number
  t: number
  ground?: boolean // crows sort by y-depth; butterflies fly above everything
}

export class AmbientLife {
  private cars: Car[] = []
  private flits: Flit[] = []
  private t = 0

  constructor(private scene: Phaser.Scene) {}

  /** A few butterflies drifting in lazy loops around (cx, cy). */
  addButterflies(cx: number, cy: number, count: number) {
    if (!this.scene.anims.exists('butterfly_idle')) return
    for (let i = 0; i < count; i++) {
      const r = 40 + Math.random() * 140
      const ang = Math.random() * Math.PI * 2
      const s = this.scene.add
        .sprite(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, 'butterfly')
        .setDepth(900000) // butterflies fly above everything in the scene
      s.play('butterfly_idle')
      this.flits.push({ s, cx, cy, r, ang, spd: 0.5 + Math.random() * 0.9, t: Math.random() * 100 })
    }
  }

  /** A few crows pecking/hopping around fixed ground spots (city worlds). */
  addCrows(spots: Array<[number, number]>) {
    if (!this.scene.textures.exists('crow')) return
    if (!this.scene.anims.exists('crow_idle')) {
      this.scene.anims.create({
        key: 'crow_idle',
        frames: this.scene.anims.generateFrameNumbers('crow', { start: 0, end: 29 }),
        frameRate: 12,
        repeat: -1,
      })
    }
    for (const [x, y] of spots) {
      const s = this.scene.add.sprite(x, y, 'crow').setDepth(y).setScale(1.1)
      s.play('crow_idle')
      // reuse the Flit wander with a small radius so they hop around locally
      this.flits.push({ s, cx: x, cy: y, r: 10 + Math.random() * 22, ang: Math.random() * 6.28, spd: 0.25 + Math.random() * 0.3, t: Math.random() * 100, ground: true })
    }
  }

  /** Cars looping along the two Osaka roads (they stay on the streets by design). */
  addOsakaTraffic() {
    const SP = 60 // px/s
    const SCALE = 0.45
    // Vertical road lanes (road spans ~x 600–780): up-lane and down-lane.
    // Horizontal road lanes (road spans ~y 505–665): right-lane and left-lane.
    const specs: Array<{
      tex: string
      x: number
      y: number
      vx: number
      vy: number
      axis: 'x' | 'y'
      min: number
      max: number
      stop: number
    }> = [
      // down lane (x=712) — stop just above the junction (y≈495)
      { tex: 'car_down', x: 712, y: 60, vx: 0, vy: SP, axis: 'y', min: -190, max: 1010, stop: 495 },
      { tex: 'car_down', x: 712, y: 520, vx: 0, vy: SP, axis: 'y', min: -190, max: 1010, stop: 495 },
      // up lane (x=656) — stop just below the junction (y≈675)
      { tex: 'car_up', x: 656, y: 320, vx: 0, vy: -SP, axis: 'y', min: -190, max: 1010, stop: 675 },
      { tex: 'car_up', x: 656, y: 780, vx: 0, vy: -SP, axis: 'y', min: -190, max: 1010, stop: 675 },
      // right lane (y=556) — stop just left of the junction (x≈588)
      { tex: 'car_right', x: 120, y: 556, vx: SP, vy: 0, axis: 'x', min: -210, max: 1300, stop: 588 },
      { tex: 'car_right', x: 640, y: 556, vx: SP, vy: 0, axis: 'x', min: -210, max: 1300, stop: 588 },
      // left lane (y=620) — stop just right of the junction (x≈792)
      { tex: 'car_left', x: 420, y: 620, vx: -SP, vy: 0, axis: 'x', min: -210, max: 1300, stop: 792 },
      { tex: 'car_left', x: 920, y: 620, vx: -SP, vy: 0, axis: 'x', min: -210, max: 1300, stop: 792 },
    ]
    for (const sp of specs) {
      if (!this.scene.textures.exists(sp.tex)) continue
      const s = this.scene.add.image(sp.x, sp.y, sp.tex).setScale(SCALE).setDepth(sp.y)
      this.cars.push({
        s,
        vx: sp.vx,
        vy: sp.vy,
        axis: sp.axis,
        min: sp.min,
        max: sp.max,
        cross: sp.axis === 'y' ? sp.x : sp.y,
        phase: Math.random() * Math.PI * 2,
        stop: sp.stop,
      })
    }
  }

  update(dt: number) {
    const d = dt / 1000
    this.t += d

    // Traffic light: vertical road green, brief all-red, horizontal green, repeat.
    const phase = this.t % 13
    const vGreen = phase < 5.5
    const hGreen = phase >= 6.5 && phase < 12

    for (const c of this.cars) {
      const green = c.axis === 'y' ? vGreen : hGreen
      if (c.axis === 'y') {
        const ny = c.s.y + c.vy * d
        // stop at the line only while still approaching the junction
        if (green) c.s.y = ny
        else if (c.vy > 0) c.s.y = c.s.y <= c.stop ? Math.min(ny, c.stop) : ny
        else c.s.y = c.s.y >= c.stop ? Math.max(ny, c.stop) : ny
        if (c.s.y < c.min) c.s.y = c.max
        else if (c.s.y > c.max) c.s.y = c.min
      } else {
        const nx = c.s.x + c.vx * d
        if (green) c.s.x = nx
        else if (c.vx > 0) c.s.x = c.s.x <= c.stop ? Math.min(nx, c.stop) : nx
        else c.s.x = c.s.x >= c.stop ? Math.max(nx, c.stop) : nx
        if (c.s.x < c.min) c.s.x = c.max
        else if (c.s.x > c.max) c.s.x = c.min
      }
      // subtle suspension bob on the perpendicular axis (the cars are
      // single-frame sprites, so this stands in for a driving animation).
      const bob = Math.sin(this.t * 9 + c.phase) * 0.8
      if (c.axis === 'y') c.s.x = c.cross + bob
      else c.s.y = c.cross + bob
      c.s.setDepth(c.s.y)
    }

    for (const f of this.flits) {
      f.t += d
      f.ang += (0.5 + f.spd) * d
      // lazy looping path with a little wobble
      const wob = f.ground ? 6 : 24
      const tx = f.cx + Math.cos(f.ang) * f.r + Math.sin(f.t * 0.7) * wob
      const ty = f.cy + Math.sin(f.ang) * f.r * 0.6 + Math.cos(f.t * 0.9) * (f.ground ? 4 : 18)
      const ease = f.ground ? 0.03 : 0.05
      f.s.x += (tx - f.s.x) * ease
      f.s.y += (ty - f.s.y) * ease
      // face travel direction for crows (flip the sprite horizontally)
      if (f.ground) {
        if (tx - f.s.x > 0.3) f.s.setFlipX(false)
        else if (tx - f.s.x < -0.3) f.s.setFlipX(true)
        f.s.setDepth(f.s.y)
      }
    }
  }
}
