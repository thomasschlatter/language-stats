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

const container = document.getElementById('root')
const root = createRoot(container!)

// The single-world guard runs only when entering the world (see Bootstrap), not
// here — so two tabs can browse Terms/room-selection without a conflict.
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
