import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { temporaryDirectory } from 'tempy'
import { describe, it, expect } from 'vitest'
import { loadConfig, getConfigPath } from '../src/core/config.ts'

describe('core/config loadConfig', () => {
    it('loads a valid config', () => {
        const dir = temporaryDirectory()
        const config = {
            schemaVersion: 1,
            docsDir: 'docs',
            docTemplates: ['requirements.md', 'tech-spec.md'],
            scaffoldPaths: ['tests/{slug}.test.ts'],
            branchFormat: 'feature-{slug}',
            defaultMergeTarget: 'main',
        }
        mkdirSync(join(dir, 'docs'), { recursive: true })
        writeFileSync(join(dir, 'spec.config.json'), JSON.stringify(config, null, 2))

        const loaded = loadConfig(dir)
        expect(loaded.docsDir).toBe('docs')
        expect(loaded.docTemplates).toEqual(['requirements.md', 'tech-spec.md'])
        expect(loaded.scaffoldPaths).toEqual(['tests/{slug}.test.ts'])
        expect(loaded.branchFormat).toBe('feature-{slug}')
        expect(loaded.defaultMergeTarget).toBe('main')
    })

    it('throws on invalid scaffoldPaths', () => {
        const dir = temporaryDirectory()
        const bad = {
            schemaVersion: 1,
            docsDir: 'docs',
            docTemplates: ['requirements.md'],
            scaffoldPaths: ['/abs/{slug}.test.ts'],
            branchFormat: 'feature-{slug}',
            defaultMergeTarget: 'main',
        }
        writeFileSync(join(dir, 'spec.config.json'), JSON.stringify(bad, null, 2))

        expect(() => loadConfig(dir)).toThrow(/Invalid configuration/i)
    })

    it('throws when config file missing', () => {
        const dir = temporaryDirectory()
        expect(() => loadConfig(dir)).toThrow(/Configuration file not found/i)
    })

    it('throws "Failed to load configuration" when JSON is invalid', () => {
        const dir = temporaryDirectory()
        // write invalid JSON
        writeFileSync(join(dir, 'spec.config.json'), '{ not: valid', 'utf-8')
        expect(() => loadConfig(dir)).toThrow(/Failed to load configuration/i)
    })

    it('getConfigPath returns absolute config path', () => {
        const dir = temporaryDirectory()
        expect(getConfigPath(dir)).toBe(join(dir, 'spec.config.json'))
    })
})
