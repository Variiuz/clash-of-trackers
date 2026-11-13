import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the build can be hosted from any sub-path (GitHub Pages, etc.)
export default defineConfig({ base: './', plugins: [react()] })
