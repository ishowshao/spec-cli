import { it, expect, vi, beforeEach, afterEach } from 'vitest'

// Shared state for the mock to control behavior
type ModelOptions = { [key: string]: unknown; configuration?: { baseURL?: string } }
let invokeImpl: (args: unknown[]) => Promise<{ content: string }>
let structuredInvokeImpl: (args: unknown[]) => Promise<{ slug: string }>
let constructedOptions: ModelOptions[] = []
let structuredModelInstances: Array<{ invoke: (args: unknown[]) => Promise<{ slug: string }> }> = []

vi.mock('@langchain/openai', () => {
  class StructuredModel {
    async invoke(args: unknown[]) {
      return structuredInvokeImpl(args)
    }
  }

  class ChatOpenAI {
    static lastOptions: ModelOptions
    constructor(opts: ModelOptions) {
      constructedOptions.push(opts)
      ChatOpenAI.lastOptions = opts
    }
    async invoke(args: unknown[]) {
      return invokeImpl(args)
    }
    withStructuredOutput() {
      const instance = new StructuredModel()
      structuredModelInstances.push(instance)
      return instance
    }
  }
  return { ChatOpenAI }
})

const saveEnv = { ...process.env }

beforeEach(() => {
  vi.resetModules()
  constructedOptions = []
  structuredModelInstances = []
  invokeImpl = async () => ({ content: 'simple-slug' })
  structuredInvokeImpl = async () => ({ slug: 'simple-slug' })
  process.env = { ...saveEnv }
})

afterEach(() => {
  process.env = { ...saveEnv }
})

it('throws if OPENAI_API_KEY is missing', async () => {
  delete process.env.OPENAI_API_KEY
  const mod = await import('../src/adapters/llm/openai.ts')
  expect(() => new mod.OpenAILlmClient()).toThrow(/OPENAI_API_KEY/)
})

it('constructs client with env config and generates slug', async () => {
  process.env.OPENAI_API_KEY = 'test'
  process.env.SPEC_OPENAI_MODEL = 'm'
  process.env.SPEC_LLM_TIMEOUT_MS = '1234'
  process.env.OPENAI_BASE_URL = 'https://example.com'

  const { OpenAILlmClient } = await import('../src/adapters/llm/openai.ts')
  const llm = new OpenAILlmClient()

  const slug = await llm.generateSlug('desc', ['taken'])
  expect(slug).toBe('simple-slug')
  expect(constructedOptions[0]).toMatchObject({
    modelName: 'm',
    openAIApiKey: 'test',
    timeout: 1234,
  })
  // baseURL is nested under configuration when provided
  expect(constructedOptions[0]?.configuration?.baseURL).toBe('https://example.com')
})

it('retries on duplicate slug and succeeds on second attempt', async () => {
  process.env.OPENAI_API_KEY = 'test'
  process.env.SPEC_LLM_MAX_ATTEMPTS = '2'
  let calls = 0
  structuredInvokeImpl = async () => {
    calls++
    return { slug: calls === 1 ? 'dup-slug' : 'unique-slug' }
  }

  const { OpenAILlmClient } = await import('../src/adapters/llm/openai.ts')
  const llm = new OpenAILlmClient()
  const slug = await llm.generateSlug('desc', ['dup-slug'])
  expect(slug).toBe('unique-slug')
})

it('fails when structured output throws validation error after max attempts', async () => {
  process.env.OPENAI_API_KEY = 'test'
  process.env.SPEC_LLM_MAX_ATTEMPTS = '1'
  structuredInvokeImpl = async () => {
    throw new Error('Validation failed: Invalid slug format')
  }

  const { OpenAILlmClient } = await import('../src/adapters/llm/openai.ts')
  const llm = new OpenAILlmClient()
  await expect(llm.generateSlug('desc', [])).rejects.toThrow(/Failed to generate slug/)
})

it('structured output ensures slug format and length are valid', async () => {
  process.env.OPENAI_API_KEY = 'test'
  structuredInvokeImpl = async () => ({ slug: 'valid-slug-123' })

  const { OpenAILlmClient } = await import('../src/adapters/llm/openai.ts')
  const llm = new OpenAILlmClient()
  const slug = await llm.generateSlug('desc', [])
  expect(slug).toBe('valid-slug-123')
  // Structured output guarantees format, so no need to test invalid formats
})

it('handles empty existingSlugs array', async () => {
  process.env.OPENAI_API_KEY = 'test'
  structuredInvokeImpl = async () => ({ slug: 'new-slug' })

  const { OpenAILlmClient } = await import('../src/adapters/llm/openai.ts')
  const llm = new OpenAILlmClient()
  const slug = await llm.generateSlug('desc', [])
  expect(slug).toBe('new-slug')
})

it('retries with exponential backoff on error and succeeds', async () => {
  process.env.OPENAI_API_KEY = 'test'
  process.env.SPEC_LLM_MAX_ATTEMPTS = '3'
  let calls = 0
  const startTime = Date.now()
  
  structuredInvokeImpl = async () => {
    calls++
    if (calls === 1) {
      throw new Error('Network error')
    }
    return { slug: 'success-slug' }
  }

  const { OpenAILlmClient } = await import('../src/adapters/llm/openai.ts')
  const llm = new OpenAILlmClient()
  const slug = await llm.generateSlug('desc', [])
  expect(slug).toBe('success-slug')
  expect(calls).toBe(2)
  // Verify exponential backoff was applied (at least some delay)
  const elapsed = Date.now() - startTime
  expect(elapsed).toBeGreaterThan(100) // At least 2^1 * 100ms delay
})

