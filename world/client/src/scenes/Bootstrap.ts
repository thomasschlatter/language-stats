import Phaser from 'phaser'
import Network from '../services/Network'
import { BackgroundMode } from '../../../types/BackgroundMode'
import store from '../stores'
import { setRoomJoined } from '../stores/RoomStore'



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
  }
  
   OBJECTS = {
    tiles_wall: ['assets/map/FloorAndGround.png', {frameWidth: 32, frameHeight: 32}],
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

    this.load.on('complete', () => {
      this.preloadComplete = true
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
    this.network.webRTC?.checkPreviousPermission()
    // remove background scene
    this.scene.stop('background')
    this.scene.launch('game', {
      network: this.network,
    })
    // update Redux state
    store.dispatch(setRoomJoined(true))
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



