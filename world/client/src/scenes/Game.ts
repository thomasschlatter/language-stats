import Phaser from 'phaser'

import { debugDraw } from '../utils/debug'
import { createCharacterAnims } from '../anims/CharacterAnims'
import { buildTestAnims } from '../anims/testAnims'
import { OSAKA_WALKABLE, OSAKA_SPAWN, OSAKA_BOT } from './osakaCollision'
import { AmbientLife } from './ambientLife'

import Item from '../items/Item'
import Chair from '../items/Chair'
import Computer from '../items/Computer'
import Whiteboard from '../items/Whiteboard'
import VendingMachine from '../items/VendingMachine'
import '../characters/MyPlayer'
import '../characters/OtherPlayer'
import MyPlayer from '../characters/MyPlayer'
import OtherPlayer from '../characters/OtherPlayer'
import PlayerSelector from '../characters/PlayerSelector'
import Network from '../services/Network'
import { IPlayer } from '../../../types/IOfficeState'
import { PlayerBehavior } from '../../../types/PlayerBehavior'
import { ItemType } from '../../../types/Items'

import store from '../stores'
import { setFocused, setShowChat } from '../stores/ChatStore'
import { NavKeys, Keyboard } from '../../../types/KeyboardState'

export default class Game extends Phaser.Scene {
  network!: Network
  private cursors!: NavKeys
  private keyE!: Phaser.Input.Keyboard.Key
  private keyR!: Phaser.Input.Keyboard.Key
  private keySpace!: Phaser.Input.Keyboard.Key
  private map!: Phaser.Tilemaps.Tilemap
  myPlayer!: MyPlayer
  botPlayer!: OtherPlayer
  private playerSelector!: Phaser.GameObjects.Zone
  private otherPlayers!: Phaser.Physics.Arcade.Group
  private otherPlayerMap = new Map<string, OtherPlayer>()
  computerMap = new Map<string, Computer>()
  private whiteboardMap = new Map<string, Whiteboard>()

  isNearBot = false
  userHasInteracted = true

  // Animation-tester overlay: a scaled-up sprite that plays a chosen test_ anim.
  private testSprite?: Phaser.GameObjects.Sprite

  // Ambient decoration: butterflies (nature worlds) + cars (Osaka).
  private ambient?: AmbientLife

  // Set by the per-world builders, consumed by setupPlayerAndNetwork().
  private spawnX = 0
  private spawnY = 0
  private botX = 0
  private botY = 0
  private worldColliders: Array<
    Phaser.Tilemaps.TilemapLayer | Phaser.Physics.Arcade.StaticGroup
  > = []

  constructor() {
    super('game')
  }

