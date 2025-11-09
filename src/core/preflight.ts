import { execa } from 'execa'
import { join, resolve, relative, isAbsolute } from 'node:path'
import { existsSync } from 'node:fs'
import type { Config } from '../types.js'

export interface RepoInfo {
    root: string
    isClean: boolean
}

export async function getRepoRoot(): Promise<string> {
    try {
        const { stdout } = await execa('git', ['rev-parse', '--show-toplevel'], {
            cwd: process.cwd(),
        })
        return stdout.trim()
    } catch {
        throw new Error('Not in a Git repository. Please run this command in a Git repository.')
    }
}

export async function isWorkTreeClean(repoRoot: string): Promise<boolean> {
    try {
        const { stdout } = await execa('git', ['status', '--porcelain'], {
            cwd: repoRoot,
        })
        return stdout.trim() === ''
    } catch {
        return false
    }
}

export async function branchExists(repoRoot: string, branchName: string): Promise<boolean> {
    try {
        await execa('git', ['show-ref', '--verify', `refs/heads/${branchName}`], { cwd: repoRoot })
        return true
    } catch {
        return false
    }
}

export async function getCurrentBranch(repoRoot: string): Promise<string> {
    try {
        const { stdout } = await execa('git', ['branch', '--show-current'], {
            cwd: repoRoot,
        })
        return stdout.trim()
    } catch {
        throw new Error('Failed to get current branch')
    }
}

export function validateScaffoldPaths(
    repoRoot: string,
    scaffoldPaths: string[],
    slug: string
): { valid: boolean; conflicts: string[] } {
    const conflicts: string[] = []
    const normalizedRepoRoot = resolve(repoRoot)

    for (const template of scaffoldPaths) {
        const expanded = template.replace('{slug}', slug)
        const fullPath = resolve(repoRoot, expanded)

        // Ensure path is within repo root using path.relative for robust checking
        const relativePath = relative(normalizedRepoRoot, fullPath)
        if (
            isAbsolute(relativePath) ||
            relativePath.startsWith('..') ||
            relativePath === '' ||
            relativePath.startsWith('/')
        ) {
            conflicts.push(expanded)
            continue
        }

        // Check if target already exists
        if (existsSync(fullPath)) {
            conflicts.push(expanded)
        }
    }

    return {
        valid: conflicts.length === 0,
        conflicts,
    }
}

export function checkFeatureExists(repoRoot: string, config: Config, slug: string): boolean {
    const docsDir = join(repoRoot, config.docsDir, slug)
    return existsSync(docsDir)
}

export async function preflightCreate(repoRoot: string): Promise<void> {
    const isClean = await isWorkTreeClean(repoRoot)
    if (!isClean) {
        throw new Error('Working tree is not clean. Please commit or stash your changes first.')
    }
}

export async function preflightMerge(repoRoot: string, featureBranch: string, targetBranch: string): Promise<void> {
    const isClean = await isWorkTreeClean(repoRoot)
    if (!isClean) {
        throw new Error('Working tree is not clean. Please commit or stash your changes first.')
    }

    const featureExists = await branchExists(repoRoot, featureBranch)
    if (!featureExists) {
        throw new Error(`Feature branch '${featureBranch}' does not exist.`)
    }

    const targetExists = await branchExists(repoRoot, targetBranch)
    if (!targetExists) {
        throw new Error(
            `Target branch '${targetBranch}' does not exist locally. Please create it or set upstream first.`
        )
    }
}
