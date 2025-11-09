import { describe, it, expect, vi } from 'vitest'
import { temporaryDirectory } from 'tempy'
import { execa } from 'execa'
import { listCommand } from '../src/commands/list.ts'

describe('listCommand missing config file', () => {
  it('exits with CONFIG_ERROR (2) when spec.config.json is absent', async () => {
    const repo = temporaryDirectory()
    await execa('git', ['init'], { cwd: repo })
    const cwd = process.cwd()
    process.chdir(repo)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`)
    }) as unknown as (code?: number) => never)
    try {
      await listCommand()
      throw new Error('should have exited')
    } catch (e) {
      expect(String(e)).toContain('exit:2')
    } finally {
      exitSpy.mockRestore()
      process.chdir(cwd)
    }
  })
})

