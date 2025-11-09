import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage } from '@langchain/core/messages'
import type { LlmClient } from '../../types.js'

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_SLUG_LENGTH = 50

const DEFAULT_PROMPT = `Generate a kebab-case slug (lowercase letters, numbers, and hyphens) from the following description. The slug should be:
- Maximum 50 characters
- Only lowercase letters, numbers, and hyphens
- Descriptive and concise
- No special characters or spaces

Description: {description}

{existingContext}

Return only the slug itself, nothing else.`

export class OpenAILlmClient implements LlmClient {
    private client: ChatOpenAI
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
            temperature: 0,
        })

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

                const response = await this.client.invoke([new HumanMessage(prompt)])
                const slug = (response.content as string).trim()

                // Validate slug format
                if (!SLUG_REGEX.test(slug)) {
                    lastError = `Invalid format: slug must match pattern [a-z0-9]+(?:-[a-z0-9]+)*`
                    continue
                }

                if (slug.length > MAX_SLUG_LENGTH) {
                    lastError = `Too long: slug must be ${MAX_SLUG_LENGTH} characters or less (got ${slug.length})`
                    continue
                }

                // Check uniqueness
                if (existingSlugs.includes(slug)) {
                    lastError = `Slug '${slug}' already exists`
                    continue
                }

                return slug
            } catch (error: any) {
                if (attempt >= this.maxAttempts) {
                    throw new Error(`Failed to generate slug after ${this.maxAttempts} attempts: ${error.message}`)
                }
                lastError = error.message || 'Unknown error'
                // Exponential backoff
                await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100))
            }
        }

        throw new Error(
            `Failed to generate valid slug after ${this.maxAttempts} attempts${lastError ? `: ${lastError}` : ''}`
        )
    }
}
