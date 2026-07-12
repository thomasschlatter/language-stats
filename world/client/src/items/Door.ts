import { ItemType } from '../../../types/Items'
import Item from './Item'

export default class Door extends Item {
  destination?: string
  exitOrEnter?: string

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, frame?: string | number) {
    super(scene, x, y, texture, frame)

    this.itemType = ItemType.DOOR
  }

  onOverlapDialog() {
    this.setDialogBox('Press E to exit')
  }
}
