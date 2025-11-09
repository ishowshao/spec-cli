import { describe, it, expect, vi } from 'vitest'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { temporaryDirectory } from 'tempy'
import { execa } from 'execa'

vi.mock('node:fs/promises', () => {
  return {
    readdir: async () => { throw 'not-an-error-object' },
  }
})

describe('listCommand unknown error branch (non-Error thrown)', () => {
  it('exits with UNKNOWN_ERROR (1)', async () => {
    const repo = temporaryDirectory()
    await execa('git', ['init'], { cwd: repo })
    writeFileSync(
      join(repo, 'spec.config.json'),
      JSON.stringify({ schemaVersion: 1, docsDir: 'docs', docTemplates: [], scaffoldPaths: [], branchFormat: 'feature-{slug}', defaultMergeTarget: 'main' }, null, 2)
    )

    const { listCommand } = await import('../src/commands/list.ts')

    const cwd = process.cwd()
    process.chdir(repo)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`)
    }) as unknown as (code?: number) => never)
    try {
      await listCommand()
      throw new Error('should have exited')
    } catch (e) {
      expect(String(e)).toContain('exit:1')
    } finally {
      exitSpy.mockRestore()
      process.chdir(cwd)
    }
  })
})
