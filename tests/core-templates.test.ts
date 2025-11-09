import { statSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { temporaryDirectory } from 'tempy'
import { describe, it, expect } from 'vitest'
import { createFeatureDocs, createScaffoldPaths } from '../src/core/templates.ts'

describe('core/templates creation', () => {
    it('creates docs and scaffold paths', async () => {
        const repo = temporaryDirectory()
        const config = {
            schemaVersion: 1,
            docsDir: 'docs',
            docTemplates: ['a.md', 'b.md'],
            scaffoldPaths: [],
            branchFormat: 'feature-{slug}',
            defaultMergeTarget: 'main',
        }
        const slug = 'demo-feature'

        const docs = await createFeatureDocs(repo, config, slug)
        expect(docs.length).toBe(2)
        const [a, b] = docs
        expect(readFileSync(a, 'utf8')).toBe('')
        expect(readFileSync(b, 'utf8')).toBe('')

        const created = await createScaffoldPaths(
            repo,
            ['tests/{slug}.test.ts', 'e2e/{slug}/'],
            slug
        )
        expect(created.length).toBe(2)
        const filePath = join(repo, 'tests', `${slug}.test.ts`)
        const dirPath = join(repo, 'e2e', slug)
        expect(readFileSync(filePath, 'utf8')).toBe('')
        expect(statSync(dirPath).isDirectory()).toBe(true)
    })
})

