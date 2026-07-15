import Phaser from "phaser";
import PlayerSelector from "./PlayerSelector";
import { PlayerBehavior } from "../../../types/PlayerBehavior";
import { sittingShiftData } from "./Player";
import Player from "./Player";
import Network from "../services/Network";
import Chair from "../items/Chair";
import Computer from "../items/Computer";
import Whiteboard from "../items/Whiteboard";
import Game from "../scenes/Game";

import { phaserEvents, Event } from "../events/EventCenter";
import store from "../stores";
import { pushPlayerJoinedMessage } from "../stores/ChatStore";
import { ItemType } from "../../../types/Items";
import { NavKeys } from "../../../types/KeyboardState";
import { JoystickMovement } from "../components/Joystick";
import { openURL } from "../utils/helpers";
import phaserGame from "../PhaserGame";
import Bootstrap from "../scenes/Bootstrap";

export default class MyPlayer extends Player {
  private playContainerBody: Phaser.Physics.Arcade.Body;
  private chairOnSit?: Chair;
  public joystickMovement?: JoystickMovement;
  // Click/tap-to-walk destination (world coords); cleared on arrival, on wall
  // contact, or when the player takes manual keyboard/joystick control.
  private moveTarget?: { x: number; y: number };
  private movePath?: Array<{ x: number; y: number }>;

  /** Set a click/tap-to-walk destination (world coordinates), straight-line. */
  setMoveTarget(x: number, y: number) {
    this.moveTarget = { x, y };
    this.movePath = undefined;
  }

