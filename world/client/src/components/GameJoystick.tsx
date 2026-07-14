import styled from 'styled-components'
import JoystickItem, { JoystickMovement } from './Joystick'
import phaserGame from '../PhaserGame'

// Reuses the same on-screen joystick as the multiplayer world, but for the solo
// movement mini-games (Word Fall, Labyrinth). Routes movement to whichever game
// scene is currently active and exposes handleJoystick().
const Backdrop = styled.div`
  position: fixed;
  bottom: 90px;
  right: 28px;
  z-index: 60;
`

const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)

export default function GameJoystick() {
  if (!isTouch) return null

  const route = (movement: JoystickMovement) => {
    for (const scene of phaserGame.scene.getScenes(true)) {
      const fn = (scene as any).handleJoystick
      if (typeof fn === 'function') fn.call(scene, movement)
    }
  }

  return (
    <Backdrop>
      <JoystickItem onDirectionChange={route} />
    </Backdrop>
  )
}
