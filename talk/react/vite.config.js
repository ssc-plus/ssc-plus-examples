import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Built into dist/ and served by ../server.mjs at /react/, from the same origin
// as the API calls: the session token works only from the origin it was made for.
export default defineConfig({ plugins: [react()], base: '/react/' })
