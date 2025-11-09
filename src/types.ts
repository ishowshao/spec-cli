import { z } from 'zod'

export const ConfigSchema = z.object({
    schemaVersion: z.number().int().positive().default(1),
    docsDir: z.string().default('docs'),
    docTemplates: z.array(z.string()).default(['requirements.md', 'tech-spec.md', 'user-stories.md']),
    scaffoldPaths: z
        .array(z.string())
        .optional()
        .default([])
        .refine(
            (paths) =>
                paths.every((path) => {
                    if (!path.includes('{slug}')) return false
                    if (path.startsWith('/') || path.includes('..')) return false
                    return true
                }),
            {
                message: 'Each scaffoldPath must be a relative path containing {slug} and not contain ..',
            }
        ),
    branchFormat: z.string().default('feature-{slug}'),
    defaultMergeTarget: z.string().default('main'),
})

export type Config = z.infer<typeof ConfigSchema>

export interface LlmClient {
    generateSlug(description: string, existingSlugs: string[]): Promise<string>
}

export interface GitError {
    code: string
    message: string
    hint?: string
}

export const ExitCodes = {
    SUCCESS: 0,
    CONFIG_ERROR: 2,
    PRECHECK_FAILED: 3,
    LLM_ERROR: 4,
    GIT_ERROR: 5,
    UNKNOWN_ERROR: 1,
} as const

export type ExitCode = (typeof ExitCodes)[keyof typeof ExitCodes]