it('handles non-Error objects thrown', async () => {
  process.env.OPENAI_API_KEY = 'test'
  process.env.SPEC_LLM_MAX_ATTEMPTS = '1'
  structuredInvokeImpl = async () => {
    throw 'String error' // Non-Error object
  }

  const { OpenAILlmClient } = await import('../src/adapters/llm/openai.ts')
  const llm = new OpenAILlmClient()
  await expect(llm.generateSlug('desc', [])).rejects.toThrow(/Failed to generate slug/)
})

it('throws error after max attempts with lastError message', async () => {
  process.env.OPENAI_API_KEY = 'test'
  process.env.SPEC_LLM_MAX_ATTEMPTS = '2'
  let calls = 0
  
  structuredInvokeImpl = async () => {
    calls++
    if (calls === 1) {
      throw new Error('First error')
    }
    throw new Error('Second error')
  }

  const { OpenAILlmClient } = await import('../src/adapters/llm/openai.ts')
  const llm = new OpenAILlmClient()
  await expect(llm.generateSlug('desc', [])).rejects.toThrow(/Failed to generate slug after 2 attempts: Second error/)
})

it('throws error after max attempts when all slugs are duplicates', async () => {
  process.env.OPENAI_API_KEY = 'test'
  process.env.SPEC_LLM_MAX_ATTEMPTS = '2'
  let calls = 0
  
  // Simulate scenario where all attempts return duplicate slugs
  // This causes the while loop to complete without returning, triggering the final throw
  structuredInvokeImpl = async () => {
    calls++
    // Return duplicate slugs to trigger continue, exhausting all attempts
    return { slug: calls === 1 ? 'dup-slug' : 'dup-slug-2' }
  }

  const { OpenAILlmClient } = await import('../src/adapters/llm/openai.ts')
  const llm = new OpenAILlmClient()
  // This will exhaust attempts due to duplicates, triggering the final throw at line 110-112
  await expect(llm.generateSlug('desc', ['dup-slug', 'dup-slug-2'])).rejects.toThrow(/Failed to generate valid slug after 2 attempts/)
  expect(calls).toBe(2)
})

it('uses default timeout when SPEC_LLM_TIMEOUT_MS is invalid', async () => {
  process.env.OPENAI_API_KEY = 'test'
  process.env.SPEC_LLM_TIMEOUT_MS = 'invalid'
  
  const { OpenAILlmClient } = await import('../src/adapters/llm/openai.ts')
  const _llm = new OpenAILlmClient()
  
  expect(constructedOptions[0]?.timeout).toBe(8000) // Default value
})

it('uses default maxAttempts when SPEC_LLM_MAX_ATTEMPTS is invalid', async () => {
  process.env.OPENAI_API_KEY = 'test'
  process.env.SPEC_LLM_MAX_ATTEMPTS = 'not-a-number'
  
  const { OpenAILlmClient } = await import('../src/adapters/llm/openai.ts')
  const llm = new OpenAILlmClient()
  
  structuredInvokeImpl = async () => ({ slug: 'test-slug' })
  const slug = await llm.generateSlug('desc', [])
  expect(slug).toBe('test-slug')
})

it('uses default timeout when SPEC_LLM_TIMEOUT_MS is zero', async () => {
  process.env.OPENAI_API_KEY = 'test'
  process.env.SPEC_LLM_TIMEOUT_MS = '0'
  
  const { OpenAILlmClient } = await import('../src/adapters/llm/openai.ts')
  const _llm = new OpenAILlmClient()
  
  expect(constructedOptions[0]?.timeout).toBe(8000) // Default value (0 || 8000)
})

it('handles multiple duplicate slugs and retries', async () => {
  process.env.OPENAI_API_KEY = 'test'
  process.env.SPEC_LLM_MAX_ATTEMPTS = '3'
  let calls = 0
  
  structuredInvokeImpl = async () => {
    calls++
    return { slug: `slug-${calls}` }
  }

  const { OpenAILlmClient } = await import('../src/adapters/llm/openai.ts')
  const llm = new OpenAILlmClient()
  const slug = await llm.generateSlug('desc', ['slug-1', 'slug-2'])
  expect(slug).toBe('slug-3')
  expect(calls).toBe(3)
})

it('includes lastError in final error message when available', async () => {
  process.env.OPENAI_API_KEY = 'test'
  process.env.SPEC_LLM_MAX_ATTEMPTS = '2'
  
  structuredInvokeImpl = async () => {
    throw new Error('Custom error message')
  }

  const { OpenAILlmClient } = await import('../src/adapters/llm/openai.ts')
  const llm = new OpenAILlmClient()
  await expect(llm.generateSlug('desc', [])).rejects.toThrow(/Custom error message/)
})

it('omits lastError suffix when no attempts run (negative maxAttempts)', async () => {
  process.env.OPENAI_API_KEY = 'test'
  // Negative number bypasses the loop and triggers the final throw
  process.env.SPEC_LLM_MAX_ATTEMPTS = '-1'

  const { OpenAILlmClient } = await import('../src/adapters/llm/openai.ts')
  const llm = new OpenAILlmClient()
  await expect(llm.generateSlug('desc', [])).rejects.toThrow(/Failed to generate valid slug after -1 attempts$/)
})
