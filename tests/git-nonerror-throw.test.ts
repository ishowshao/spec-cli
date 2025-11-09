import { describe, it, expect, vi, beforeEach } from 'vitest'

// Make execa throw a non-Error to hit fallback branches
vi.mock('execa', () => ({
  execa: async () => {
    // throw a primitive so `instanceof Error` is false
     
    throw 'boom'
  },
}))

let git: typeof import('../src/core/git.ts')

beforeEach(async () => {
  vi.resetModules()
  git = await import('../src/core/git.ts')
})

describe('core/git fallback error message branches (non-Error throws)', () => {
  it('gitSwitch uses fallback message', async () => {
    await expect(git.gitSwitch(process.cwd(), 'x', true)).rejects.toMatchObject({ code: 'SWITCH_FAILED' })
  })

  it('gitAdd uses fallback message', async () => {
    await expect(git.gitAdd(process.cwd(), ['a'])).rejects.toMatchObject({ code: 'ADD_FAILED' })
  })

  it('gitCommit uses fallback message', async () => {
    await expect(git.gitCommit(process.cwd(), 'm')).rejects.toMatchObject({ code: 'COMMIT_FAILED' })
  })

  it('gitPull uses fallback message', async () => {
    await expect(git.gitPull(process.cwd(), 'b')).rejects.toMatchObject({ code: 'PULL_FAILED' })
  })

  it('gitMerge uses fallback message', async () => {
    await expect(git.gitMerge(process.cwd(), 'b')).rejects.toMatchObject({ code: 'MERGE_FAILED' })
  })

  it('gitPush uses fallback message', async () => {
    await expect(git.gitPush(process.cwd())).rejects.toMatchObject({ code: 'PUSH_FAILED' })
  })
})