  registerKeys() {
    this.cursors = {
      ...this.input.keyboard.createCursorKeys(),
      ...(this.input.keyboard.addKeys('W,S,A,D') as Keyboard),
    }

    // maybe we can have a dedicated method for adding keys if more keys are needed in the future
    this.keyE = this.input.keyboard.addKey('E')
    this.keyR = this.input.keyboard.addKey('R')
    this.keySpace = this.input.keyboard.addKey('SPACE')
    this.input.keyboard.disableGlobalCapture()
    // Capture the movement keys so the browser doesn't scroll the (iframe) page
    // on arrow/WASD presses. Without this, an arrow keypress inside the embedded
    // World iframe scrolls/steals focus and the matching keyup is delivered to the
    // parent window instead of the game — leaving the key stuck "down" so the
    // character keeps walking after release. Other keys stay uncaptured so chat
    // typing still works.
    this.input.keyboard.addCapture('UP,DOWN,LEFT,RIGHT,W,A,S,D,SPACE')

    // Safety net: if the game ever loses focus (tab switch, click outside the
    // iframe, alt-tab) a keyup can be missed. Clear all key state on blur so a
    // key can never remain stuck "down".
    const resetKeys = () => this.input.keyboard?.resetKeys()
    this.game.events.on(Phaser.Core.Events.BLUR, resetKeys)
    window.addEventListener('blur', resetKeys)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) resetKeys()
    })

    this.input.keyboard.on('keydown-ENTER', (event) => {
      store.dispatch(setShowChat(true))
      store.dispatch(setFocused(true))
    })
    this.input.keyboard.on('keydown-ESC', (event) => {
      store.dispatch(setShowChat(false))
    })
  }

  disableKeys() {
    this.input.keyboard.enabled = false
  }

  enableKeys() {
    this.input.keyboard.enabled = true
  }

  create(data: { network: Network }) {
    if (!data.network) {
      throw new Error('server instance missing')
    } else {
      this.network = data.network
    }

    createCharacterAnims(this.anims)
    buildTestAnims(this) // register test_<name> anims from the full body sheet

    // Dispatch to the right map builder based on the world the player picked.
    const worldMap = (this.network as any).worldMap || 'meadow'
    if (worldMap === 'cafe') this.buildInterior('tilemap')
    else if (worldMap === 'town') this.buildInterior('lobbyMap')
    else if (worldMap === 'island') this.buildExteriorTiled('islandMap')
    else if (worldMap === 'osaka')
      this.buildImageWorld('osaka_map', OSAKA_WALKABLE, OSAKA_SPAWN, OSAKA_BOT)
    else this.buildProcedural(worldMap)

    this.setupPlayerAndNetwork()

    // Ambient life: cars on the Osaka streets, butterflies in the nature worlds.
    this.ambient = new AmbientLife(this)
    this.ambient.setPlayer(this.myPlayer)
    if (worldMap === 'osaka') {
      this.ambient.addOsakaTraffic()
      // players collide with (and get nudged by) the moving cars
      const carGroup = this.ambient.getCarGroup()
      if (carGroup)
        this.physics.add.collider([this.myPlayer, this.myPlayer.playerContainer], carGroup)
      // ravens flying across the sky + a couple of static ground crows
      const w = this.map.widthInPixels
      this.ambient.addFlyingRaven(150, w)
      this.ambient.addFlyingRaven(90, w)
      this.ambient.addCrows([
        [360, 660],
        [820, 505],
      ])
    } else if (worldMap === 'meadow' || worldMap === 'village' || worldMap === 'island')
      this.ambient.addButterflies(this.spawnX, this.spawnY, 6)
  }

  /** Called from the React AnimTester panel — plays a test_ anim on a big sprite
   *  floating above the player so we can eyeball each row of the body sheet. */
  playTestAnim(name: string) {
    if (!this.myPlayer) return
    if (!this.testSprite) {
      this.testSprite = this.add
        .sprite(this.myPlayer.x, this.myPlayer.y - 70, 'bodytest')
        .setScale(3)
        .setDepth(1_000_000)
    }
    this.testSprite
      .setPosition(this.myPlayer.x, this.myPlayer.y - 70)
      .setVisible(true)
    const key = `test_${name}`
    if (this.anims.exists(key)) this.testSprite.anims.play(key, true)
  }

  stopTestAnim() {
    this.testSprite?.setVisible(false)
    this.testSprite?.anims.stop()
  }

  // Shared across every world: spawn the player + bot, set up the camera,
  // colliders (built up in worldColliders) and network listeners.
  private setupPlayerAndNetwork() {
    this.myPlayer = this.add.myPlayer(this.spawnX, this.spawnY, 'adam', this.network.mySessionId)
    this.myPlayer.setDepth(this.myPlayer.y)
    this.playerSelector = new PlayerSelector(this, 0, 0, 16, 16)
    this.otherPlayers = this.physics.add.group({ classType: OtherPlayer })

    this.botPlayer = this.add.otherPlayer(this.botX, this.botY, 'fox', 'bot', 'Foxy', 1)
    this.botPlayer.setScale(2)

    this.cameras.main.zoom = 2 // zoomed in; integer zoom keeps pixel art crisp
    this.cameras.main.startFollow(this.myPlayer, true)
    this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels)
    // Keep players inside the map (belt-and-braces with the walls).
    this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels)
    const clampToWorld = (b: any) => b && b.setCollideWorldBounds && b.setCollideWorldBounds(true)
    clampToWorld(this.myPlayer.body)
    clampToWorld((this.myPlayer.playerContainer as any).body)
    for (const c of this.worldColliders)
      this.physics.add.collider([this.myPlayer, this.myPlayer.playerContainer], c)

    this.physics.add.overlap(this.myPlayer, this.otherPlayers, this.handlePlayersOverlap, undefined, this)
    this.physics.add.overlap(this.myPlayer, this.botPlayer, this.handleBotOverlap, undefined, this)

    // Click / tap-to-walk: send the player toward the clicked point. Listen on
    // the window (not Phaser input) because the React UI overlay sits above the
    // canvas and would otherwise swallow the clicks. Ignore clicks that land on
    // real UI controls so buttons/inputs still work. Toggle in helper buttons.
    const onTapToWalk = (e: PointerEvent) => {
      if (!this.myPlayer || !this.scene.isActive()) return
      if (!store.getState().user.tapToWalk) return
      const t = e.target as HTMLElement | null
      if (
        t &&
        t.closest(
          'button, a, input, textarea, select, label, [role="button"], [role="dialog"], .MuiPaper-root, .MuiButtonBase-root'
        )
      )
        return
      const canvas = this.game.canvas
      const rect = canvas.getBoundingClientRect()
      const p = this.cameras.main.getWorldPoint(e.clientX - rect.left, e.clientY - rect.top)
      this.myPlayer.setMoveTarget(p.x, p.y)
    }
    window.addEventListener('pointerdown', onTapToWalk)
    this.events.once('shutdown', () => window.removeEventListener('pointerdown', onTapToWalk))
    this.events.once('destroy', () => window.removeEventListener('pointerdown', onTapToWalk))

    this.network.onPlayerJoined(this.handlePlayerJoined, this)
    this.network.onPlayerLeft(this.handlePlayerLeft, this)
    this.network.onMyPlayerReady(this.handleMyPlayerReady, this)
    this.network.onMyPlayerVideoConnected(this.handleMyVideoConnected, this)
    this.network.onPlayerUpdated(this.handlePlayerUpdated, this)
    this.network.onItemUserAdded(this.handleItemUserAdded, this)
    this.network.onItemUserRemoved(this.handleItemUserRemoved, this)
    this.network.onChatMessageAdded(this.handleChatMessageAdded, this)
    this.network.onBotChatMessageAdded(this.handleBotMessagesAdded, this)
  }

  // Map a Tiled tileset name to its loaded Phaser texture key.
  private tilesetKey: Record<string, string> = {
    FloorAndGround: 'tiles_wall',
    Modern_Office_Black_Shadow: 'office',
    Generic: 'generic',
    Basement: 'basement',
    chair: 'chairs',
    computer: 'computers',
    whiteboard: 'whiteboards',
    vendingmachine: 'vendingmachines',
    Modern_Exteriors: 'complete_exterior_tileset',
  }

  // Render a Tiled object layer as static, depth-sorted sprites. The tileset
  // (and thus texture + frame) is resolved per-object from its gid, so layers
  // that mix tilesets render correctly. Collidable layers are collected into
  // worldColliders for setupPlayerAndNetwork().
  private addTiled(layerName: string, collidable: boolean) {
    const layer = this.map.getObjectLayer(layerName)
    if (!layer) return
    const group = this.physics.add.staticGroup()
    const tilesets = [...this.map.tilesets].sort((a, b) => b.firstgid - a.firstgid)
    for (const obj of layer.objects) {
      if (obj.gid === undefined) continue
      const ts = tilesets.find((t) => obj.gid! >= t.firstgid)
      const key = ts && this.tilesetKey[ts.name]
      if (!ts || !key) continue
      const x = obj.x! + obj.width! * 0.5
      const y = obj.y! - obj.height! * 0.5
      const sprite = group.create(x, y, key, obj.gid - ts.firstgid) as Phaser.Physics.Arcade.Sprite
      if (!sprite) continue
      sprite.setDepth(y)
      // Static bodies don't follow a repositioned sprite — recompute the body at
      // its final spot so the collider actually sits on the tile (else the player
      // walks straight through the walls).
      if (collidable && sprite.refreshBody) sprite.refreshBody()
    }
    if (collidable) {
      this.worldColliders.push(group)
      const k = group.getChildren()
      console.log('[collide]', layerName, 'sprites:', k.length, 'body0:', (k[0] as any)?.body?.width, 'x', (k[0] as any)?.body?.height, 'enable:', (k[0] as any)?.body?.enable)
    }
  }

  // A designed exterior Tiled map (the island / beach world).
  private buildExteriorTiled(key: string) {
    this.worldColliders = []
    this.map = this.make.tilemap({ key })
    const ext = this.map.addTilesetImage('Modern_Exteriors', 'complete_exterior_tileset')!
    this.addTiled('ObjectsUnder', false)
    const ground = this.map.createLayer('Ground', ext, 0, 0)!
    ground.setCollisionByProperty({ collides: true })
    this.worldColliders.push(ground)
    const ground2 = this.map.createLayer('Ground 2', ext, 0, 0)
    if (ground2) {
      ground2.setCollisionByProperty({ collides: true })
      this.worldColliders.push(ground2)
    }
    this.addTiled('Objects', false)
    this.addTiled('ObjectsOnCollide', true)
    this.addTiled('ObjectsOnCollide 2', true)
    this.spawnX = 705
    this.spawnY = 500
    this.botX = 330
    this.botY = 300
  }

  // An image world: a single pre-rendered scene (e.g. the GuttyKreum Osaka
  // street) drawn as a flat background, with collision from a walkability grid
  // ('1' walkable, '0' solid). Solid tiles are merged into horizontal strips to
  // keep the static-body count low.
  private buildImageWorld(
    imageKey: string,
    walkable: string[],
    spawn: [number, number],
    bot: [number, number]
  ) {
    this.worldColliders = []
    const img = this.add.image(0, 0, imageKey).setOrigin(0, 0).setDepth(0)
    const W = img.width
    const H = img.height
    // Blank tilemap purely so this.map (camera + physics bounds) is populated.
    this.map = this.make.tilemap({
      tileWidth: 32,
      tileHeight: 32,
      width: Math.ceil(W / 32),
      height: Math.ceil(H / 32),
    })
    this.spawnX = spawn[0]
    this.spawnY = spawn[1]
    this.botX = bot[0]
    this.botY = bot[1]

    const solids = this.physics.add.staticGroup()
    for (let ty = 0; ty < walkable.length; ty++) {
      const row = walkable[ty]
      let x = 0
      while (x < row.length) {
        if (row[x] === '0') {
          let x2 = x
          while (x2 < row.length && row[x2] === '0') x2++
          const w = (x2 - x) * 32
          const rect = this.add
            .rectangle(x * 32 + w / 2, ty * 32 + 16, w, 32)
            .setVisible(false)
          this.physics.add.existing(rect, true)
          solids.add(rect)
          x = x2
        } else x++
      }
    }
    this.worldColliders.push(solids)
  }

  // A designed indoor Tiled map (café = the office map, lounge = the lobby map).
  private buildInterior(key: string) {
    this.worldColliders = []
    this.map = this.make.tilemap({ key })
    const floor = this.map.addTilesetImage('FloorAndGround', 'tiles_wall')
    const office = this.map.addTilesetImage('Modern_Office_Black_Shadow', 'office')
    const generic = this.map.addTilesetImage('Generic', 'generic')
    const basement = this.map.addTilesetImage('Basement', 'basement')
    this.map.addTilesetImage('chair', 'chairs')
    this.map.addTilesetImage('computer', 'computers')
    this.map.addTilesetImage('whiteboard', 'whiteboards')
    this.map.addTilesetImage('vendingmachine', 'vendingmachines')
    const ext = this.map.addTilesetImage('Modern_Exteriors', 'complete_exterior_tileset')

    const groundTilesets = [floor, office, generic, basement, ext].filter(Boolean) as Phaser.Tilemaps.Tileset[]
    this.map.createLayer('Ground', groundTilesets, 0, 0)

    this.addTiled('Wall', true)
    this.addTiled('Basement', true)
    this.addTiled('Objects', true) // wall fronts/sides + office furniture -> solid
    this.addTiled('ObjectsOnCollide', true)
    this.addTiled('GenericObjects', true) // plants + generic decor -> solid
    this.addTiled('GenericObjectsOnCollide', true)
    this.addTiled('VendingMachine', true)
    this.addTiled('Chair', true) // chairs -> solid
    this.addTiled('Computer', false) // interactive — keep walkable
    this.addTiled('Whiteboard', false) // interactive — keep walkable

    this.spawnX = 705
    this.spawnY = 500
    // Foxy just below the spawn, on open floor (not embedded in a wall).
    this.botX = 705
    this.botY = 564
  }

  // Procedurally generated grass-biome worlds (meadow, village). Seeded by the
  // room id so everyone in the same room gets the SAME map.
  private buildProcedural(worldMap: string) {
    // Per-world knobs: the village is house-heavy with barely any water; the
    // meadow is balanced with ponds and groves.
    const cfg = worldMap === 'village'
      ? { ponds: 1, trees: 12, houses: 8 }
      : { ponds: 6, trees: 34, houses: 2 }

    // --- Procedurally generate a unique world, seeded by the room id so every
    // player in the same room gets the SAME map, and different rooms differ. ---
    const seedStr =
      (this.network as any).room?.roomId ||
      (this.network as any).room?.id ||
      this.network.mySessionId ||
      'world'
    let h = 2166136261
    for (let i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    let s = h >>> 0
    const rng = () => {
      s = (s + 0x6d2b79f5) | 0
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }

    const W = 48
    const H = 36
    const GRASS = 476 // textured grass (Tiled gid 477 → data index gid-1)

    // Water shoreline autotile — a water hole in grass (dirt bank on top/bottom,
    // grassy edge on the sides) + interior water with ripple/lily-pad variants.
    // This tileset only ships the EAST-facing shore tiles, so the WEST edges
    // reuse the same tiles flipped horizontally (see flipCells below).
    const W_N = 481, W_NE = 482
    const W_C = 654, W_E = 655
    const W_S = 827, W_SE = 828
    const W_RIPPLE = [997, 998, 999, 1000]
    const W_LILY = [1001, 1002, 1003]
    const WATER_TILES = [
      W_N, W_NE, W_C, W_E, W_S, W_SE,
      ...W_RIPPLE, ...W_LILY,
    ]

    // Decoration tiles — all have transparent backgrounds, so they're painted on
    // an overlay layer that sits above the grass (indices verified against the
    // tileset image; each value is a Tiled gid-1 frame index).
    // A big palette of scatter objects (indices verified against the tileset).
    // OBJ_WALK = flat ground detail you walk over; OBJ_SOLID = chunky objects
    // that block movement. Every one of these appears at least once in the world.
    const OBJ_WALK = [
      // flowers & plants
      188, 361, 422, 497, 498, 534, 671, 707, 880, 1175, 1435, 1608, 2152, 2153,
      2094, 2095, 2096, 2269, 2270, 2271, 2475, 2476,
      // mushrooms
      3060, 3061, 3062, 3233, 3234, 3235,
      // grass tufts, bushes & clover (low ground vegetation — walk over it)
      1095, 3424, 3579, 3580,
      495, 669, 879, 1094, 1262, 1353, 1526, 1781, 2302, 2303, 3406, 3407,
      // pebbles & gems
      3057, 3129, 3230, 3302, 3176, 3003,
      // sticks & twigs
      3788, 3789, 3796, 3797, 4306, 4314, 4316, 4650, 4656, 4657, 4658,
      // bottles & cans
      1509, 1510, 1511, 1682, 1683, 1684,
      // food
      1633, 1634, 1806, 1807, 4463, 7114, 10665,
      // misc
      1150, 670, 1958, 1979,
    ]
    const OBJ_SOLID = [
      // small trees / stumps
      1089, 1093, 3070, 4802,
      // rocks
      3058, 3059, 3231, 3232, 3403, 3405, 1788, 4629, 6770,
      // flower planters & boxes
      1954, 1955, 2127, 2128, 2300, 2301, 9225, 9398, 9571, 9917, 10090, 10263,
      // potted plants
      10833, 10838, 11006, 11007,
      // baskets, barrels, crates
      324, 325, 1144, 1501, 1502, 1503, 2019, 2203, 2477, 1846, 4805, 6936,
      // lanterns
      1674, 1675, 1676,
      // benches & tables
      2196, 2197, 2325, 5321, 5322,
      // posts, lamps, signs
      2435, 2724, 2788, 3081, 3170, 3288, 4098, 4099, 4167, 8320,
      // bins, wood piles, cone
      2844, 2845, 1574, 3927, 6255,
    ]
    // Full 4×4 apple tree (canopy + trunk + shadow base). The trunk tile blocks
    // movement; the rest of the footprint is walkable canopy overhang.
    const TREE = [
      [838, 839, 840, 841],
      [1011, 1012, 1013, 1014],
      [1184, 1185, 1186, 1187],
      [1357, 1358, 1359, 1360],
    ]
    const TREE_TRUNK = 1358

    const spawnTX = Math.floor(W / 2)
    const spawnTY = Math.floor(H / 2)

    // --- water mask: a sea border + a few ponds. Ponds are axis-aligned
    // rectangles (which keep the shoreline free of inner corners so the autotile
    // stays clean), but their proportions vary a lot — wide, tall, big, small —
    // so they read as different shapes. ---
    const water: boolean[][] = Array.from({ length: H }, (_, y) =>
      Array.from({ length: W }, (_, x) => x === 0 || y === 0 || x === W - 1 || y === H - 1)
    )
    const rectFree = (x0: number, y0: number, w: number, h: number) => {
      const cx = x0 + (w >> 1)
      const cy = y0 + (h >> 1)
      if (Math.abs(cx - spawnTX) <= 6 && Math.abs(cy - spawnTY) <= 6) return false
      for (let y = y0 - 1; y <= y0 + h; y++)
        for (let x = x0 - 1; x <= x0 + w; x++) {
          if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) return false
          if (water[y][x]) return false // keep a 1-cell grass gap between ponds
        }
      return true
    }
    // varied proportions: 0 wide, 1 tall, 2 big square, 3 small
    const pondKinds = [() => [6 + Math.floor(rng() * 6), 3 + Math.floor(rng() * 2)],
                       () => [3 + Math.floor(rng() * 2), 6 + Math.floor(rng() * 5)],
                       () => [6 + Math.floor(rng() * 4), 5 + Math.floor(rng() * 3)],
                       () => [3 + Math.floor(rng() * 2), 3 + Math.floor(rng() * 2)]]
    let pondCount = 0
    let pondTries = 300
    while (pondCount < cfg.ponds && pondTries-- > 0) {
      const [w, h] = pondKinds[Math.floor(rng() * pondKinds.length)]()
      const x0 = 2 + Math.floor(rng() * Math.max(1, W - 4 - w))
      const y0 = 2 + Math.floor(rng() * Math.max(1, H - 4 - h))
      if (!rectFree(x0, y0, w, h)) continue
      for (let y = y0; y < y0 + h; y++)
        for (let x = x0; x < x0 + w; x++) water[y][x] = true
      pondCount++
    }
    // keep the spawn clearing on dry land
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = spawnTX + dx
        const y = spawnTY + dy
        if (x > 0 && y > 0 && x < W - 1 && y < H - 1) water[y][x] = false
      }

    // --- autotile: grass everywhere, shore/water tiles on water cells (off-map
    // neighbours count as water, so the true map edge has no shore). ---
    const landAt = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < W && y < H && !water[y][x]
    const flipCells: Array<[number, number]> = []
    const grid: number[][] = []
    for (let y = 0; y < H; y++) {
      const row: number[] = []
      for (let x = 0; x < W; x++) {
        if (!water[y][x]) { row.push(GRASS); continue }
        const n = landAt(x, y - 1), s = landAt(x, y + 1)
        const wl = landAt(x - 1, y), e = landAt(x + 1, y)
        let t: number
        let flip = false
        if (n && wl) { t = W_NE; flip = true } // NW = NE mirrored
        else if (n && e) t = W_NE
        else if (s && wl) { t = W_SE; flip = true } // SW = SE mirrored
        else if (s && e) t = W_SE
        else if (n) t = W_N
        else if (s) t = W_S
        else if (wl) { t = W_E; flip = true } // W = E mirrored
        else if (e) t = W_E
        else {
          const rr = rng()
          t = rr < 0.06 ? W_LILY[Math.floor(rng() * W_LILY.length)]
            : rr < 0.35 ? W_RIPPLE[Math.floor(rng() * W_RIPPLE.length)]
            : W_C
        }
        row.push(t)
        if (flip) flipCells.push([x, y])
      }
      grid.push(row)
    }

    // The pond's top shore is two tiles tall: a grassy tuft overhang sits on the
    // land cell directly ABOVE each top-edge water cell (matching the tufts the
    // bottom/side edges already have). Overhang tiles are walkable land.
    const OVERHANG_N = 308, OVERHANG_NE = 309
    for (let y = 0; y < H - 1; y++) {
      for (let x = 0; x < W; x++) {
        if (water[y][x] || !water[y + 1][x]) continue // land cell above water
        if (landAt(x + 1, y + 1)) grid[y][x] = OVERHANG_NE // above a NE corner
        else if (landAt(x - 1, y + 1)) { grid[y][x] = OVERHANG_NE; flipCells.push([x, y]) } // NW
        else grid[y][x] = OVERHANG_N
      }
    }

    this.map = this.make.tilemap({ data: grid, tileWidth: 32, tileHeight: 32 })
    const tileset = this.map.addTilesetImage(
      'Modern_Exteriors',
      'complete_exterior_tileset',
      32,
      32
    )!
    const groundLayer = this.map.createLayer(0, tileset, 0, 0)!
    groundLayer.setCollision(WATER_TILES)
    // west-facing shores reuse the east tiles, mirrored horizontally
    for (const [fx, fy] of flipCells) {
      const gt = groundLayer.getTileAt(fx, fy)
      if (gt) gt.flipX = true
    }

    // --- decoration overlay: trees, shrubs, rocks, flowers on top of the grass ---
    const deco = this.map.createBlankLayer('decoration', tileset)!
    const used: boolean[][] = Array.from({ length: H }, () => new Array(W).fill(false))
    const isGrass = (x: number, y: number) =>
      x > 0 && y > 0 && x < W - 1 && y < H - 1 && grid[y][x] === GRASS
    const nearSpawn = (x: number, y: number) =>
      Math.abs(x - spawnTX) <= 5 && Math.abs(y - spawnTY) <= 5
    const pick = (arr: number[]) => arr[Math.floor(rng() * arr.length)]

    // Build the tree as a single 128×128 texture from the 4×4 tileset region so
    // each tree is one image we can depth-sort. We bake THREE recoloured
    // variants of the same clean tree (green apple, autumn orange, dark
    // evergreen) — reliable variety with no messy multi-tree extraction.
    type Recolor = (r: number, g: number, b: number, a: number) => [number, number, number, number]
    // Bake a w×h tileset region into one texture. `mask` keeps only the pixels
    // connected to the bottom-centre (drops touching neighbours in the sheet);
    // `recolor` re-tints each pixel.
    const buildObjTex = (
      key: string, c0: number, r0: number, w: number, h: number,
      opts: { mask?: boolean; recolor?: Recolor } = {}
    ) => {
      if (this.textures.exists(key)) return
      const srcImg = this.textures.get('complete_exterior_tileset').getSourceImage() as HTMLImageElement
      const cw = w * 32, ch = h * 32
      const canvasTex = this.textures.createCanvas(key, cw, ch)!
      const ctx = canvasTex.getContext()
      ctx.drawImage(srcImg, c0 * 32, r0 * 32, cw, ch, 0, 0, cw, ch)
      const img = ctx.getImageData(0, 0, cw, ch)
      const d = img.data
      if (opts.mask) {
        // label connected components, keep the largest (the object itself)
        const comp = new Int32Array(cw * ch).fill(-1)
        const nb = [-1, 1, -cw, cw, -cw - 1, -cw + 1, cw - 1, cw + 1]
        let best = -1, bestSize = 0, cid = 0
        for (let start = 0; start < cw * ch; start++) {
          if (d[start * 4 + 3] <= 30 || comp[start] >= 0) continue
          const stack = [start]; comp[start] = cid; let size = 0
          while (stack.length) {
            const p = stack.pop()!; size++
            const x = p % cw
            for (const off of nb) {
              const q = p + off
              if (q < 0 || q >= cw * ch) continue
              if (Math.abs((q % cw) - x) > 1) continue
              if (comp[q] < 0 && d[q * 4 + 3] > 30) { comp[q] = cid; stack.push(q) }
            }
          }
          if (size > bestSize) { bestSize = size; best = cid }
          cid++
        }
        for (let p = 0; p < cw * ch; p++) if (comp[p] !== best) d[p * 4 + 3] = 0
      }
      if (opts.recolor) {
        for (let i = 0; i < d.length; i += 4) {
          const [nr, ng, nb2, na] = opts.recolor(d[i], d[i + 1], d[i + 2], d[i + 3])
          d[i] = nr; d[i + 1] = ng; d[i + 2] = nb2; d[i + 3] = na
        }
      }
      ctx.putImageData(img, 0, 0)
      canvasTex.refresh()
    }
    const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
    // robust: red channel clearly dominant → an apple pixel (spares the brown trunk)
    const isRed = (r: number, g: number, b: number) => r - g > 40 && r - b > 40
    // Three GREEN tree tones (no red/orange). Apples are recoloured to foliage
    // green first, then the whole canopy is toned.
    const green: Recolor = (r, g, b, a) =>
      a !== 0 && isRed(r, g, b) ? [60, 120, 60, a] : [r, g, b, a]
    const light: Recolor = (r, g, b, a) => {
      if (a === 0) return [r, g, b, a]
      if (isRed(r, g, b)) { r = 60; g = 120; b = 60 }
      return g >= r && g > b + 8 ? [cl(r * 0.9 + 40), cl(g * 1.12 + 15), cl(b * 0.8 + 10), a] : [r, g, b, a]
    }
    const dark: Recolor = (r, g, b, a) => {
      if (a === 0) return [r, g, b, a]
      if (isRed(r, g, b)) { r = 60; g = 120; b = 60 }
      return g >= r && g > b + 8 ? [cl(r * 0.55), cl(g * 0.72), cl(b * 0.72 + 18), a] : [r, g, b, a]
    }
    // Two tree SHAPES (spread canopy + round), each in three green tones → six
    // distinct trees. The round shape is masked to drop its neighbours.
    const TONES: Array<[string, Recolor]> = [['green', green], ['light', light], ['dark', dark]]
    const TREE_KEYS: string[] = []
    for (const [tone, rc] of TONES) {
      buildObjTex(`tree_spread_${tone}`, 146, 4, 4, 4, { recolor: rc })
      buildObjTex(`tree_round_${tone}`, 154, 6, 4, 4, { mask: true, recolor: rc })
      TREE_KEYS.push(`tree_spread_${tone}`, `tree_round_${tone}`)
    }
    // Cottage — a big depth-sorted landmark building (2-storey, full height).
    // Masked (largest component) so the neighbouring house in the sheet is
    // dropped and the whole cottage incl. its base/porch is kept.
    const HOUSE_W = 14, HOUSE_H = 14
    buildObjTex('house_brown', 95, 45, HOUSE_W, HOUSE_H, { mask: true })
    const HOUSE_KEYS = ['house_brown']

    const solidTile = (x: number, y: number) => {
      const t = deco.putTileAt(TREE_TRUNK, x, y) // invisible collider (a collidable index)
      if (t) t.setVisible(false)
    }

    // Houses first (they need the most room) — a couple of cottage landmarks.
    // The cottage occupies only the LEFT part of its 14-wide texture: cols 0-7
    // (rows 1-13). Cols 8-13 are transparent, so only that footprint needs clear
    // ground, gets reserved, and gets collision (the whole solid body below the
    // roof peak — so you can't walk into the house from any side).
    const H_FOOT = 8
    let houseCount = 0
    let houseTries = 120
    while (houseCount < cfg.houses && houseTries-- > 0) {
      const hx = 2 + Math.floor(rng() * Math.max(1, W - HOUSE_W - 2))
      const hy = 2 + Math.floor(rng() * Math.max(1, H - HOUSE_H - 2))
      let ok = true
      for (let dy = 1; dy <= 13 && ok; dy++)
        for (let dx = 0; dx < H_FOOT && ok; dx++) {
          const x = hx + dx, y = hy + dy
          if (water[y][x] || used[y][x] || nearSpawn(x, y)) ok = false
        }
      if (!ok) continue
      const key = HOUSE_KEYS[Math.floor(rng() * HOUSE_KEYS.length)]
      this.add.image(hx * 32, hy * 32, key).setOrigin(0, 0).setDepth((hy + HOUSE_H) * 32 - 24)
      for (let dy = 1; dy <= 13; dy++)
        for (let dx = 0; dx < H_FOOT; dx++) used[hy + dy][hx + dx] = true
      for (let dy = 3; dy <= 13; dy++)
        for (let dx = 0; dx < H_FOOT; dx++) solidTile(hx + dx, hy + dy)
      houseCount++
    }

    // Trees. Placed in GROVES (clustered around a few centres) so the map reads
    // as clumps of forest rather than an even sprinkle. Each is a depth-sorted
    // image sorted by its trunk foot (player-centre y sits ~24px above its feet,
    // so drop the sort line: standing in front of the stem renders on top, while
    // walking up behind the tree stays hidden by the canopy).
    const placeTree = (tx: number, ty: number) => {
      if (tx < 1 || ty < 1 || tx > W - 5 || ty > H - 5) return false
      for (let dy = 0; dy < 4; dy++)
        for (let dx = 0; dx < 4; dx++)
          if (!isGrass(tx + dx, ty + dy) || used[ty + dy][tx + dx] || nearSpawn(tx + dx, ty + dy)) return false
      for (let dy = 0; dy < 4; dy++)
        for (let dx = 0; dx < 4; dx++) used[ty + dy][tx + dx] = true
      const treeKey = TREE_KEYS[Math.floor(rng() * TREE_KEYS.length)]
      this.add.image(tx * 32, ty * 32, treeKey).setOrigin(0, 0).setDepth((ty + 4) * 32 - 24)
      solidTile(tx + 1, ty + 3)
      solidTile(tx + 2, ty + 3)
      return true
    }
    let treeTotal = 0
    let groveTries = 60
    while (treeTotal < cfg.trees && groveTries-- > 0) {
      const gcx = 3 + Math.floor(rng() * (W - 8))
      const gcy = 3 + Math.floor(rng() * (H - 8))
      const target = 4 + Math.floor(rng() * 5)
      let placed = 0, attempts = 0
      while (placed < target && attempts++ < 30) {
        const tx = gcx + Math.floor((rng() - 0.5) * 8)
        const ty = gcy + Math.floor((rng() - 0.5) * 6)
        if (placeTree(tx, ty)) { placed++; treeTotal++ }
      }
    }

    // place a single object on the first free grass cell we can find
    const placeOne = (idx: number) => {
      for (let tries = 0; tries < 60; tries++) {
        const x = 1 + Math.floor(rng() * (W - 2))
        const y = 1 + Math.floor(rng() * (H - 2))
        if (!isGrass(x, y) || used[y][x] || nearSpawn(x, y)) continue
        deco.putTileAt(idx, x, y)
        used[y][x] = true
        return
      }
    }
    // guarantee every object type (100+) appears at least once
    for (const idx of OBJ_SOLID) placeOne(idx)
    for (const idx of OBJ_WALK) placeOne(idx)

    // Scatter extra copies in CLUSTERS (patches of a few related objects around
    // a centre) rather than an even sprinkle, so the ground reads as little
    // gardens/piles with open meadow between them.
    const allObjs = [...OBJ_WALK, ...OBJ_SOLID]
    for (let c = 0; c < 34; c++) {
      const ccx = 2 + Math.floor(rng() * (W - 4))
      const ccy = 2 + Math.floor(rng() * (H - 4))
      const palette: number[] = []
      const kinds = 1 + Math.floor(rng() * 3)
      for (let k = 0; k < kinds; k++) palette.push(allObjs[Math.floor(rng() * allObjs.length)])
      const n = 3 + Math.floor(rng() * 8)
      for (let i = 0; i < n; i++) {
        const x = ccx + Math.floor((rng() - 0.5) * 6)
        const y = ccy + Math.floor((rng() - 0.5) * 6)
        if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue
        if (!isGrass(x, y) || used[y][x] || nearSpawn(x, y)) continue
        deco.putTileAt(palette[Math.floor(rng() * palette.length)], x, y)
        used[y][x] = true
      }
    }

    // tree trunks + chunky objects stop the player; ground detail is walkable
    deco.setCollision([TREE_TRUNK, ...OBJ_SOLID])

    // Bot — place Foxy on the nearest clear grass tile to its usual spot so it
    // never ends up standing in a pond (or inside a tree/prop).
    const foxTargetX = 10, foxTargetY = 9
    let foxX = spawnTX, foxY = spawnTY
    ringSearch: for (let r = 0; r < Math.max(W, H); r++) {
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue // ring edge only
          const x = foxTargetX + dx, y = foxTargetY + dy
          if (x <= 0 || y <= 0 || x >= W - 1 || y >= H - 1) continue
          if (grid[y][x] === GRASS && !used[y][x]) { foxX = x; foxY = y; break ringSearch }
        }
    }

    this.spawnX = spawnTX * 32
    this.spawnY = spawnTY * 32
    this.botX = foxX * 32
    this.botY = foxY * 32
    this.worldColliders = [groundLayer, deco]
  }

  private handleItemSelectorOverlap(playerSelector, selectionItem) {
    const currentItem = playerSelector.selectedItem as Item
    // currentItem is undefined if nothing was perviously selected
    if (currentItem) {
      // if the selection has not changed, do nothing
      if (currentItem === selectionItem || currentItem.depth >= selectionItem.depth) {
        return
      }
      // if selection changes, clear pervious dialog
      if (this.myPlayer.playerBehavior !== PlayerBehavior.SITTING) currentItem.clearDialogBox()
    }

    // set selected item and set up new dialog
    playerSelector.selectedItem = selectionItem
    selectionItem.onOverlapDialog()
  }

  // function to add new player to the otherPlayer group
  private handlePlayerJoined(newPlayer: IPlayer, id: string) {
    const otherPlayer = this.add.otherPlayer(newPlayer.x, newPlayer.y, 'adam', id, newPlayer.name)
    this.otherPlayers.add(otherPlayer)
    this.otherPlayerMap.set(id, otherPlayer)
    // If they already have a custom avatar (joined before us), composite it now.
    console.log('[avatar] player joined', id, 'avatar=', (newPlayer.avatar || '(none)').slice(0, 60))
    if (newPlayer.avatar) otherPlayer.updateOtherPlayer('avatar', newPlayer.avatar)
  }

  // function to remove the player who left from the otherPlayer group
  private handlePlayerLeft(id: string) {
    if (this.otherPlayerMap.has(id)) {
      const otherPlayer = this.otherPlayerMap.get(id)
      if (!otherPlayer) return
      this.otherPlayers.remove(otherPlayer, true, true)
      this.otherPlayerMap.delete(id)
    }
  }

  private handleMyPlayerReady() {
    this.myPlayer.readyToConnect = true
  }

  private handleMyVideoConnected() {
    this.myPlayer.videoConnected = true
  }

  // function to update target position upon receiving player updates
  private handlePlayerUpdated(field: string, value: number | string, id: string) {
    const otherPlayer = this.otherPlayerMap.get(id)
    otherPlayer?.updateOtherPlayer(field, value)
  }

  private handlePlayersOverlap(myPlayer, otherPlayer) {
    otherPlayer.makeCall(myPlayer, this.network?.webRTC)
  }

  private handleBotOverlap(myPlayer, bot) {
    this.isNearBot = true
    if (!this.userHasInteracted) return
    
    //this.network.addChatMessage("Bot: Hi there")
    bot.updateDialogBubble("Yip-yip Woof-woof! I am foxy! Use @foxy to talk to me!")
    //this.network.nearBot()
    this.userHasInteracted = false
    //bot.makeCall(myPlayer, this.network?.webRTC)
  }

  private handleItemUserAdded(playerId: string, itemId: string, itemType: ItemType) {
    if (itemType === ItemType.COMPUTER) {
      const computer = this.computerMap.get(itemId)
      computer?.addCurrentUser(playerId)
    } else if (itemType === ItemType.WHITEBOARD) {
      const whiteboard = this.whiteboardMap.get(itemId)
      whiteboard?.addCurrentUser(playerId)
    }
  }

  private handleItemUserRemoved(playerId: string, itemId: string, itemType: ItemType) {
    if (itemType === ItemType.COMPUTER) {
      const computer = this.computerMap.get(itemId)
      computer?.removeCurrentUser(playerId)
    } else if (itemType === ItemType.WHITEBOARD) {
      const whiteboard = this.whiteboardMap.get(itemId)
      whiteboard?.removeCurrentUser(playerId)
    }
  }

  private handleChatMessageAdded(playerId: string, content: string) {
    const otherPlayer = this.otherPlayerMap.get(playerId)
    otherPlayer?.updateDialogBubble(content)
  }

  private handleBotMessagesAdded(content: string) {
    this.botPlayer.updateDialogBubble(content.trim())
  }


  update(t: number, dt: number) {
    if (this.myPlayer && this.network) {
      this.playerSelector.update(this.myPlayer, this.cursors)
      this.myPlayer.update(this.playerSelector, this.cursors, this.keyE, this.keyR, this.keySpace, this.network)
      // Keep the animation-tester sprite hovering above the player.
      if (this.testSprite?.visible)
        this.testSprite.setPosition(this.myPlayer.x, this.myPlayer.y - 70)
    }
    this.ambient?.update(dt)
  }
}
