import { defineConfig } from 'vitest/config'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  test: {
    include: ['tests/**/*.test.js', 'tests/**/*.test.jsx'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js', 'src/**/*.jsx'],
      exclude: ['src/server/index.js', 'src/client/main.jsx'],
      thresholds: {
        lines: 85,
        branches: 85,
        functions: 85,
        statements: 85
      }
    }
  }
})
