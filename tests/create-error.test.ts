import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { temporaryDirectory } from 'tempy'
import { describe, it, expect, vi } from 'vitest'
import { execa } from 'execa'
import { createCommand } from '../src/commands/create.ts'
import type { LlmClient } from '../src/types.ts'

class FailingLlm implements LlmClient {
  async generateSlug(): Promise<string> {
    throw new Error('LLM exploded')
  }
}

async function setupRepo(repo: string) {
  await execa('git', ['init'], { cwd: repo })
  await execa('git', ['config', 'user.name', 'test'], { cwd: repo })
  await execa('git', ['config', 'user.email', 'test@example.com'], { cwd: repo })
  writeFileSync(join(repo, 'spec.config.json'), JSON.stringify({
    schemaVersion: 1,
    docsDir: 'docs',
    docTemplates: ['requirements.md'],
    scaffoldPaths: [],
    branchFormat: 'feature-{slug}',
    defaultMergeTarget: 'main'
  }, null, 2))
  await execa('git', ['add', 'spec.config.json'], { cwd: repo })
  await execa('git', ['commit', '-m', 'chore: add config'], { cwd: repo })
}

describe('createCommand error handling', () => {
  it('exits with LLM_ERROR on LLM failure', async () => {
    const repo = temporaryDirectory()
    await setupRepo(repo)
    const cwd = process.cwd()
    process.chdir(repo)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`)
    }) as unknown as (code?: number) => never)
    try {
      await createCommand('anything', new FailingLlm())
      throw new Error('should have exited')
    } catch (e) {
      expect(String(e)).toContain('exit:4')
    } finally {
      exitSpy.mockRestore()
      process.chdir(cwd)
    }
  })
})
