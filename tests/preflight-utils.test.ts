import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { temporaryDirectory } from 'tempy'
import { describe, it, expect } from 'vitest'
import { execa } from 'execa'
import { branchExists, getCurrentBranch, isWorkTreeClean } from '../src/core/preflight.ts'

async function initRepo(repo: string) {
  await execa('git', ['init'], { cwd: repo })
  await execa('git', ['config', 'user.name', 'test'], { cwd: repo })
  await execa('git', ['config', 'user.email', 'test@example.com'], { cwd: repo })
  writeFileSync(join(repo, 'README.md'), '# demo')
  await execa('git', ['add', 'README.md'], { cwd: repo })
  await execa('git', ['commit', '-m', 'chore: init'], { cwd: repo })
}

describe('core/preflight utils', () => {
  it('branchExists false for missing branch and getCurrentBranch returns active', async () => {
    const repo = temporaryDirectory()
    await initRepo(repo)

    expect(await branchExists(repo, 'nope')).toBe(false)
    const current = await getCurrentBranch(repo)
    // default branch can be main or master depending on git; just assert non-empty
    expect(current).toMatch(/\w+/)
  })

  it('isWorkTreeClean reflects dirty and clean states', async () => {
    const repo = temporaryDirectory()
    await initRepo(repo)
    expect(await isWorkTreeClean(repo)).toBe(true)
    writeFileSync(join(repo, 'dirty.txt'), 'x')
    expect(await isWorkTreeClean(repo)).toBe(false)
  })
})

