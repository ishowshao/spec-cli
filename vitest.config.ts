import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      exclude: [
        'node_modules/**',
        'dist/**',
        'src/cli.ts',
      ],
    },
  },
})
