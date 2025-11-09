import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { temporaryDirectory } from 'tempy'
import { describe, it, expect } from 'vitest'
import { validateScaffoldPaths, checkFeatureExists } from '../src/core/preflight.ts'

describe('core/preflight path validation', () => {
    it('flags absolute and outside paths and existing conflicts', () => {
        const repo = temporaryDirectory()
        const slug = 'abc'

        // existing file
        const existingPath = join(repo, 'tests', `${slug}.test.ts`)
        mkdirSync(join(repo, 'tests'), { recursive: true })
        writeFileSync(existingPath, '')

        const { valid, conflicts } = validateScaffoldPaths(repo, [
            'tests/{slug}.test.ts',
            '../outside/{slug}',
            '/abs/{slug}.spec.ts',
        ], slug)

        expect(valid).toBe(false)
        expect(conflicts).toContain('tests/abc.test.ts')
        expect(conflicts).toContain('../outside/abc')
        expect(conflicts).toContain('/abs/abc.spec.ts')
    })
})

describe('core/preflight feature existence', () => {
    it('detects existing feature docs directory', () => {
        const repo = temporaryDirectory()
        const config = {
            schemaVersion: 1,
            docsDir: 'docs',
            docTemplates: [],
            scaffoldPaths: [],
            branchFormat: 'feature-{slug}',
            defaultMergeTarget: 'main',
        }
        const slug = 'my-feature'
        mkdirSync(join(repo, config.docsDir, slug), { recursive: true })
        expect(checkFeatureExists(repo, config, slug)).toBe(true)
        expect(checkFeatureExists(repo, config, 'other')).toBe(false)
    })
})

