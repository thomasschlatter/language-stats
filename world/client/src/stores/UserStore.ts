import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { sanitizeId } from '../util'
import { BackgroundMode } from '../../../types/BackgroundMode'

import phaserGame from '../PhaserGame'
import Bootstrap from '../scenes/Bootstrap'

export function getInitialBackgroundMode() {
  const currentHour = new Date().getHours()
  return currentHour > 6 && currentHour <= 18 ? BackgroundMode.DAY : BackgroundMode.NIGHT
}

export const userSlice = createSlice({
  name: 'user',
  initialState: {
    backgroundMode: getInitialBackgroundMode(),
    sessionId: '',
    videoConnected: false,
    loggedIn: false,
    playerNameMap: new Map<string, string>(),
    // How the player moves: 'tap' (click/tap to walk — the default), 'joystick'
    // (on-screen stick), or 'drag' (the character itself is the stick — hold +
    // drag). Rotate between them from the helper buttons.
    moveMode: ((typeof localStorage !== 'undefined' && localStorage.getItem('gf_move_mode')) ||
      'tap') as 'tap' | 'joystick' | 'drag',
  },
  reducers: {
    toggleBackgroundMode: (state) => {
      const newMode =
        state.backgroundMode === BackgroundMode.DAY ? BackgroundMode.NIGHT : BackgroundMode.DAY

      state.backgroundMode = newMode
      const bootstrap = phaserGame.scene.keys.bootstrap as Bootstrap
      bootstrap.changeBackgroundMode(newMode)
    },
    setSessionId: (state, action: PayloadAction<string>) => {
      state.sessionId = action.payload
    },
    setVideoConnected: (state, action: PayloadAction<boolean>) => {
      state.videoConnected = action.payload
    },
    setLoggedIn: (state, action: PayloadAction<boolean>) => {
      state.loggedIn = action.payload
    },
    setPlayerNameMap: (state, action: PayloadAction<{ id: string; name: string }>) => {
      state.playerNameMap.set(sanitizeId(action.payload.id), action.payload.name)
    },
    removePlayerNameMap: (state, action: PayloadAction<string>) => {
      state.playerNameMap.delete(sanitizeId(action.payload))
    },
    setMoveMode: (state, action: PayloadAction<'tap' | 'joystick' | 'drag'>) => {
      state.moveMode = action.payload
      try {
        localStorage.setItem('gf_move_mode', action.payload)
      } catch {
        /* ignore */
      }
    },
    cycleMoveMode: (state) => {
      // 'drag' is kept in code but not offered in the rotation yet.
      const order: Array<'tap' | 'joystick'> = ['tap', 'joystick']
      const i = order.indexOf(state.moveMode as 'tap' | 'joystick')
      state.moveMode = order[(i + 1) % order.length] || 'tap'
      try {
        localStorage.setItem('gf_move_mode', state.moveMode)
      } catch {
        /* ignore */
      }
    },
  },
})

export const {
  toggleBackgroundMode,
  setSessionId,
  setVideoConnected,
  setLoggedIn,
  setPlayerNameMap,
  removePlayerNameMap,
  setMoveMode,
  cycleMoveMode,
} = userSlice.actions

export default userSlice.reducer
