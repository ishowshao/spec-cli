import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { temporaryDirectory } from 'tempy'
import { describe, it, expect } from 'vitest'
import { execa } from 'execa'
import { gitAdd, gitCommit, getUpstream, gitSwitch } from '../src/core/git.ts'

async function initRepo(repo: string) {
  await execa('git', ['init'], { cwd: repo })
  await execa('git', ['config', 'user.name', 'test'], { cwd: repo })
  await execa('git', ['config', 'user.email', 'test@example.com'], { cwd: repo })
  writeFileSync(join(repo, 'file.txt'), 'x')
  await gitAdd(repo, [join(repo, 'file.txt')])
  await gitCommit(repo, 'chore: init')
}

describe('core/git getUpstream', () => {
  it('returns remote branch name when upstream is set', async () => {
    const repo = temporaryDirectory()
    await initRepo(repo)

    // Create bare remote and set upstream for main
  const remote = join(repo, 'remote.git')
  await execa('git', ['init', '--bare', remote])
  await execa('git', ['remote', 'add', 'origin', remote], { cwd: repo })

  // Ensure main branch exists
  try { await gitSwitch(repo, 'main') } catch { await gitSwitch(repo, 'main', true) }
  await execa('git', ['push', '-u', 'origin', 'main'], { cwd: repo })

    const upstream = await getUpstream(repo, 'main')
    expect(upstream).toMatch(/origin\/main|origin\/master|origin\/HEAD/)
  })
})
