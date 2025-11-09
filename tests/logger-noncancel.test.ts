import { describe, it, expect, vi } from 'vitest'

vi.mock('@clack/prompts', () => {
  const cancel = vi.fn()
  const spinnerObj = { start: vi.fn(), stop: vi.fn(), message: vi.fn() }
  return {
    isCancel: () => false,
    cancel,
    log: { info: vi.fn(), success: vi.fn(), error: vi.fn(), warn: vi.fn() },
    spinner: () => spinnerObj,
  }
})

import { handleCancel, logger } from '../src/core/logger.ts'

describe('handleCancel when value is not cancel', () => {
  it('does not exit the process', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`)
    }) as unknown as (code?: number) => never)
    try {
      // Should be a no-op
      handleCancel('not-cancel')
      expect(exitSpy).not.toHaveBeenCalled()
    } finally {
      exitSpy.mockRestore()
    }
  })
})

describe('logger.step returns spinner', () => {
  it('returns a spinner-like object', () => {
    const s = logger.step('doing')
    expect(s && typeof s.start).toBe('function')
    expect(s && typeof s.stop).toBe('function')
  })
})