  /** Follow a pathfound route (pixel waypoints) around obstacles. */
  setMovePath(path: Array<{ x: number; y: number }>) {
    this.movePath = path.length ? path.slice() : undefined;
    this.moveTarget = undefined;
  }
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    id: string,
    frame?: string | number
  ) {
    super(scene, x, y, texture, id, frame);
    this.playContainerBody = this.playerContainer
      .body as Phaser.Physics.Arcade.Body;
  }

  setPlayerName(name: string) {
    this.playerName.setText(name);
    phaserEvents.emit(Event.MY_PLAYER_NAME_CHANGE, name);
    //store.dispatch(pushPlayerJoinedMessage(name));
  }

  setPlayerTexture(texture: string) {
    this.playerTexture = texture;
    this.anims.play(`${this.playerTexture}_idle_down`, true);
    phaserEvents.emit(
      Event.MY_PLAYER_TEXTURE_CHANGE,
      this.x,
      this.y,
      this.anims.currentAnim.key
    );
  }

  handleJoystickMovement(movement: JoystickMovement) {
    this.joystickMovement = movement;
  }

  update(
    playerSelector: PlayerSelector,
    cursors: NavKeys,
    keyE: Phaser.Input.Keyboard.Key,
    keyR: Phaser.Input.Keyboard.Key,
    keySpace: Phaser.Input.Keyboard.Key,
    network: Network,
    keySit?: Phaser.Input.Keyboard.Key
  ) {
    if (!cursors) return;

    // Glue the name/dialog container to the character every frame (it has no
    // independent collision now), so the label never drifts off when a wall or
    // car blocks the body.
    this.playContainerBody.reset(this.x, this.y - 30);

    const item = playerSelector.selectedItem;

    if (Phaser.Input.Keyboard.JustDown(keyR)) {
      switch (item?.itemType) {
        case ItemType.COMPUTER:
          const computer = item as Computer;
          computer.openDialog(this.playerId, network);
          break;
        case ItemType.WHITEBOARD:
          const whiteboard = item as Whiteboard;
          whiteboard.openDialog(network);
          break;
        case ItemType.VENDINGMACHINE:
          // hacky and hard-coded, but leaving it as is for now
          const url = "https://www.buymeacoffee.com/skyoffice";
          openURL(url);
          break;
      }
    }

    switch (this.playerBehavior) {
      case PlayerBehavior.IDLE:
        // Standalone sit: sit facing whichever way you're currently facing (walk up to
        // a chair facing the board, then sit). Press again (or E) to stand.
        if (keySit && Phaser.Input.Keyboard.JustDown(keySit)) {
          const dir = this.anims.currentAnim?.key.split("_")[2] ?? "down";
          this.setVelocity(0, 0);
          this.playContainerBody.setVelocity(0, 0);
          this.play(`${this.playerTexture}_sit_${dir}`, true);
          this.playerBehavior = PlayerBehavior.SITTING;
          network.updatePlayer(this.x, this.y, this.anims.currentAnim.key);
          return;
        }
        if (Phaser.Input.Keyboard.JustDown(keySpace)) {
          //const doorItem = item as Door
          //doorItem.clearDialogBox()
          //const game = phaserGame.scene.keys.game as Game
          //game.scene.stop('game')
          //game.scene.stop('background')
          //game.scene.launch('lobbyscene', {
          //  network: game.network,
          //})
          //const bootstrap = phaserGame.scene.keys.bootstrap as Bootstrap
          //bootstrap.network
          //  .joinOrCreatePublic()
          //  .then(() => bootstrap.launchLobby())
          //  .catch((error) => console.error(error))
          //return
        }
        // if press E in front of selected chair
        if (
          Phaser.Input.Keyboard.JustDown(keyE) &&
          item?.itemType === ItemType.CHAIR
        ) {
          const chairItem = item as Chair;
          /**
           * move player to the chair and play sit animation
           * a delay is called to wait for player movement (from previous velocity) to end
           * as the player tends to move one more frame before sitting down causing player
           * not sitting at the center of the chair
           */
          this.scene.time.addEvent({
            delay: 10,
            callback: () => {
              // update character velocity and position
              this.setVelocity(0, 0);
              if (chairItem.itemDirection) {
                this.setPosition(
                  chairItem.x + sittingShiftData[chairItem.itemDirection][0],
                  chairItem.y + sittingShiftData[chairItem.itemDirection][1]
                ).setDepth(
                  chairItem.depth + sittingShiftData[chairItem.itemDirection][2]
                );
                // also update playerNameContainer velocity and position
                this.playContainerBody.setVelocity(0, 0);
                this.playerContainer.setPosition(
                  chairItem.x + sittingShiftData[chairItem.itemDirection][0],
                  chairItem.y +
                    sittingShiftData[chairItem.itemDirection][1] -
                    30
                );
              }

              this.play(
                `${this.playerTexture}_sit_${chairItem.itemDirection}`,
                true
              );
              playerSelector.selectedItem = undefined;
              if (chairItem.itemDirection === "up") {
                playerSelector.setPosition(this.x, this.y - this.height);
              } else {
                playerSelector.setPosition(0, 0);
              }
              // send new location and anim to server
              network.updatePlayer(this.x, this.y, this.anims.currentAnim.key);
            },
            loop: false,
          });
          // set up new dialog as player sits down
          chairItem.clearDialogBox();
          chairItem.setDialogBox("Press E to leave");
          this.chairOnSit = chairItem;
          this.moveTarget = undefined;
          this.movePath = undefined;
          this.playerBehavior = PlayerBehavior.SITTING;
          return;
        }

        const speed = 200;
        let vx = 0;
        let vy = 0;

        let joystickLeft = false;
        let joystickRight = false;
        let joystickUp = false;
        let joystickDown = false;

        if (this.joystickMovement?.isMoving) {
          joystickLeft = this.joystickMovement.direction.left;
          joystickRight = this.joystickMovement.direction.right;
          joystickUp = this.joystickMovement.direction.up;
          joystickDown = this.joystickMovement.direction.down;
        }

        if (cursors.left?.isDown || cursors.A?.isDown || joystickLeft)
          vx -= speed;
        if (cursors.right?.isDown || cursors.D?.isDown || joystickRight)
          vx += speed;
        if (cursors.up?.isDown || cursors.W?.isDown || joystickUp) {
          vy -= speed;
          this.setDepth(this.y); //change player.depth if player.y changes
        }
        if (cursors.down?.isDown || cursors.S?.isDown || joystickDown) {
          vy += speed;
          this.setDepth(this.y); //change player.depth if player.y changes
        }

        // Click/tap-to-walk: follow the A* path (routing around obstacles), or a
        // single straight-line target. Manual input takes over instantly.
        if (vx !== 0 || vy !== 0) {
          this.moveTarget = undefined;
          this.movePath = undefined;
        } else {
          // drop path waypoints we've already reached
          while (this.movePath && this.movePath.length) {
            const wp = this.movePath[0];
            if (Math.hypot(wp.x - this.x, wp.y - this.y) < 6) this.movePath.shift();
            else break;
          }
          if (this.movePath && !this.movePath.length) this.movePath = undefined;

          const target = (this.movePath && this.movePath[0]) || this.moveTarget;
          if (target) {
            const dx = target.x - this.x;
            const dy = target.y - this.y;
            const dist = Math.hypot(dx, dy);
            const b = this.body.blocked;
            if (!this.movePath && dist < 4) {
              this.moveTarget = undefined; // arrived at a straight-line target
            } else if (
              !this.movePath &&
              ((dx > 4 && b.right) || (dx < -4 && b.left) || (dy > 4 && b.down) || (dy < -4 && b.up))
            ) {
              this.moveTarget = undefined; // straight-line move hit a wall
            } else if (dist > 0.001) {
              vx = (dx / dist) * speed;
              vy = (dy / dist) * speed;
              this.setDepth(this.y);
            }
          }
        }

        // update character velocity
        this.setVelocity(vx, vy);
        this.body.velocity.setLength(speed);

        // update animation according to velocity and send new location and anim to server
        if (vx !== 0 || vy !== 0)
          network.updatePlayer(this.x, this.y, this.anims.currentAnim.key);
        if (vx > 0) {
          this.play(`${this.playerTexture}_run_right`, true);
        } else if (vx < 0) {
          this.play(`${this.playerTexture}_run_left`, true);
        } else if (vy > 0) {
          this.play(`${this.playerTexture}_run_down`, true);
        } else if (vy < 0) {
          this.play(`${this.playerTexture}_run_up`, true);
        } else {
          const parts = this.anims.currentAnim.key.split("_");
          parts[1] = "idle";
          const newAnim = parts.join("_");
          // this prevents idle animation keeps getting called
          if (this.anims.currentAnim.key !== newAnim) {
            this.play(parts.join("_"), true);
            // send new location and anim to server
            network.updatePlayer(this.x, this.y, this.anims.currentAnim.key);
          }
        }
        break;

      case PlayerBehavior.SITTING:
        // back to idle if player presses E (or the sit key) while sitting
        if (
          Phaser.Input.Keyboard.JustDown(keyE) ||
          (keySit && Phaser.Input.Keyboard.JustDown(keySit))
        ) {
          const parts = this.anims.currentAnim.key.split("_");
          parts[1] = "idle";
          this.play(parts.join("_"), true);
          this.playerBehavior = PlayerBehavior.IDLE;
          this.chairOnSit?.clearDialogBox();
          playerSelector.setPosition(this.x, this.y);
          playerSelector.update(this, cursors);
          network.updatePlayer(this.x, this.y, this.anims.currentAnim.key);
        }
        break;
    }
  }
}

declare global {
  namespace Phaser.GameObjects {
    interface GameObjectFactory {
      myPlayer(
        x: number,
        y: number,
        texture: string,
        id: string,
        frame?: string | number
      ): MyPlayer;
    }
  }
}

Phaser.GameObjects.GameObjectFactory.register(
  "myPlayer",
  function (
    this: Phaser.GameObjects.GameObjectFactory,
    x: number,
    y: number,
    texture: string,
    id: string,
    frame?: string | number
  ) {
    const sprite = new MyPlayer(this.scene, x, y, texture, id, frame);

    this.displayList.add(sprite);
    this.updateList.add(sprite);

    this.scene.physics.world.enableBody(
      sprite,
      Phaser.Physics.Arcade.DYNAMIC_BODY
    );

    const collisionScale = [0.5, 0.2];
    sprite.body
      .setSize(
        sprite.width * collisionScale[0],
        sprite.height * collisionScale[1]
      )
      .setOffset(
        sprite.width * (1 - collisionScale[0]) * 0.5,
        sprite.height * (1 - collisionScale[1])
      );

    return sprite;
  }
);
