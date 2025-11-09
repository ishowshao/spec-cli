import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { temporaryDirectory } from 'tempy'
import { describe, it, expect, vi } from 'vitest'
import { execa } from 'execa'
import { listCommand } from '../src/commands/list.ts'

describe('commands/list (empty docs dir)', () => {
  it('prints nothing when docs directory does not exist', async () => {
    const repo = temporaryDirectory()
    await execa('git', ['init'], { cwd: repo })
    writeFileSync(
      join(repo, 'spec.config.json'),
      JSON.stringify({ schemaVersion: 1, docsDir: 'docs', docTemplates: [], branchFormat: 'feature-{slug}', defaultMergeTarget: 'main' }, null, 2)
    )
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const cwd = process.cwd()
    try {
      process.chdir(repo)
      await listCommand()
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
      process.chdir(cwd)
    }
  })
})

