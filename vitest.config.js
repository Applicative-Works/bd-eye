import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/server/**/*.js'],
      exclude: ['src/server/index.js'],
      thresholds: {
        lines: 85,
        branches: 85,
        functions: 85,
        statements: 85
      }
    }
  }
})
