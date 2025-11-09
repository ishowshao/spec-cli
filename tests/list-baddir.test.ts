import { describe, it, expect, vi } from 'vitest'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { temporaryDirectory } from 'tempy'
import { execa } from 'execa'
import { listCommand } from '../src/commands/list.ts'

describe('listCommand unknown error from readdir (non-ENOENT)', () => {
  it('exits with UNKNOWN_ERROR (1) when docsDir is not a directory', async () => {
    const repo = temporaryDirectory()
    await execa('git', ['init'], { cwd: repo })
    // write config where docsDir points to a file
    const config = {
      schemaVersion: 1,
      docsDir: 'docs',
      docTemplates: [],
      scaffoldPaths: [],
      branchFormat: 'feature-{slug}',
      defaultMergeTarget: 'main',
    }
    writeFileSync(join(repo, 'spec.config.json'), JSON.stringify(config, null, 2))
    // create a file at docs path
    writeFileSync(join(repo, 'docs'), 'not a dir')

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

