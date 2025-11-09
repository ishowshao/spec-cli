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

describe('preflightMerge success path', () => {
  it('resolves when clean and both branches exist', async () => {
    const repo = temporaryDirectory()
    await initRepo(repo)

    // Determine current default branch as target
    const { stdout } = await execa('git', ['branch', '--show-current'], { cwd: repo })
    const target = stdout.trim() || 'main'

    // Create feature branch and switch back to target
    await execa('git', ['switch', '-c', 'feature-abc'], { cwd: repo })
    await execa('git', ['switch', target], { cwd: repo })

    await expect(preflightMerge(repo, 'feature-abc', target)).resolves.toBeUndefined()
  })
})

