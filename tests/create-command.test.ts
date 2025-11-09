import { existsSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { temporaryDirectory } from 'tempy'
import { describe, it, expect } from 'vitest'
import { execa } from 'execa'
import { createCommand } from '../src/commands/create.ts'
import type { LlmClient } from '../src/types.ts'

class FakeLlmClient implements LlmClient {
    constructor(private slug = 'demo-feature') {}
    async generateSlug(): Promise<string> {
        return this.slug
    }
}

async function initRepoWithConfig(repo: string) {
    await execa('git', ['init'], { cwd: repo })
    await execa('git', ['config', 'user.name', 'test'], { cwd: repo })
    await execa('git', ['config', 'user.email', 'test@example.com'], { cwd: repo })

    // write minimal valid config and commit to keep worktree clean
    const config = {
        schemaVersion: 1,
        docsDir: 'docs',
        docTemplates: ['requirements.md', 'tech-spec.md'],
        scaffoldPaths: ['tests/{slug}.test.ts', 'e2e/{slug}/'],
        branchFormat: 'feature-{slug}',
        defaultMergeTarget: 'main',
    }
    writeFileSync(join(repo, 'spec.config.json'), JSON.stringify(config, null, 2))
    await execa('git', ['add', 'spec.config.json'], { cwd: repo })
    await execa('git', ['commit', '-m', 'chore: add config'], { cwd: repo })
}

describe('commands/create (E2E minimal path)', () => {
    it('creates branch, docs, scaffold, and commit using injected LLM', async () => {
        const cwd = process.cwd()
        const repo = temporaryDirectory()
        await initRepoWithConfig(repo)

        try {
            process.chdir(repo)
            const llm = new FakeLlmClient('demo-feature')

            await createCommand('Add user authentication', llm)

            // current branch
            const { stdout: branch } = await execa('git', ['branch', '--show-current'], { cwd: repo })
            expect(branch.trim()).toBe('feature-demo-feature')

            // files and directories
            expect(existsSync(join(repo, 'docs', 'demo-feature', 'requirements.md'))).toBe(true)
            expect(existsSync(join(repo, 'docs', 'demo-feature', 'tech-spec.md'))).toBe(true)
            expect(existsSync(join(repo, 'tests', 'demo-feature.test.ts'))).toBe(true)
            expect(statSync(join(repo, 'e2e', 'demo-feature')).isDirectory()).toBe(true)

            // commit message
            const { stdout: msg } = await execa('git', ['log', '-1', '--pretty=%B'], { cwd: repo })
            expect(msg.trim()).toBe('feat(demo-feature): scaffold feature structure')

            // worktree clean
            const { stdout: status } = await execa('git', ['status', '--porcelain'], { cwd: repo })
            expect(status.trim()).toBe('')
        } finally {
            process.chdir(cwd)
        }
    })
})
