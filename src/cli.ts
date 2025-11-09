#!/usr/bin/env node

import { Command } from 'commander'
import { initCommand } from './commands/init.js'
import { createCommand } from './commands/create.js'
import { listCommand } from './commands/list.js'
import { mergeCommand } from './commands/merge.js'

const program = new Command()

program.name('spec').description('Spec CLI - Standardize Feature development workflow').version('0.1.0')

program
    .command('init')
    .description('Initialize Spec CLI configuration')
    .action(async () => {
        await initCommand()
    })

program
    .command('create')
    .description('Create a new feature')
    .argument('<description>', 'Feature description')
    .action(async (description: string) => {
        await createCommand(description)
    })

program
    .command('list')
    .description('List all features')
    .action(async () => {
        await listCommand()
    })

program
    .command('merge')
    .description('Merge a feature branch to the default target branch')
    .argument('<feature-slug>', 'Feature slug')
    .option('-v, --verbose', 'Verbose output')
    .action(async (featureSlug: string, options: { verbose?: boolean }) => {
        await mergeCommand(featureSlug, options.verbose || false)
    })

program.parse()
