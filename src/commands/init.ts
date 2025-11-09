import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { getConfigPath } from '../core/config.js'
import { getRepoRoot } from '../core/preflight.js'
import { handleCancel } from '../core/logger.js'
import * as p from '@clack/prompts'
import { ConfigSchema } from '../types.js'
import { ExitCodes } from '../types.js'

async function detectTestFrameworks(repoRoot: string): Promise<string[]> {
    const candidates: string[] = []
    const packageJsonPath = join(repoRoot, 'package.json')
    let hasPackageJson = false
    let packageJson: any = {}

    if (existsSync(packageJsonPath)) {
        try {
            const content = readFileSync(packageJsonPath, 'utf-8')
            packageJson = JSON.parse(content)
            hasPackageJson = true
        } catch {
            // Ignore
        }
    }

    // Detect file extension (TS vs JS)
    const hasTsConfig = existsSync(join(repoRoot, 'tsconfig.json'))
    const ext = hasTsConfig ? 'ts' : 'js'

    // Jest/Vitest
    const hasJestConfig =
        existsSync(join(repoRoot, 'jest.config.js')) ||
        existsSync(join(repoRoot, 'jest.config.ts')) ||
        existsSync(join(repoRoot, 'jest.config.json'))
    const hasVitestConfig =
        existsSync(join(repoRoot, 'vitest.config.js')) ||
        existsSync(join(repoRoot, 'vitest.config.ts')) ||
        existsSync(join(repoRoot, 'vitest.config.json'))
    const hasJestInDeps =
        hasPackageJson &&
        (packageJson.dependencies?.jest ||
            packageJson.devDependencies?.jest ||
            packageJson.dependencies?.vitest ||
            packageJson.devDependencies?.vitest)

    if (hasJestConfig || hasVitestConfig || hasJestInDeps) {
        if (existsSync(join(repoRoot, '__tests__'))) {
            candidates.push(`__tests__/{slug}.test.${ext}`)
        } else if (existsSync(join(repoRoot, 'tests'))) {
            candidates.push(`tests/{slug}.test.${ext}`)
        } else {
            candidates.push(`tests/{slug}.test.${ext}`)
        }
    }

    // Playwright
    const hasPlaywrightConfig =
        existsSync(join(repoRoot, 'playwright.config.js')) ||
        existsSync(join(repoRoot, 'playwright.config.ts')) ||
        (hasPackageJson &&
            (packageJson.dependencies?.['@playwright/test'] || packageJson.devDependencies?.['@playwright/test']))

    if (hasPlaywrightConfig) {
        if (existsSync(join(repoRoot, 'tests', 'e2e'))) {
            candidates.push(`tests/e2e/{slug}.spec.${ext}`)
        } else if (existsSync(join(repoRoot, 'tests'))) {
            candidates.push(`tests/{slug}.spec.${ext}`)
        } else {
            candidates.push(`e2e/{slug}.spec.${ext}`)
        }
    }

    // Cypress
    const hasCypressConfig =
        existsSync(join(repoRoot, 'cypress.config.js')) ||
        existsSync(join(repoRoot, 'cypress.config.ts')) ||
        existsSync(join(repoRoot, 'cypress')) ||
        (hasPackageJson && (packageJson.dependencies?.cypress || packageJson.devDependencies?.cypress))

    if (hasCypressConfig) {
        if (existsSync(join(repoRoot, 'cypress', 'e2e'))) {
            candidates.push(`cypress/e2e/{slug}.cy.${ext}`)
        } else if (existsSync(join(repoRoot, 'cypress', 'integration'))) {
            candidates.push(`cypress/integration/{slug}.spec.${ext}`)
        } else {
            candidates.push(`cypress/e2e/{slug}.cy.${ext}`)
        }
    }

    // Pytest
    const hasPytestConfig =
        existsSync(join(repoRoot, 'pytest.ini')) ||
        existsSync(join(repoRoot, 'tox.ini')) ||
        existsSync(join(repoRoot, 'pyproject.toml'))

    // Check for test_*.py files in tests/ directory
    let hasPytestTestFiles = false
    const testsDir = join(repoRoot, 'tests')
    if (existsSync(testsDir)) {
        try {
            const entries = await readdir(testsDir, { withFileTypes: true })
            hasPytestTestFiles = entries.some((entry) => entry.isFile() && /^test_.*\.py$/.test(entry.name))
        } catch {
            // Ignore readdir errors
        }
    }

    if (hasPytestConfig || hasPytestTestFiles) {
        candidates.push(`tests/test_{slug}.py`)
    }

    // Limit to 5 candidates, prioritize E2E > Unit > Pytest
    const e2e = candidates.filter((c) => c.includes('e2e') || c.includes('cypress'))
    const unit = candidates.filter((c) => !c.includes('e2e') && !c.includes('cypress') && !c.includes('py'))
    const pytest = candidates.filter((c) => c.includes('py'))

    return [...e2e, ...unit, ...pytest].slice(0, 5)
}

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
                scaffoldPaths = selected as string[]
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
            docTemplates = docTemplatesResult as string[]
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
            docTemplates = defaultDocTemplates
        }

        const config = {
            schemaVersion: 1,
            docsDir,
            docTemplates,
            scaffoldPaths: scaffoldPaths || [],
            branchFormat,
            defaultMergeTarget,
        }

        // Validate config
        const validated = ConfigSchema.parse(config)

        // Write config file
        writeFileSync(configPath, JSON.stringify(validated, null, 2), 'utf-8')

        p.outro(`Configuration saved to ${configPath}`)
    } catch (error: any) {
        p.cancel(`Failed to initialize: ${error.message}`)
        if (error.message.includes('repository')) {
            process.exit(ExitCodes.PRECHECK_FAILED)
        } else if (error.message.includes('config') || error.message.includes('Configuration')) {
            process.exit(ExitCodes.CONFIG_ERROR)
        } else {
            process.exit(ExitCodes.UNKNOWN_ERROR)
        }
    }
}
