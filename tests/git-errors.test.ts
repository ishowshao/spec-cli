import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { temporaryDirectory } from 'tempy'
import { describe, it, expect } from 'vitest'
import { execa } from 'execa'
import { gitSwitch, gitAdd, gitCommit, gitPull, gitMerge, getUpstream } from '../src/core/git.ts'
import { GitOperationError } from '../src/types.ts'

async function initRepo(repo: string) {
    await execa('git', ['init'], { cwd: repo })
    await execa('git', ['config', 'user.name', 'test'], { cwd: repo })
    await execa('git', ['config', 'user.email', 'test@example.com'], { cwd: repo })
    // create initial commit on whatever default branch is
    writeFileSync(join(repo, 'init.txt'), 'x')
    await gitAdd(repo, [join(repo, 'init.txt')])
    await gitCommit(repo, 'chore: init')
}

describe('core/git error branches', () => {
    it('gitSwitch fails when branch missing and create=false', async () => {
        const repo = temporaryDirectory()
        await initRepo(repo)
        await expect(gitSwitch(repo, 'no-such-branch')).rejects.toBeInstanceOf(GitOperationError)
    })

    it('gitAdd fails for missing path', async () => {
        const repo = temporaryDirectory()
        await initRepo(repo)
        await expect(gitAdd(repo, ['does-not-exist.file'])).rejects.toBeInstanceOf(GitOperationError)
    })

    it('gitCommit fails when nothing staged', async () => {
        const repo = temporaryDirectory()
        await initRepo(repo)
        await expect(gitCommit(repo, 'noop commit')).rejects.toBeInstanceOf(GitOperationError)
    })

    it('gitPull fails without upstream', async () => {
        const repo = temporaryDirectory()
        await initRepo(repo)
        await expect(gitPull(repo, 'main')).rejects.toBeInstanceOf(GitOperationError)
    })

    it('gitMerge fails for unknown branch', async () => {
        const repo = temporaryDirectory()
        await initRepo(repo)
        await expect(gitMerge(repo, 'nope')).rejects.toBeInstanceOf(GitOperationError)
    })

    it('getUpstream returns null when not set', async () => {
        const repo = temporaryDirectory()
        await initRepo(repo)
        const current = (await execa('git', ['branch', '--show-current'], { cwd: repo })).stdout.trim()
        const upstream = await getUpstream(repo, current || 'main')
        expect(upstream).toBeNull()
    })
})

