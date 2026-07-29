import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/camada2-regras/**/*.test.ts'],
    globals: false,
  },
})
