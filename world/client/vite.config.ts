import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // Served at /game/ in production (behind the main app), at / in dev.
  base: process.env.VITE_BASE || '/',
  plugins: [react()]
})
