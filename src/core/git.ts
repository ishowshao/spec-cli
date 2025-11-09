import { execa } from 'execa'
import type { GitError } from '../types.js'

export async function gitSwitch(repoRoot: string, branch: string, create = false): Promise<void> {
    try {
        const args = create ? ['switch', '-c', branch] : ['switch', branch]
        await execa('git', args, { cwd: repoRoot })
    } catch (error: any) {
        const gitError: GitError = {
            code: 'SWITCH_FAILED',
            message: error.message || 'Failed to switch branch',
            hint: create
                ? `Failed to create and switch to branch '${branch}'`
                : `Failed to switch to branch '${branch}'`,
        }
        throw gitError
    }
}

export async function gitAdd(repoRoot: string, paths: string[]): Promise<void> {
    try {
        await execa('git', ['add', ...paths], { cwd: repoRoot })
    } catch (error: any) {
        const gitError: GitError = {
            code: 'ADD_FAILED',
            message: error.message || 'Failed to add files',
        }
        throw gitError
    }
}

export async function gitCommit(repoRoot: string, message: string): Promise<string> {
    try {
        await execa('git', ['commit', '-m', message], { cwd: repoRoot })
        // Get commit hash reliably
        const { stdout } = await execa('git', ['rev-parse', '--short', 'HEAD'], { cwd: repoRoot })
        return stdout.trim()
    } catch (error: any) {
        const gitError: GitError = {
            code: 'COMMIT_FAILED',
            message: error.message || 'Failed to commit',
        }
        throw gitError
    }
}

export async function gitPull(repoRoot: string, _branch: string): Promise<void> {
    try {
        await execa('git', ['pull'], { cwd: repoRoot })
    } catch (error: any) {
        const gitError: GitError = {
            code: 'PULL_FAILED',
            message: error.message || 'Failed to pull latest changes',
            hint: 'Check if upstream is set: git branch --set-upstream-to <remote>/<branch> <branch>',
        }
        throw gitError
    }
}

export async function gitMerge(repoRoot: string, branch: string): Promise<string> {
    try {
        await execa('git', ['merge', '--no-ff', branch], { cwd: repoRoot })
        // Get merge commit hash reliably
        const { stdout } = await execa('git', ['rev-parse', '--short', 'HEAD'], { cwd: repoRoot })
        return stdout.trim()
    } catch (error: any) {
        const gitError: GitError = {
            code: 'MERGE_FAILED',
            message: error.message || 'Failed to merge branch',
            hint: 'Merge conflicts detected. Please resolve conflicts manually and commit.',
        }
        throw gitError
    }
}

export async function gitPush(repoRoot: string): Promise<void> {
    try {
        await execa('git', ['push'], { cwd: repoRoot })
    } catch (error: any) {
        const gitError: GitError = {
            code: 'PUSH_FAILED',
            message: error.message || 'Failed to push',
            hint: 'Set upstream: git push -u origin <branch>',
        }
        throw gitError
    }
}

export async function getUpstream(repoRoot: string, branch: string): Promise<string | null> {
    try {
        const { stdout } = await execa('git', ['rev-parse', '--abbrev-ref', `${branch}@{u}`], { cwd: repoRoot })
        return stdout.trim() || null
    } catch {
        return null
    }
}
