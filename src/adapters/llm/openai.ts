import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage } from '@langchain/core/messages'
import { z } from 'zod'
import type { LlmClient } from '../../types.js'

const MAX_SLUG_LENGTH = 50

// Zod schema for structured output
const SlugSchema = z.object({
    slug: z
        .string()
        .regex(
            /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
            'Slug must be kebab-case with only lowercase letters, numbers, and hyphens'
        )
        .max(MAX_SLUG_LENGTH, `Slug must be ${String(MAX_SLUG_LENGTH)} characters or less`)
        .describe('A kebab-case slug (lowercase letters, numbers, and hyphens)'),
})

const DEFAULT_PROMPT = `Generate a kebab-case slug (lowercase letters, numbers, and hyphens) from the following description. The slug should be:
- Maximum 50 characters
- Only lowercase letters, numbers, and hyphens
- Descriptive and concise
- No special characters or spaces

Description: {description}

{existingContext}`

type SlugResult = z.infer<typeof SlugSchema>

export class OpenAILlmClient implements LlmClient {
    private client: ChatOpenAI
    private structuredModel: {
        invoke: (messages: unknown[]) => Promise<SlugResult>
    }
    private maxAttempts: number
    private timeout: number

    constructor() {
        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) {
            throw new Error(
                'OPENAI_API_KEY environment variable is required. Please set it before running this command.'
            )
        }

        const model = process.env.SPEC_OPENAI_MODEL || 'gpt-5-mini'
        const timeoutMs = parseInt(process.env.SPEC_LLM_TIMEOUT_MS || '8000', 10) || 8000
        const maxAttempts = parseInt(process.env.SPEC_LLM_MAX_ATTEMPTS || '3', 10) || 3

        this.client = new ChatOpenAI({
            modelName: model,
            openAIApiKey: apiKey,
            ...(process.env.OPENAI_BASE_URL && {
                configuration: {
                    baseURL: process.env.OPENAI_BASE_URL,
                },
            }),
            timeout: timeoutMs,
        })

        // Create structured output model with Zod schema
        this.structuredModel = this.client.withStructuredOutput(SlugSchema) as {
            invoke: (messages: unknown[]) => Promise<SlugResult>
        }

        this.maxAttempts = maxAttempts
        this.timeout = timeoutMs
    }

    async generateSlug(description: string, existingSlugs: string[] = []): Promise<string> {
        let attempt = 0
        let lastError: string | null = null

        while (attempt < this.maxAttempts) {
            attempt++

            try {
                const existingContext =
                    existingSlugs.length > 0
                        ? `\n\nNote: The following slugs are already taken: ${existingSlugs.join(', ')}. Please generate a different slug.`
                        : ''

                let prompt = DEFAULT_PROMPT.replace('{description}', description).replace(
                    '{existingContext}',
                    existingContext
                )

                if (lastError) {
                    prompt += `\n\nPrevious attempt failed: ${lastError}. Please correct the slug according to the requirements.`
                }

                // Use structured output - format is guaranteed by schema
                const result = await this.structuredModel.invoke([new HumanMessage(prompt)])
                const slug = result.slug

                // Only check uniqueness - format validation is handled by structured output
                if (existingSlugs.includes(slug)) {
                    lastError = `Slug '${slug}' already exists`
                    continue
                }

                return slug
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error'
                if (attempt >= this.maxAttempts) {
                    throw new Error(
                        `Failed to generate slug after ${String(this.maxAttempts)} attempts: ${errorMessage}`
                    )
                }
                lastError = errorMessage
                // Exponential backoff
                await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100))
            }
        }

        throw new Error(
            `Failed to generate valid slug after ${String(this.maxAttempts)} attempts${lastError ? `: ${lastError}` : ''}`
        )
    }
}
