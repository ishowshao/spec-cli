import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { temporaryDirectory } from 'tempy'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { execa } from 'execa'
import type { LlmClient } from '../src/types.ts'

// Mock templates to throw a generic error without special keywords → UNKNOWN_ERROR
vi.mock('../src/core/templates.ts', () => ({
  createFeatureDocs: async () => { throw new Error('mystery oops') },
  createScaffoldPaths: async () => [],
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
    docTemplates: ['requirements.md'],
    scaffoldPaths: [],
    branchFormat: 'feature-{slug}',
    defaultMergeTarget: 'main',
  }, null, 2))
  // initial commit to keep worktree clean
  writeFileSync(join(repo, 'README.md'), '# demo')
  await execa('git', ['add', 'README.md', 'spec.config.json'], { cwd: repo })
  await execa('git', ['commit', '-m', 'chore: init'], { cwd: repo })
}

let createCommand: (desc: string, llm?: LlmClient) => Promise<void>

beforeEach(async () => {
  vi.resetModules()
  ;({ createCommand } = await import('../src/commands/create.ts'))
})

describe('createCommand maps unknown errors to UNKNOWN_ERROR', () => {
  it('exits with code 1 when templates throw non-matching error', async () => {
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
      expect(String(e)).toContain('exit:1')
    } finally {
      exitSpy.mockRestore()
      process.chdir(cwd)
    }
  })
})

