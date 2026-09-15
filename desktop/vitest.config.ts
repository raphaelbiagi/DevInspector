import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    // O renderer roda no Electron; aqui só testamos lógica pura, sem DOM.
    globals: false
  }
})
