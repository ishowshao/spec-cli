import * as p from '@clack/prompts'
import { isCancel } from '@clack/prompts'

export const logger = {
    info: (message: string) => {
        p.log.info(message)
    },
    success: (message: string) => {
        p.log.success(message)
    },
    error: (message: string) => {
        p.log.error(message)
    },
    warn: (message: string) => {
        p.log.warn(message)
    },
    step: (_message: string) => {
        return p.spinner()
    },
    verbose: (message: string, enabled: boolean) => {
        if (enabled) {
            console.log(`[verbose] ${message}`)
        }
    },
}

export function handleCancel(value: unknown): void {
    if (isCancel(value)) {
        p.cancel('Operation cancelled.')
        process.exit(1)
    }
}
