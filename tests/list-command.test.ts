import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { temporaryDirectory } from 'tempy'
import { describe, it, expect, vi } from 'vitest'
import { execa } from 'execa'
import { listCommand } from '../src/commands/list.ts'

describe('commands/list', () => {
    it('prints slugs in ASCII ascending order', async () => {
        const cwd = process.cwd()
        const repo = temporaryDirectory()

        try {
            // init git repo so getRepoRoot works
            await execa('git', ['init'], { cwd: repo })
            // minimal config file
            writeFileSync(
                join(repo, 'spec.config.json'),
                JSON.stringify({ schemaVersion: 1, docsDir: 'docs', docTemplates: [], branchFormat: 'feature-{slug}', defaultMergeTarget: 'main' }, null, 2)
            )

            // create docs with slugs
            const docs = join(repo, 'docs')
            mkdirSync(join(docs, 'z-end'), { recursive: true })
            mkdirSync(join(docs, 'alpha'), { recursive: true })
            mkdirSync(join(docs, 'm-1'), { recursive: true })
            // non-slug directory should be ignored
            mkdirSync(join(docs, 'NotSlug'), { recursive: true })

            process.chdir(repo)

            const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
            await listCommand()
            const calls = spy.mock.calls.map((args) => String(args[0]))
            spy.mockRestore()

            expect(calls).toEqual(['alpha', 'm-1', 'z-end'])
        } finally {
            process.chdir(cwd)
        }
    })
})

