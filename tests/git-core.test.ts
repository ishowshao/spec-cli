import { writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { temporaryDirectory } from 'tempy'
import { describe, it, expect } from 'vitest'
import { execa } from 'execa'
import { gitSwitch, gitAdd, gitCommit, gitMerge, gitPush } from '../src/core/git.ts'
import { GitOperationError } from '../src/types.ts'

async function initRepo(repo: string) {
    await execa('git', ['init'], { cwd: repo })
    await execa('git', ['config', 'user.name', 'test'], { cwd: repo })
    await execa('git', ['config', 'user.email', 'test@example.com'], { cwd: repo })
}

describe('core/git integration (local)', () => {
    it('switch/add/commit/merge works locally', async () => {
        const repo = temporaryDirectory()
        await initRepo(repo)

        // initial commit on main
        writeFileSync(join(repo, 'README.md'), '# demo')
        await gitAdd(repo, [join(repo, 'README.md')])
        await gitCommit(repo, 'chore: init')

        // feature branch
        await gitSwitch(repo, 'feature-x', true)
        const f = join(repo, 'feature.txt')
        writeFileSync(f, 'hello')
        await gitAdd(repo, [f])
        await gitCommit(repo, 'feat: add file')

        // merge into main
        await gitSwitch(repo, 'master', true).catch(async () => {
            // Some git init use default 'master' not existing; ensure main exists
            await gitSwitch(repo, 'main', true)
        })
        // Ensure we are on main
        try {
            await gitSwitch(repo, 'main')
        } catch {
            await gitSwitch(repo, 'master')
        }

        const hash = await gitMerge(repo, 'feature-x')
        expect(hash.length).toBeGreaterThan(0)
        expect(existsSync(join(repo, 'feature.txt'))).toBe(true)

        // push without remote should fail with GitOperationError
        await expect(gitPush(repo)).rejects.toBeInstanceOf(GitOperationError)
    })
})

