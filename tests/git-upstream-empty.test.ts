import { describe, it, expect, beforeEach } from 'vitest'

// Mock execa to succeed but return empty stdout
vi.mock('execa', () => ({
  execa: async () => ({ stdout: '   ' }), // trims to empty -> null path
}))

let getUpstream: (repoRoot: string, branch: string) => Promise<string | null>

beforeEach(async () => {
  vi.resetModules()
  ;({ getUpstream } = await import('../src/core/git.ts'))
})

describe('getUpstream returns null on empty stdout', () => {
  it('resolves null when execa succeeds but stdout is empty', async () => {
    const result = await getUpstream(process.cwd(), 'main')
    expect(result).toBeNull()
  })
})

