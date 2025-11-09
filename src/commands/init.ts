import { existsSync, writeFileSync } from 'node:fs'
import { getConfigPath } from '../core/config.js'
import { getRepoRoot } from '../core/preflight.js'
import { handleCancel } from '../core/logger.js'
import * as p from '@clack/prompts'
import { ConfigSchema } from '../types.js'
import { ExitCodes } from '../types.js'
import { detectTestFrameworks } from '../core/test-detect.js'

// detectTestFrameworks moved to src/core/test-detect.ts

export async function initCommand(): Promise<void> {
    p.intro('Initializing Spec CLI configuration')

    try {
        const repoRoot = await getRepoRoot()
        const configPath = getConfigPath(repoRoot)

        if (existsSync(configPath)) {
            const overwriteResult = await p.confirm({
                message: `${configPath} already exists. Overwrite?`,
                initialValue: false,
            })
            handleCancel(overwriteResult)

            const overwrite = typeof overwriteResult === 'boolean' ? overwriteResult : false

            if (!overwrite) {
                p.cancel('Initialization cancelled.')
                return
            }
        }

        // Detect docs directory
        const docsDirResult = await p.text({
            message: 'Documentation directory',
            initialValue: 'docs',
            placeholder: 'docs',
        })
        handleCancel(docsDirResult)
        const docsDir = typeof docsDirResult === 'string' ? docsDirResult : 'docs'

        // Detect test frameworks
        const testCandidates = await detectTestFrameworks(repoRoot)
        let scaffoldPaths: string[] = []

        if (testCandidates.length > 0) {
            const selected = await p.multiselect({
                message: 'Select scaffold paths (test files)',
                options: testCandidates.map((c) => ({ value: c, label: c })),
            })
            handleCancel(selected)

            if (Array.isArray(selected)) {
                scaffoldPaths = selected
            }
        }

        // Allow manual addition
        const addMoreResult = await p.confirm({
            message: 'Add more scaffold paths manually?',
            initialValue: false,
        })
        handleCancel(addMoreResult)

        const addMore = typeof addMoreResult === 'boolean' ? addMoreResult : false

        if (addMore) {
            let more = true
            while (more) {
                const pathResult = await p.text({
                    message: 'Enter scaffold path template (must include {slug})',
                    placeholder: 'src/features/{slug}/index.ts',
                })
                handleCancel(pathResult)

                if (pathResult && typeof pathResult === 'string') {
                    if (!pathResult.includes('{slug}')) {
                        p.log.warn('Path must include {slug} placeholder')
                    } else {
                        scaffoldPaths.push(pathResult)
                    }
                }

                const moreResult = await p.confirm({
                    message: 'Add another scaffold path?',
                    initialValue: false,
                })
                handleCancel(moreResult)
                more = typeof moreResult === 'boolean' ? moreResult : false
            }
        }

        const branchFormatResult = await p.text({
            message: 'Branch naming format',
            initialValue: 'feature-{slug}',
            placeholder: 'feature-{slug}',
        })
        handleCancel(branchFormatResult)
        const branchFormat = typeof branchFormatResult === 'string' ? branchFormatResult : 'feature-{slug}'

        const defaultMergeTargetResult = await p.text({
            message: 'Default merge target branch',
            initialValue: 'main',
            placeholder: 'main',
        })
        handleCancel(defaultMergeTargetResult)
        const defaultMergeTarget = typeof defaultMergeTargetResult === 'string' ? defaultMergeTargetResult : 'main'

        // Configure doc templates
        const defaultDocTemplates = ['requirements.md', 'tech-spec.md', 'user-stories.md']
        const docTemplatesResult = await p.multiselect({
            message: 'Select document templates',
            options: defaultDocTemplates.map((t) => ({ value: t, label: t })),
            initialValues: defaultDocTemplates,
        })
        handleCancel(docTemplatesResult)

        let docTemplates: string[] = []
        if (Array.isArray(docTemplatesResult)) {
            docTemplates = docTemplatesResult
        } else {
            docTemplates = defaultDocTemplates
        }

        // Allow manual addition/editing of doc templates
        const editDocTemplatesResult = await p.confirm({
            message: 'Add or edit document templates manually?',
            initialValue: false,
        })
        handleCancel(editDocTemplatesResult)

        const editDocTemplates = typeof editDocTemplatesResult === 'boolean' ? editDocTemplatesResult : false

        if (editDocTemplates) {
            let editing = true
            while (editing) {
                const actionResult = await p.select({
                    message: 'Document templates action',
                    options: [
                        { value: 'add', label: 'Add template' },
                        { value: 'remove', label: 'Remove template' },
                        { value: 'done', label: 'Done' },
                    ],
                })
                handleCancel(actionResult)

                if (actionResult === 'add') {
                    const templateResult = await p.text({
                        message: 'Enter template filename (e.g., overview.md)',
                        placeholder: 'overview.md',
                    })
                    handleCancel(templateResult)

                    if (templateResult && typeof templateResult === 'string') {
                        if (!templateResult.endsWith('.md')) {
                            p.log.warn('Template should be a markdown file (.md)')
                        } else if (docTemplates.includes(templateResult)) {
                            p.log.warn(`Template '${templateResult}' already exists`)
                        } else {
                            docTemplates.push(templateResult)
                            p.log.success(`Added template: ${templateResult}`)
                        }
                    }
                } else if (actionResult === 'remove' && docTemplates.length > 0) {
                    const toRemoveResult = await p.select({
                        message: 'Select template to remove',
                        options: docTemplates.map((t) => ({ value: t, label: t })),
                    })
                    handleCancel(toRemoveResult)

                    if (toRemoveResult && typeof toRemoveResult === 'string') {
                        docTemplates = docTemplates.filter((t) => t !== toRemoveResult)
                        p.log.success(`Removed template: ${toRemoveResult}`)
                    }
                } else if (actionResult === 'done') {
                    editing = false
                }
            }
        }

        // Ensure at least one template
        if (docTemplates.length === 0) {
            p.log.warn('No templates selected, using default')
            docTemplates = [...defaultDocTemplates]
        }

        const config = {
            schemaVersion: 1,
            docsDir,
            docTemplates,
            scaffoldPaths,
            branchFormat,
            defaultMergeTarget,
        }

        // Validate config
        const validated = ConfigSchema.parse(config)

        // Write config file
        writeFileSync(configPath, JSON.stringify(validated, null, 2), 'utf-8')

        p.outro(`Configuration saved to ${configPath}`)
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        p.cancel(`Failed to initialize: ${errorMessage}`)
        if (errorMessage.includes('repository')) {
            process.exit(ExitCodes.PRECHECK_FAILED)
        } else if (errorMessage.includes('config') || errorMessage.includes('Configuration')) {
            process.exit(ExitCodes.CONFIG_ERROR)
        } else {
            process.exit(ExitCodes.UNKNOWN_ERROR)
        }
    }
}
