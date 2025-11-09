import { loadConfig } from '../core/config.js'
import { getRepoRoot, preflightMerge } from '../core/preflight.js'
import { gitSwitch, gitPull, gitMerge, gitPush, getUpstream } from '../core/git.js'
import { logger } from '../core/logger.js'
import { ExitCodes } from '../types.js'
import * as p from '@clack/prompts'

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export async function mergeCommand(featureSlug: string, verbose = false): Promise<void> {
    // Validate slug format
    if (!SLUG_REGEX.test(featureSlug)) {
        p.log.error(`Invalid feature slug format: '${featureSlug}'`)
        p.log.info('Slug must be kebab-case (lowercase letters, numbers, and hyphens)')
        process.exit(ExitCodes.CONFIG_ERROR)
    }

    const spinner = p.spinner()

    try {
        spinner.start('Preparing to merge feature...')

        const repoRoot = await getRepoRoot()
        const config = loadConfig(repoRoot)

        const featureBranch = config.branchFormat.replace('{slug}', featureSlug)
        const targetBranch = config.defaultMergeTarget

        // Preflight checks
        await preflightMerge(repoRoot, featureBranch, targetBranch)

        spinner.message(`Switching to target branch '${targetBranch}'...`)
        if (verbose) {
            logger.verbose(`git switch ${targetBranch}`, true)
        }
        await gitSwitch(repoRoot, targetBranch)

        spinner.message('Pulling latest changes...')
        if (verbose) {
            logger.verbose(`git pull`, true)
        }
        await gitPull(repoRoot, targetBranch)

        spinner.message(`Merging feature branch '${featureBranch}'...`)
        if (verbose) {
            logger.verbose(`git merge --no-ff ${featureBranch}`, true)
        }
        const mergeHash = await gitMerge(repoRoot, featureBranch)

        spinner.message('Pushing changes...')
        if (verbose) {
            logger.verbose(`git push`, true)
        }
        await gitPush(repoRoot)

        spinner.stop('Feature merged successfully!')

        if (mergeHash) {
            p.log.success(`Merge commit: ${mergeHash}`)
        }

        const upstream = await getUpstream(repoRoot, targetBranch)
        if (upstream) {
            p.log.info(`Pushed to: ${upstream}`)
        }

        p.outro(`Feature '${featureSlug}' has been merged to '${targetBranch}'.`)
    } catch (error: any) {
        spinner.stop('Failed to merge feature')

        if (error.code === 'MERGE_FAILED') {
            p.log.error('Merge conflicts detected.')
            p.log.info('Please resolve conflicts manually:')
            p.log.info('  1. Fix conflicts in the affected files')
            p.log.info('  2. Run: git add <resolved-files>')
            p.log.info('  3. Run: git commit')
            p.log.info('  4. Run: git push')
            process.exit(ExitCodes.GIT_ERROR)
        } else if (error.code === 'PULL_FAILED' || error.code === 'PUSH_FAILED') {
            p.log.error(error.message)
            if (error.hint) {
                p.log.info(error.hint)
            }
            process.exit(ExitCodes.GIT_ERROR)
        } else {
            p.log.error(error.message)
            process.exit(ExitCodes.GIT_ERROR)
        }
    }
}
