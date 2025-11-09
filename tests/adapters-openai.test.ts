import { it, expect, vi, beforeEach, afterEach } from 'vitest'

// Shared state for the mock to control behavior
type ModelOptions = { [key: string]: unknown; configuration?: { baseURL?: string } }
let invokeImpl: (args: unknown[]) => Promise<{ content: string }>
let constructedOptions: ModelOptions[] = []

vi.mock('@langchain/openai', () => {
  class ChatOpenAI {
    static lastOptions: ModelOptions
    constructor(opts: ModelOptions) {
      constructedOptions.push(opts)
      ChatOpenAI.lastOptions = opts
    }
    async invoke(args: unknown[]) {
      return invokeImpl(args)
    }
  }
  return { ChatOpenAI }
})

const saveEnv = { ...process.env }

beforeEach(() => {
  vi.resetModules()
  constructedOptions = []
  invokeImpl = async () => ({ content: 'simple-slug' })
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
    temperature: 0,
  })
  // baseURL is nested under configuration when provided
  expect(constructedOptions[0]?.configuration?.baseURL).toBe('https://example.com')
})

it('retries on duplicate slug and succeeds on second attempt', async () => {
  process.env.OPENAI_API_KEY = 'test'
  process.env.SPEC_LLM_MAX_ATTEMPTS = '2'
  let calls = 0
  invokeImpl = async () => {
    calls++
    return { content: calls === 1 ? 'dup-slug' : 'unique-slug' }
  }

  const { OpenAILlmClient } = await import('../src/adapters/llm/openai.ts')
  const llm = new OpenAILlmClient()
  const slug = await llm.generateSlug('desc', ['dup-slug'])
  expect(slug).toBe('unique-slug')
})

it('fails when model returns invalid slug after max attempts', async () => {
  process.env.OPENAI_API_KEY = 'test'
  process.env.SPEC_LLM_MAX_ATTEMPTS = '1'
  invokeImpl = async () => ({ content: 'Invalid Slug' })

  const { OpenAILlmClient } = await import('../src/adapters/llm/openai.ts')
  const llm = new OpenAILlmClient()
  await expect(llm.generateSlug('desc', [])).rejects.toThrow(/Failed to generate valid slug/)
})

it('fails when slug is too long', async () => {
  process.env.OPENAI_API_KEY = 'test'
  process.env.SPEC_LLM_MAX_ATTEMPTS = '1'
  invokeImpl = async () => ({ content: 'a'.repeat(51) })

  const { OpenAILlmClient } = await import('../src/adapters/llm/openai.ts')
  const llm = new OpenAILlmClient()
  await expect(llm.generateSlug('desc', [])).rejects.toThrow(/Too long/)
})
