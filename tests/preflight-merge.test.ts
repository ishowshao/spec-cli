import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { temporaryDirectory } from 'tempy'
import { describe, it, expect } from 'vitest'
import { execa } from 'execa'
import { preflightMerge } from '../src/core/preflight.ts'

async function initRepo(repo: string) {
  await execa('git', ['init'], { cwd: repo })
  await execa('git', ['config', 'user.name', 'test'], { cwd: repo })
  await execa('git', ['config', 'user.email', 'test@example.com'], { cwd: repo })
  writeFileSync(join(repo, 'a.txt'), 'x')
  await execa('git', ['add', 'a.txt'], { cwd: repo })
  await execa('git', ['commit', '-m', 'init'], { cwd: repo })
}

describe('preflightMerge', () => {
  it('fails if feature or target branch missing', async () => {
    const repo = temporaryDirectory()
    await initRepo(repo)
    // detect current branch as target
    const { stdout } = await execa('git', ['branch', '--show-current'], { cwd: repo })
    const target = stdout.trim() || 'main'
    await expect(preflightMerge(repo, 'feature-abc', target)).rejects.toThrow(/Feature branch/)
    // now create feature but use a missing target
    await execa('git', ['switch', '-c', 'feature-abc'], { cwd: repo })
    await expect(preflightMerge(repo, 'feature-abc', 'no-target')).rejects.toThrow(/Target branch/)
  })
})
