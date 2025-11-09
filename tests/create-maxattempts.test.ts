import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { temporaryDirectory } from 'tempy'
import { describe, it, expect, vi } from 'vitest'
import { execa } from 'execa'
import { createCommand } from '../src/commands/create.ts'
import type { LlmClient } from '../src/types.ts'

class RepeatLlm implements LlmClient {
  constructor(private slug: string) {}
  async generateSlug(): Promise<string> { return this.slug }
}

async function initRepo(repo: string) {
  await execa('git', ['init'], { cwd: repo })
  await execa('git', ['config', 'user.name', 'test'], { cwd: repo })
  await execa('git', ['config', 'user.email', 'test@example.com'], { cwd: repo })
  const config = {
    schemaVersion: 1,
    docsDir: 'docs',
    docTemplates: [],
    scaffoldPaths: [],
    branchFormat: 'feature-{slug}',
    defaultMergeTarget: 'main',
  }
  writeFileSync(join(repo, 'spec.config.json'), JSON.stringify(config, null, 2))
  // commit to keep worktree clean and allow creating named branches
  writeFileSync(join(repo, 'README.md'), '# demo')
  await execa('git', ['add', 'README.md', 'spec.config.json'], { cwd: repo })
  await execa('git', ['commit', '-m', 'chore: init'], { cwd: repo })
}

describe('createCommand max attempts path', () => {
  it('exits with LLM_ERROR when cannot generate unique slug after attempts', async () => {
    const repo = temporaryDirectory()
    await initRepo(repo)
    // pre-create branch so branchExists returns true for candidate
    await execa('git', ['branch', 'feature-taken'], { cwd: repo })
    const cwd = process.cwd()
    process.chdir(repo)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`)
    }) as unknown as (code?: number) => never)
    try {
      const llm = new RepeatLlm('taken')
      await createCommand('desc', llm)
      throw new Error('should have exited')
    } catch (e) {
      // LLM_ERROR = 4; also covers the throw at line 86
      expect(String(e)).toContain('exit:4')
    } finally {
      exitSpy.mockRestore()
      process.chdir(cwd)
    }
  })
})
