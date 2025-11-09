import { temporaryDirectory } from 'tempy'
import { describe, it, expect, vi } from 'vitest'
import { listCommand } from '../src/commands/list.ts'

describe('listCommand outside git repo', () => {
  it('exits with PRECHECK_FAILED when not in git repo', async () => {
    const dir = temporaryDirectory()
    const cwd = process.cwd()
    process.chdir(dir)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`)
    }) as unknown as (code?: number) => never)
    try {
      await listCommand()
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

