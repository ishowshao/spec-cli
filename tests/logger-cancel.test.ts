import { describe, it, expect, vi } from 'vitest'

vi.mock('@clack/prompts', () => {
  const cancel = vi.fn()
  return {
    isCancel: () => true,
    cancel,
    log: { info: vi.fn(), success: vi.fn(), error: vi.fn(), warn: vi.fn() },
    spinner: () => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() }),
  }
})

import { handleCancel } from '../src/core/logger.ts'

describe('handleCancel', () => {
  it('calls cancel and exits when value is cancel', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`)
    }) as unknown as (code?: number) => never)
    try {
      handleCancel(Symbol('cancel'))
      throw new Error('should have exited')
    } catch (e) {
      expect(String(e)).toContain('exit:1')
    } finally {
      exitSpy.mockRestore()
    }
  })
})

