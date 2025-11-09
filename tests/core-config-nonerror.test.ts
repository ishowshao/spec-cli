import { describe, it, expect, beforeEach } from 'vitest'

// Mock node:fs to make readFileSync throw a non-Error
vi.mock('node:fs', () => {
  return {
    existsSync: () => true,
    readFileSync: () => {
      throw 'non-error-throw'
    },
  }
})

let loadConfig: (root: string) => unknown

beforeEach(async () => {
  vi.resetModules()
  ;({ loadConfig } = await import('../src/core/config.ts'))
})

describe('core/config fallback branch when non-Error is thrown', () => {
  it('wraps non-Error into Failed to load configuration', () => {
    expect(() => loadConfig('/tmp/repo')).toThrow(/Failed to load configuration: non-error-throw/)
  })
})
