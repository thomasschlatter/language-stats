import Phaser from 'phaser'
import Network from '../services/Network'
import { BackgroundMode } from '../../../types/BackgroundMode'
import store from '../stores'
import { setRoomJoined, setPracticeMode } from '../stores/RoomStore'
import { claimWorld } from '../singleInstance'



export default class Bootstrap extends Phaser.Scene {
  private preloadComplete = false
  network!: Network

   ATLAS = {
    cloud_day: ['assets/background/cloud_day.png','assets/background/cloud_day.json'],
    cloud_night: ['assets/background/cloud_night.png','assets/background/cloud_night.json'],
  }
  
   IMAGE = {
    backdrop_day: 'assets/background/backdrop_day.png',
    backdrop_night: 'assets/background/backdrop_night.png',
    sun_moon: 'assets/background/sun_moon.png',
  }
  
   TILEMAP = {
    islandMap: 'assets/map/islandMap.json',
    classroomMap: 'assets/map/classroomMap.json',
    lobbyMap: 'assets/map/lobbyMap.json',
    tilemap: 'assets/map/map.json',
    cityMap: 'assets/map/cityMap.json',
    roomMap: 'assets/map/roomMap.json',
    borderRoomMap: 'assets/map/borderRoomMap.json',
    classroomModernMap: 'assets/map/classroomModernMap.json',
    doctorsOfficeMap: 'assets/map/doctorsOfficeMap.json',
    shopMap: 'assets/map/shopMap.json',
    kitchenMap: 'assets/map/kitchenMap.json',
    bedroomMap: 'assets/map/bedroomMap.json',
    livingRoomMap: 'assets/map/livingRoomMap.json',
    clothingMap: 'assets/map/clothingMap.json',
    iceCreamMap: 'assets/map/iceCreamMap.json',
    museumMap: 'assets/map/museumMap.json',
    bathroomMap: 'assets/map/bathroomMap.json',
    gymMap: 'assets/map/gymMap.json',
  }
  
   OBJECTS = {
    tiles_wall: ['assets/map/FloorAndGround.png', {frameWidth: 32, frameHeight: 32}],
    // LimeZu Room_Builder sheets for the generated indoor room (roomMap.json).
    room_floors: ['assets/tileset/Room_Builder_Floors_32x32.png', {frameWidth: 32, frameHeight: 32}],
    room_walls: ['assets/tileset/Room_Builder_3d_walls_32x32.png', {frameWidth: 32, frameHeight: 32}],
    room_sky: ['assets/tileset/Room_Builder_Sky_32x32.png', {frameWidth: 32, frameHeight: 32}],
    room_borders: ['assets/tileset/Room_Builder_borders_32x32.png', {frameWidth: 32, frameHeight: 32}],
    room_wallpaper: ['assets/tileset/Room_Builder_Walls_32x32.png', {frameWidth: 32, frameHeight: 32}],
    room_class: ['assets/tileset/Classroom_Modern_32x32.png', {frameWidth: 32, frameHeight: 32}],
    room_hospital: ['assets/tileset/Hospital_Modern_32x32.png', {frameWidth: 32, frameHeight: 32}],
    room_shop: ['assets/tileset/Shop_Modern_32x32.png', {frameWidth: 32, frameHeight: 32}],
    room_kitchen: ['assets/tileset/Kitchen_Modern_32x32.png', {frameWidth: 32, frameHeight: 32}],
    room_bedroom: ['assets/tileset/Bedroom_Modern_32x32.png', {frameWidth: 32, frameHeight: 32}],
    room_living: ['assets/tileset/LivingRoom_Modern_32x32.png', {frameWidth: 32, frameHeight: 32}],
    room_clothing: ['assets/tileset/Clothing_Modern_32x32.png', {frameWidth: 32, frameHeight: 32}],
    room_icecream: ['assets/tileset/IceCream_Modern_32x32.png', {frameWidth: 32, frameHeight: 32}],
    room_museum: ['assets/tileset/Museum_Modern_32x32.png', {frameWidth: 32, frameHeight: 32}],
    room_bathroom: ['assets/tileset/Bathroom_Modern_32x32.png', {frameWidth: 32, frameHeight: 32}],
    room_gym: ['assets/tileset/Gym_Modern_32x32.png', {frameWidth: 32, frameHeight: 32}],
    //outside_objects: ['assets/tileset/Modern_Exteriors_Complete_Tileset.png', {frameWidth: 32, frameHeight: 32}],
    chairs: ['assets/items/chair.png', {frameWidth: 32, frameHeight: 64}],
    computers: ['assets/items/computer.png', {frameWidth: 96, frameHeight: 64}],
    whiteboards: ['assets/items/whiteboard.png', {frameWidth: 64, frameHeight: 64}],
    vendingmachines: ['assets/items/vendingmachine.png', {frameWidth: 48, frameHeight: 72}],
  }
  
