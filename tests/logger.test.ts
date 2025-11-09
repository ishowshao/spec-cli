import { describe, it, expect, vi } from 'vitest'
import { logger } from '../src/core/logger.ts'

describe('core/logger', () => {
  it('emits log messages and verbose when enabled', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    logger.info('info')
    logger.success('ok')
    logger.warn('warn')
    logger.error('err')
    logger.verbose('hello', true)
    logger.verbose('nope', false)
    expect(spy).toHaveBeenCalledWith('[verbose] hello')
    spy.mockRestore()
  })
})

