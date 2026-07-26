import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // PORT lets a supervising process place the server when 5180 is already taken.
  server: { port: Number(process.env.PORT) || 5180, open: true },
})
