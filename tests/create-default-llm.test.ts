import { existsSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { temporaryDirectory } from 'tempy'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execa } from 'execa'

// Mock OpenAI runtime used by our LLM adapter
type ModelOptions = { [key: string]: unknown }
let invokeImpl: (args: unknown[]) => Promise<{ content: string }>

vi.mock('@langchain/openai', () => {
  class ChatOpenAI {
    // avoid no-useless-constructor by adding side-effect
    private readonly opts: ModelOptions
    constructor(opts: ModelOptions) { this.opts = opts }
    async invoke(args: unknown[]) { return invokeImpl(args) }
  }
  return { ChatOpenAI }
})

const saveEnv = { ...process.env }

beforeEach(() => {
  vi.resetModules()
  process.env = { ...saveEnv, OPENAI_API_KEY: 'test-key' }
  invokeImpl = async () => ({ content: 'def-slug' })
})

afterEach(() => {
  process.env = { ...saveEnv }
})

async function initRepo(repo: string) {
  await execa('git', ['init'], { cwd: repo })
  await execa('git', ['config', 'user.name', 'test'], { cwd: repo })
  await execa('git', ['config', 'user.email', 'test@example.com'], { cwd: repo })
  writeFileSync(join(repo, 'spec.config.json'), JSON.stringify({
    schemaVersion: 1,
    docsDir: 'docs',
    docTemplates: ['requirements.md'],
    scaffoldPaths: ['tests/{slug}.test.ts'],
    branchFormat: 'feature-{slug}',
    defaultMergeTarget: 'main',
  }, null, 2))
  // commit to keep clean
  writeFileSync(join(repo, 'README.md'), '# demo')
  await execa('git', ['add', 'README.md', 'spec.config.json'], { cwd: repo })
  await execa('git', ['commit', '-m', 'chore: init'], { cwd: repo })
}

describe('createCommand default LLM path (no injection)', () => {
  it('uses OpenAILlmClient and completes successfully', async () => {
    const repo = temporaryDirectory()
    await initRepo(repo)
    const cwd = process.cwd()
    process.chdir(repo)
    const { createCommand } = await import('../src/commands/create.ts')
    try {
      await createCommand('desc')
      const { stdout: branch } = await execa('git', ['branch', '--show-current'], { cwd: repo })
      expect(branch.trim()).toMatch('feature-def-slug')
      expect(existsSync(join(repo, 'docs', 'def-slug', 'requirements.md'))).toBe(true)
      expect(existsSync(join(repo, 'tests', 'def-slug.test.ts'))).toBe(true)
      expect(statSync(join(repo, 'docs', 'def-slug')).isDirectory()).toBe(true)
    } finally {
      process.chdir(cwd)
    }
  })
})
