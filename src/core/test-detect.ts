import { join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'

interface PackageJsonLike {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
}

export async function detectTestFrameworks(repoRoot: string): Promise<string[]> {
    const candidates: string[] = []
    const packageJsonPath = join(repoRoot, 'package.json')
    let hasPackageJson = false
    let packageJson: PackageJsonLike = {}

    if (existsSync(packageJsonPath)) {
        try {
            const content = readFileSync(packageJsonPath, 'utf-8')
            packageJson = JSON.parse(content) as PackageJsonLike
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

