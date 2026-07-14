import Phaser from 'phaser'

// Ambient life for the worlds: fluttering butterflies (nature worlds) and cars
// driving along fixed street lanes (Osaka). Purely decorative — no physics, no
// collision with players — so it stays cheap and never traps anyone. Movement is
// integrated from Game.update(dt).

interface Car {
  s: Phaser.GameObjects.Sprite
  vx: number
  vy: number
  min: number // wrap bounds along the axis of travel
  max: number
  axis: 'x' | 'y'
  cross: number // fixed lane coord on the perpendicular axis
  phase: number // per-car bob offset
  stop: number // coord to hold at when the light is red (before the junction)
  light: boolean // obeys the intersection traffic light (Osaka) vs just drives
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
  private carBodies?: Phaser.Physics.Arcade.StaticGroup
  private player?: { x: number; y: number }

  constructor(private scene: Phaser.Scene) {}

  /** The car collision group, so the scene can collide the player with traffic. */
  getCarGroup() {
    return this.carBodies
  }

  /** Tell the traffic where the player is, so cars stop for a pedestrian. */
  setPlayer(p: { x: number; y: number }) {
    this.player = p
  }

  // Is the player standing in this car's lane, just ahead of it?
  private pedestrianAhead(c: Car): boolean {
    if (!this.player) return false
    const LANE = 26 // how tightly aligned to the lane
    const GAP = 78 // stop this far before the pedestrian
    if (c.axis === 'y') {
      if (Math.abs(this.player.x - c.s.x) > LANE) return false
      const ahead = (this.player.y - c.s.y) * Math.sign(c.vy)
      return ahead > 0 && ahead < GAP
    }
    if (Math.abs(this.player.y - c.s.y) > LANE) return false
    const ahead = (this.player.x - c.s.x) * Math.sign(c.vx)
    return ahead > 0 && ahead < GAP
  }

  // Is another car occupying the space just ahead? Checks ALL cars (any
  // direction), so a car queues behind one in its lane AND yields to cross
  // traffic passing in front of it at the intersection.
  private carAhead(c: Car): boolean {
    const GAP = 90 // how far ahead we look along travel
    const LAT = 30 // lateral tolerance (narrower than the lane spacing)
    for (const o of this.cars) {
      if (o === c) continue
      let along: number
      let lateral: number
      if (c.axis === 'y') {
        along = (o.s.y - c.s.y) * Math.sign(c.vy)
        lateral = Math.abs(o.s.x - c.s.x)
      } else {
        along = (o.s.x - c.s.x) * Math.sign(c.vx)
        lateral = Math.abs(o.s.y - c.s.y)
      }
      if (along > 0 && along < GAP && lateral < LAT) return true
    }
    return false
  }

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
      // Static — sits in one spot and plays its pecking/idle animation (no wander).
      this.scene.add.sprite(x, y, 'crow').setDepth(y).setScale(1.1).play('crow_idle')
    }
  }

  /** A raven flying across the sky, looping (city worlds). */
  addFlyingRaven(y: number, mapWidth: number) {
    if (!this.scene.textures.exists('crow_flying')) return
    if (!this.scene.anims.exists('crow_flying_left')) {
      this.scene.anims.create({
        key: 'crow_flying_left',
        frames: this.scene.anims.generateFrameNumbers('crow_flying', { start: 0, end: 5 }),
        frameRate: 10,
        repeat: -1,
      })
    }
    const raven = this.scene.add
      .sprite(mapWidth + 60, y, 'crow_flying')
      .setScale(0.9)
      .setDepth(900000)
    raven.play('crow_flying_left')
    this.scene.tweens.add({
      targets: raven,
      x: -80,
      duration: 13000,
      ease: 'Linear',
      repeat: -1,
      onRepeat: () => {
        raven.x = mapWidth + 60
      },
    })
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
    // Nudge the whole traffic setup onto the asphalt (right 30px, up 20px).
    const OFFX = 30
    const OFFY = -20
    for (const sp of specs) {
      sp.x += OFFX
      sp.y += OFFY
      if (sp.axis === 'y') {
        sp.min += OFFY
        sp.max += OFFY
        sp.stop += OFFY
      } else {
        sp.min += OFFX
        sp.max += OFFX
        sp.stop += OFFX
      }
    }

    this.carBodies = this.scene.physics.add.staticGroup()
    for (const sp of specs) {
      if (!this.scene.textures.exists(sp.tex)) continue
      const s = this.scene.add.sprite(sp.x, sp.y, sp.tex).setScale(SCALE).setDepth(sp.y)
      // static physics body so players collide with (and get nudged by) traffic
      this.carBodies.add(s)
      ;(s.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject()
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
        light: true,
      })
    }
  }

  /** Animated cars driving horizontally across a city map (DISCO-style), on
   *  fixed lanes. They yield to pedestrians and queue, but ignore the Osaka
   *  traffic light. `mapWidth` sets the off-screen wrap points. */
  addCityTraffic(mapWidth: number, lanes: Array<{ tex: string; anim: string; y: number; dir: 1 | -1 }>) {
    const SP = 90
    const SCALE = 0.5
    if (!this.carBodies) this.carBodies = this.scene.physics.add.staticGroup()
    for (const ln of lanes) {
      if (!this.scene.textures.exists(ln.tex)) continue
      // two cars per lane, spaced out
      for (const startFrac of [0.15, 0.62]) {
        const x = mapWidth * startFrac
        const s = this.scene.add.sprite(x, ln.y, ln.tex).setScale(SCALE).setDepth(ln.y)
        if (this.scene.anims.exists(ln.anim)) s.play(ln.anim)
        if (ln.dir < 0) s.setFlipX(false) // sheet already faces its drawn direction
        this.carBodies.add(s)
        ;(s.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject()
        this.cars.push({
          s,
          vx: SP * ln.dir,
          vy: 0,
          axis: 'x',
          min: -220,
          max: mapWidth + 220,
          cross: ln.y,
          phase: Math.random() * Math.PI * 2,
          stop: 0,
          light: false,
        })
      }
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
      const green = !c.light ? true : c.axis === 'y' ? vGreen : hGreen
      // Yield to a pedestrian in front, or queue behind a stopped car.
      const hold = this.pedestrianAhead(c) || this.carAhead(c)
      if (c.axis === 'y') {
        const ny = c.s.y + c.vy * d
        if (hold) {
          /* hold position */
        } else if (green) c.s.y = ny
        else if (c.vy > 0) c.s.y = c.s.y <= c.stop ? Math.min(ny, c.stop) : ny
        else c.s.y = c.s.y >= c.stop ? Math.max(ny, c.stop) : ny
        if (c.s.y < c.min) c.s.y = c.max
        else if (c.s.y > c.max) c.s.y = c.min
      } else {
        const nx = c.s.x + c.vx * d
        if (hold) {
          /* hold position */
        } else if (green) c.s.x = nx
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
      // keep the collision body in sync with the moving sprite
      ;(c.s.body as Phaser.Physics.Arcade.StaticBody | undefined)?.updateFromGameObject()
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
