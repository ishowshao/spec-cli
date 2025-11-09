import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { temporaryDirectory } from 'tempy'
import { describe, it, expect, vi } from 'vitest'
import { execa } from 'execa'
import { createCommand } from '../src/commands/create.ts'
import type { LlmClient } from '../src/types.ts'

class SequenceLlm implements LlmClient {
  private i = 0
  constructor(private seq: string[]) {}
  async generateSlug(): Promise<string> {
    const v = this.seq[this.i] ?? this.seq[this.seq.length - 1]
    this.i++
    return v
  }
}

async function initRepo(repo: string, withConfig = true) {
  await execa('git', ['init'], { cwd: repo })
  await execa('git', ['config', 'user.name', 'test'], { cwd: repo })
  await execa('git', ['config', 'user.email', 'test@example.com'], { cwd: repo })
  if (withConfig) {
    const config = {
      schemaVersion: 1,
      docsDir: 'docs',
      docTemplates: [],
      scaffoldPaths: ['tests/{slug}.test.ts', 'e2e/{slug}/'],
      branchFormat: 'feature-{slug}',
      defaultMergeTarget: 'main',
    }
    writeFileSync(join(repo, 'spec.config.json'), JSON.stringify(config, null, 2))
    await execa('git', ['add', 'spec.config.json'], { cwd: repo })
    await execa('git', ['commit', '-m', 'chore: add config'], { cwd: repo })
  }
}

describe('createCommand branch coverage', () => {
  it('handles slug uniqueness loop: existing docs, existing branch, scaffold conflict, then success', async () => {
    const cwd = process.cwd()
    const repo = temporaryDirectory()
    await initRepo(repo)

    // 1) existing docs directory -> triggers checkFeatureExists branch
    mkdirSync(join(repo, 'docs', 'exists-doc'), { recursive: true })
    writeFileSync(join(repo, 'docs', 'exists-doc', '.keep'), '')
    await execa('git', ['add', '.'], { cwd: repo })
    await execa('git', ['commit', '-m', 'chore: seed docs'], { cwd: repo })

    // 2) existing branch -> triggers branchExists branch
    await execa('git', ['branch', 'feature-exists-branch'], { cwd: repo })

    // 3) scaffold conflict -> pre-create the file that a template would create
    mkdirSync(join(repo, 'tests'), { recursive: true })
    writeFileSync(join(repo, 'tests', 'conflict-slug.test.ts'), '')
    await execa('git', ['add', '.'], { cwd: repo })
    await execa('git', ['commit', '-m', 'chore: seed scaffold conflict'], { cwd: repo })

    const llm = new SequenceLlm(['exists-doc', 'exists-branch', 'conflict-slug', 'ok-final'])

    try {
      process.chdir(repo)
      await createCommand('desc', llm)

      // should end up on final ok branch
      const { stdout: branch } = await execa('git', ['branch', '--show-current'], { cwd: repo })
      expect(branch.trim()).toBe('feature-ok-final')
    } finally {
      process.chdir(cwd)
    }
  })

  it('exits with CONFIG_ERROR when configuration file is missing', async () => {
    const cwd = process.cwd()
    const repo = temporaryDirectory()
    await initRepo(repo, /*withConfig*/ false)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`)
    }) as unknown as (code?: number) => never)

    try {
      process.chdir(repo)
      // any llm; it won’t be used
      const llm = new SequenceLlm(['any'])
      await createCommand('desc', llm)
      throw new Error('should have exited')
    } catch (e) {
      // CONFIG_ERROR = 2
      expect(String(e)).toContain('exit:2')
    } finally {
      exitSpy.mockRestore()
      process.chdir(cwd)
    }
  })

  it('exits with PRECHECK_FAILED when worktree is dirty', async () => {
    const cwd = process.cwd()
    const repo = temporaryDirectory()
    await initRepo(repo)
    // Make repo dirty
    writeFileSync(join(repo, 'untracked.txt'), 'x')

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`)
    }) as unknown as (code?: number) => never)

    try {
      process.chdir(repo)
      const llm = new SequenceLlm(['ok'])
      await createCommand('desc', llm)
      throw new Error('should have exited')
    } catch (e) {
      // PRECHECK_FAILED = 3
      expect(String(e)).toContain('exit:3')
    } finally {
      exitSpy.mockRestore()
      process.chdir(cwd)
    }
  })
})