   CHARACTERS = {
    adam: ['assets/character/adam.png', {frameWidth: 32, frameHeight: 48}],
    ash: ['assets/character/ash.png', {frameWidth: 32, frameHeight: 48}],
    lucy: ['assets/character/lucy.png', {frameWidth: 32, frameHeight: 48}],
    nancy: ['assets/character/nancy.png', {frameWidth: 32, frameHeight: 48}],
    bot: ['assets/character/Bot1_idle_down.png', {frameWidth: 16, frameHeight: 32}],
  }

  ANIMALS = {
    butterfly: ['assets/character/animated_butterfly_2_32x32.png', {frameWidth: 32, frameHeight: 32}],
    fox: ['assets/character/fox.png', {frameWidth: 32, frameHeight: 32}],
    crow: ['assets/character/crow.png', {frameWidth: 32, frameHeight: 32}],
    crow_flying: ['assets/character/crow_flying.png', {frameWidth: 64, frameHeight: 64}],
  }
  
   DOORS = {
    exits: ['assets/items/exit.png', {frameWidth: 32, frameHeight: 32}],
  }
  
   FURNITURE = {
    office: ['assets/tileset/Modern_Office_Black_Shadow.png', {frameWidth: 32, frameHeight: 32}],
    basement: ['assets/tileset/Basement.png', {frameWidth: 32, frameHeight: 32}],
    terrains: ['assets/tileset/Terrains.png', {frameWidth: 32, frameHeight: 32}],
    generic: ['assets/tileset/Generic.png', {frameWidth: 32, frameHeight: 32}],
  }
  
   COMPLETE = {
    complete_exterior_tileset: ['assets/tileset/Modern_Exteriors_Complete_Tileset.png', {frameWidth: 32, frameHeight: 32}],
  }


  constructor() {
    super('bootstrap')
  }

