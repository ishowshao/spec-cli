import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { loadConfig } from '../core/config.js'
import { getRepoRoot } from '../core/preflight.js'
import { logger } from '../core/logger.js'
import { ExitCodes } from '../types.js'

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export async function listCommand(): Promise<void> {
    try {
        const repoRoot = await getRepoRoot()
        const config = loadConfig(repoRoot)

        const docsDir = join(repoRoot, config.docsDir)

        try {
            const entries = await readdir(docsDir, { withFileTypes: true })
            const slugs = entries
                .filter((entry) => entry.isDirectory() && SLUG_REGEX.test(entry.name))
                .map((entry) => entry.name)
                .sort()

            slugs.forEach((slug) => {
                console.log(slug)
            })
        } catch (error: unknown) {
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
                // Docs directory doesn't exist, no features yet
                return
            }
            throw error
        }
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        logger.error(`Failed to list features: ${errorMessage}`)
        if (errorMessage.includes('config') || errorMessage.includes('Configuration')) {
            process.exit(ExitCodes.CONFIG_ERROR)
        } else if (errorMessage.includes('repository')) {
            process.exit(ExitCodes.PRECHECK_FAILED)
        } else {
            process.exit(ExitCodes.UNKNOWN_ERROR)
        }
    }
}
