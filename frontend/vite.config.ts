import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // A production bundle without the API URL would fall back to localhost and
  // break for every visitor, so fail the build instead.
  if (command === 'build' && mode === 'production' && !loadEnv(mode, process.cwd()).VITE_API_BASE_URL) {
    throw new Error('VITE_API_BASE_URL must be set for production builds (the deployed backend URL).')
  }
  return {
    plugins: [react(), tailwindcss()],
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
    },
  }
})