  preload() {

    for (const [key, value] of Object.entries(this.ATLAS)) {
      this.load.atlas(key, value[0], value[1])
    }

    for (const [key, value] of Object.entries(this.IMAGE)) {
      this.load.image(key, value)
    }

    for (const [key, value] of Object.entries(this.TILEMAP)) {
      this.load.tilemapTiledJSON(key, value)
    }

    for (const [key, value] of Object.entries(this.OBJECTS)) {
      this.load.spritesheet(key, value[0], value[1])
    }

    for (const [key, value] of Object.entries(this.FURNITURE)) {
      this.load.spritesheet(key, value[0], value[1])
    }

    for (const [key, value] of Object.entries(this.CHARACTERS)) {
      this.load.spritesheet(key, value[0], value[1])
    }

    for (const [key, value] of Object.entries(this.DOORS)) {
      this.load.spritesheet(key, value[0], value[1])
    }

    for (const [key, value] of Object.entries(this.COMPLETE)) {
      this.load.spritesheet(key, value[0], value[1])
    }

    for (const [key, value] of Object.entries(this.ANIMALS)) {
      this.load.spritesheet(key, value[0], value[1])
    }

    // Full-animation body sheet (idle/walk/sleep/sit/phone/shoot/… — see
    // Spritesheet_animations_GUIDE.png). Loaded as a plain image; testAnims.ts
    // slices the irregular rows into frames itself.
    this.load.image('bodytest', 'assets/character/Bodies/32x32/Body_32x32_08.png')

    // Osaka (Japanese city) world — a pre-rendered GuttyKreum street scene used
    // as an image world; collision comes from osakaCollision.ts.
    this.load.image('osaka_map', 'assets/guttykreum/osaka/OsakaWorld.png')

    // Cars (LimeZu Modern Exteriors) — one per direction, for street traffic.
    this.load.image('car_up', 'assets/vehicles/car_up.png')
    this.load.image('car_down', 'assets/vehicles/car_down.png')
    this.load.image('car_left', 'assets/vehicles/car_left.png')
    this.load.image('car_right', 'assets/vehicles/car_right.png')
    // Animated driving cars for the city (DISCO) world.
    this.load.spritesheet('car_white', 'assets/vehicles/car_white.png', { frameWidth: 192, frameHeight: 71 })
    this.load.spritesheet('car_blue', 'assets/vehicles/car_blue.png', { frameWidth: 192, frameHeight: 71 })

    this.load.on('complete', () => {
      this.preloadComplete = true
      // Tell the HTML boot loader (Groupifier logo) it can fade out.
      try {
        window.dispatchEvent(new Event('world-ready'))
      } catch {
        /* ignore */
      }
      // Deep-link: /game?mode=practice jumps straight into the solo word game
      // (used by the main app's "Word game" button) instead of world selection.
      if (new URLSearchParams(window.location.search).get('mode') === 'practice') {
        this.launchPractice()
        return
      }
      this.launchBackground(store.getState().user.backgroundMode)
    })
  }

  init() {
    this.network = new Network()
  }

  private launchBackground(backgroundMode: BackgroundMode) {
    this.scene.launch('background', { backgroundMode })
  }

  launchGame() {
    if (!this.preloadComplete) return
    this.network.webRTC?.checkPreviousPermission()
    this.scene.launch('game', {
      network: this.network,
    })

    // update Redux state
    store.dispatch(setRoomJoined(true))
  }

  launchGameWithoutBackground() {
    if (!this.preloadComplete) return
    if (this.scene.isActive('game')) return // never launch the game scene twice
    this.network.webRTC?.checkPreviousPermission()
    // remove background scene
    this.scene.stop('background')
    this.scene.launch('game', {
      network: this.network,
    })
    // update Redux state
    store.dispatch(setRoomJoined(true))
    // Claim the world for this window; a newer window entering evicts this one.
    this.worldGuardCleanup?.()
    this.worldGuardCleanup = claimWorld(() => this.evictFromWorld())
  }

  private worldGuardCleanup?: () => void

  // Kicked out because a newer window entered the world: leave the room and drop
  // back to world selection (no reload — the user can re-join, taking it back).
  private evictFromWorld() {
    this.worldGuardCleanup?.()
    this.worldGuardCleanup = undefined
    try {
      this.network.room?.leave()
    } catch {
      /* already gone */
    }
    this.scene.stop('game')
    store.dispatch(setRoomJoined(false))
    this.launchBackground(store.getState().user.backgroundMode)
    window.dispatchEvent(new Event('world-evicted'))
  }

  // Single-player word games hub — no network/Colyseus needed.
  launchPractice() {
    if (!this.preloadComplete) return
    this.scene.stop('background')
    this.scene.launch('gamemenu', {})
    store.dispatch(setPracticeMode(true))
  }

  launchLobby() {
    if (!this.preloadComplete) return
    this.network.webRTC?.checkPreviousPermission()
    // remove background scene
    //this.scene.stop('game')
    this.scene.launch('lobbyscene', {
      network: this.network,
    })
    // update Redux state
    store.dispatch(setRoomJoined(true))
  }

  changeBackgroundMode(backgroundMode: BackgroundMode) {
    this.scene.stop('background')
    this.launchBackground(backgroundMode)
  }
}



