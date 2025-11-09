import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import type { Config } from '../types.js'

export async function createFeatureDocs(repoRoot: string, config: Config, slug: string): Promise<string[]> {
    const docsDir = join(repoRoot, config.docsDir, slug)
    const createdFiles: string[] = []

    // Create docs directory
    await mkdir(docsDir, { recursive: true })

    // Create doc template files
    for (const template of config.docTemplates) {
        const filePath = join(docsDir, template)
        await writeFile(filePath, '', 'utf-8')
        createdFiles.push(filePath)
    }

    return createdFiles
}

export async function createScaffoldPaths(repoRoot: string, scaffoldPaths: string[], slug: string): Promise<string[]> {
    const createdPaths: string[] = []

    for (const template of scaffoldPaths) {
        const expanded = template.replace('{slug}', slug)
        const fullPath = join(repoRoot, expanded)

        if (template.endsWith('/')) {
            // Directory template
            await mkdir(fullPath, { recursive: true })
            createdPaths.push(fullPath)
        } else {
            // File template
            const parentDir = dirname(fullPath)
            await mkdir(parentDir, { recursive: true })
            await writeFile(fullPath, '', 'utf-8')
            createdPaths.push(fullPath)
        }
    }

    return createdPaths
}
