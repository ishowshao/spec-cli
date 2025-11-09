import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { temporaryDirectory } from 'tempy'
import { describe, it, expect } from 'vitest'
import { execa } from 'execa'
import { isWorkTreeClean, getCurrentBranch, preflightMerge } from '../src/core/preflight.ts'

describe('core/preflight additional branches', () => {
  it('isWorkTreeClean returns false when git status fails (bad cwd)', async () => {
    const bad = join(temporaryDirectory(), 'missing')
    const clean = await isWorkTreeClean(bad)
    expect(clean).toBe(false)
  })

  it('getCurrentBranch throws when run outside a git repo', async () => {
    const dir = temporaryDirectory()
    await expect(getCurrentBranch(dir)).rejects.toThrow(/Failed to get current branch/)
  })

  it('preflightMerge fails early when worktree is dirty', async () => {
    const repo = temporaryDirectory()
    await execa('git', ['init'], { cwd: repo })
    await execa('git', ['config', 'user.name', 'test'], { cwd: repo })
    await execa('git', ['config', 'user.email', 'test@example.com'], { cwd: repo })
    writeFileSync(join(repo, 'a.txt'), 'x')
    await execa('git', ['add', 'a.txt'], { cwd: repo })
    await execa('git', ['commit', '-m', 'init'], { cwd: repo })

    // Make repo dirty
    writeFileSync(join(repo, 'dirty.txt'), 'x')

    await expect(preflightMerge(repo, 'feature-abc', 'main')).rejects.toThrow(/Working tree is not clean/)
  })
})

