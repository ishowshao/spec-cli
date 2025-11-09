import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { ConfigSchema, type Config } from '../types.js'

const CONFIG_FILE = 'spec.config.json'

export function loadConfig(repoRoot: string): Config {
    const configPath = join(repoRoot, CONFIG_FILE)

    if (!existsSync(configPath)) {
        throw new Error(`Configuration file not found: ${CONFIG_FILE}. Run 'spec init' first.`)
    }

    try {
        const content = readFileSync(configPath, 'utf-8')
        const raw = JSON.parse(content) as unknown
        return ConfigSchema.parse(raw)
    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new Error(`Invalid configuration: ${error.errors.map((e) => e.message).join(', ')}`)
        }
        const errorMessage = error instanceof Error ? error.message : String(error)
        throw new Error(`Failed to load configuration: ${errorMessage}`)
    }
}

export function getConfigPath(repoRoot: string): string {
    return join(repoRoot, CONFIG_FILE)
}
