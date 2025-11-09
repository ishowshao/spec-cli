import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { loadConfig } from '../core/config.js'
import {
    getRepoRoot,
    preflightCreate,
    checkFeatureExists,
    validateScaffoldPaths,
    branchExists,
} from '../core/preflight.js'
import { createFeatureDocs, createScaffoldPaths } from '../core/templates.js'
import { gitSwitch, gitAdd, gitCommit } from '../core/git.js'
import { OpenAILlmClient } from '../adapters/llm/openai.js'
import { ExitCodes, type LlmClient } from '../types.js'
import * as p from '@clack/prompts'

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

async function getExistingSlugs(repoRoot: string, config: { docsDir: string }): Promise<string[]> {
    const docsDir = join(repoRoot, config.docsDir)
    try {
        const entries = await readdir(docsDir, { withFileTypes: true })
        return entries
            .filter((entry) => entry.isDirectory() && SLUG_REGEX.test(entry.name))
            .map((entry) => entry.name)
            .sort()
    } catch {
        return []
    }
}

export async function createCommand(description: string, llmClient?: LlmClient): Promise<void> {
    const spinner = p.spinner()

    try {
        spinner.start('Preparing to create feature...')

        // Preflight checks
        const repoRoot = await getRepoRoot()
        await preflightCreate(repoRoot)

        // Load config
        const config = loadConfig(repoRoot)

        spinner.message('Generating feature slug...')

        // Initialize LLM client (allow injection for tests)
        const client: LlmClient = llmClient ?? new OpenAILlmClient()

        // Get existing slugs for uniqueness check
        const existingSlugs = await getExistingSlugs(repoRoot, config)

        // Generate slug with uniqueness checks
        let slug: string | undefined
        let attempts = 0
        const maxAttempts = 5

        while (attempts < maxAttempts && !slug) {
            attempts++
            const candidate = await client.generateSlug(description, existingSlugs)

            // Check feature directory doesn't exist
            if (checkFeatureExists(repoRoot, config, candidate)) {
                existingSlugs.push(candidate)
                continue
            }

            // Check branch doesn't exist
            const branchName = config.branchFormat.replace('{slug}', candidate)
            if (await branchExists(repoRoot, branchName)) {
                existingSlugs.push(candidate)
                continue
            }

            // Check scaffold paths don't conflict
            const validation = validateScaffoldPaths(repoRoot, config.scaffoldPaths, candidate)
            if (!validation.valid) {
                existingSlugs.push(candidate)
                continue
            }

            slug = candidate
        }

        if (!slug) {
            throw new Error('Failed to generate unique slug after multiple attempts')
        }

        spinner.message('Creating feature branch...')

        // Create and switch to feature branch
        const branchName = config.branchFormat.replace('{slug}', slug)
        await gitSwitch(repoRoot, branchName, true)

        spinner.message('Creating documentation structure...')

        // Create docs
        const docFiles = await createFeatureDocs(repoRoot, config, slug)

        spinner.message('Creating scaffold paths...')

        // Create scaffold paths
        const scaffoldFiles = await createScaffoldPaths(repoRoot, config.scaffoldPaths, slug)

        spinner.message('Committing initial structure...')

        // Stage and commit
        const allFiles = [...docFiles, ...scaffoldFiles]
        await gitAdd(repoRoot, allFiles)
        const commitMessage = `feat(${slug}): scaffold feature structure`
        await gitCommit(repoRoot, commitMessage)

        spinner.stop('Feature created successfully!')

        p.log.success(`Feature slug: ${slug}`)
        p.log.success(`Branch: ${branchName}`)
        p.log.info(`Created ${String(docFiles.length)} documentation files`)
        p.log.info(`Created ${String(scaffoldFiles.length)} scaffold paths`)

        p.outro('You can now start developing your feature.')
    } catch (error: unknown) {
        spinner.stop('Failed to create feature')
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        p.log.error(errorMessage)

        // Determine exit code based on error type
        if (errorMessage.includes('SPEC_OPENAI_API_KEY') || errorMessage.includes('LLM') || errorMessage.includes('slug')) {
            process.exit(ExitCodes.LLM_ERROR)
        } else if (errorMessage.includes('config') || errorMessage.includes('Configuration')) {
            process.exit(ExitCodes.CONFIG_ERROR)
        } else if (
            errorMessage.includes('Git') ||
            errorMessage.includes('branch') ||
            errorMessage.includes('working tree')
        ) {
            process.exit(ExitCodes.GIT_ERROR)
        } else if (errorMessage.includes('repository') || errorMessage.includes('clean')) {
            process.exit(ExitCodes.PRECHECK_FAILED)
        } else {
            process.exit(ExitCodes.UNKNOWN_ERROR)
        }
    }
}
