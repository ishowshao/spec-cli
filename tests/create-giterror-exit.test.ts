import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { temporaryDirectory } from 'tempy'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { execa } from 'execa'
import type { LlmClient } from '../src/types.ts'

// Mock core/git to force a GIT_ERROR mapping via message containing 'branch'
vi.mock('../src/core/git.ts', () => ({
  gitSwitch: async () => { throw new Error('branch operation failed') },
  gitAdd: async () => {},
  gitCommit: async () => 'deadbeef',
}))

class OneSlug implements LlmClient {
  constructor(private slug: string) {}
  async generateSlug(): Promise<string> { return this.slug }
}

async function initRepo(repo: string) {
  await execa('git', ['init'], { cwd: repo })
  await execa('git', ['config', 'user.name', 'test'], { cwd: repo })
  await execa('git', ['config', 'user.email', 'test@example.com'], { cwd: repo })
  writeFileSync(join(repo, 'spec.config.json'), JSON.stringify({
    schemaVersion: 1,
    docsDir: 'docs',
    docTemplates: [],
    scaffoldPaths: [],
    branchFormat: 'feature-{slug}',
    defaultMergeTarget: 'main',
  }, null, 2))
  // keep worktree clean
  writeFileSync(join(repo, 'README.md'), '# demo')
  await execa('git', ['add', 'README.md', 'spec.config.json'], { cwd: repo })
  await execa('git', ['commit', '-m', 'chore: init'], { cwd: repo })
}

let createCommand: (desc: string, llm?: LlmClient) => Promise<void>

beforeEach(async () => {
  vi.resetModules()
  ;({ createCommand } = await import('../src/commands/create.ts'))
})

describe('createCommand maps git errors to GIT_ERROR', () => {
  it('exits with code 5 when gitSwitch throws with branch in message', async () => {
    const repo = temporaryDirectory()
    await initRepo(repo)
    const cwd = process.cwd()
    process.chdir(repo)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`)
    }) as unknown as (code?: number) => never)
    try {
      const llm = new OneSlug('ok')
      await createCommand('desc', llm)
      throw new Error('should have exited')
    } catch (e) {
      expect(String(e)).toContain('exit:5')
    } finally {
      exitSpy.mockRestore()
      process.chdir(cwd)
    }
  })
})
