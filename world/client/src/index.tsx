import 'regenerator-runtime/runtime'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { ThemeProvider } from '@mui/material/styles'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

import './index.scss'
import './PhaserGame'
import muiTheme from './MuiTheme'
import App from './App'
import store from './stores'
import Terms from './Terms'
import Privacy from './Privacy'
import Cookies from './Cookies'
import Disclaimer from './Disclaimer'
import { guardSingleWorld } from './singleInstance'

const container = document.getElementById('root')
const root = createRoot(container!)

const blockedStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: '#222639', color: '#eee', fontFamily: 'system-ui, sans-serif', padding: 24, textAlign: 'center',
}

guardSingleWorld().then((guard) => {
  if (!guard.active) {
    root.render(
      <div style={blockedStyle}>
        <div style={{ maxWidth: 420 }}>
          <h1>Already in the world</h1>
          <p style={{ color: '#c2c2c2', lineHeight: 1.6 }}>
            The world is already open in another window of this browser. Two at once collide,
            so switch to that window — or take control here, and the other window will show
            this message instead.
          </p>
          <button
            style={{ padding: '8px 16px', borderRadius: 8, cursor: 'pointer' }}
            onClick={() => guard.takeOver?.()}
          >
            Choose this window
          </button>
        </div>
      </div>
    )
    return
  }
  root.render(
    <React.StrictMode>
      <Provider store={store}>
        <ThemeProvider theme={muiTheme}>
          <Router>
            <Routes>
              <Route index element={<App />} />
              <Route path="/terms/" element={<Terms />} />
              <Route path="/privacy/" element={<Privacy />} />
              <Route path="/cookies/" element={<Cookies />} />
              <Route path="/disclaimer/" element={<Disclaimer />} />
              <Route path="*" element={<App />} />
            </Routes>
          </Router>
        </ThemeProvider>
      </Provider>
    </React.StrictMode>
  )
})
