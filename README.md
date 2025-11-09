# Spec CLI

A command-line tool to standardize Feature development workflow. Automates documentation structure, test files, and Git branch management for new features using AI-powered slug generation.

## Overview

Spec CLI helps developers maintain a consistent feature development workflow by automating repetitive tasks:

- **AI-powered slug generation**: Converts natural language descriptions into standardized kebab-case slugs
- **Automated branch management**: Creates feature branches following your project's naming convention
- **Documentation scaffolding**: Generates standardized documentation structure for each feature
- **Test file scaffolding**: Creates test files based on detected testing frameworks
- **Git workflow automation**: Streamlines merging feature branches to target branches

## Features

- **Initialize Configuration**: Interactive setup wizard to configure project standards (`spec init`)
- **Create Features**: Automatically generate feature slugs using AI, create branches, documentation, and test scaffolds (`spec create`)
- **List Features**: View all existing features in your project (`spec list`)
- **Merge Features**: Merge feature branches to the default target branch (`spec merge`)

## Installation

```bash
npm install -g spec-cli
```

## Prerequisites

- **Node.js**: Version 22 LTS or higher
- **Git**: Installed and configured with user.name and user.email
- **OpenAI API Key**: Required for feature slug generation (set via `SPEC_OPENAI_API_KEY` environment variable)

## Configuration

### Environment Variables

Set the following environment variables before using the CLI:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SPEC_OPENAI_API_KEY` | Yes | - | Your OpenAI API key |
| `SPEC_OPENAI_BASE_URL` | No | - | Custom API base URL (for compatible APIs) |
| `SPEC_OPENAI_MODEL` | No | `gpt-5-mini` | Model name to use |
| `SPEC_LLM_TIMEOUT_MS` | No | `8000` | Request timeout in milliseconds |
| `SPEC_LLM_MAX_ATTEMPTS` | No | `3` | Maximum retry attempts for LLM calls |

### Project Configuration

Run `spec init` in your Git repository to create a `spec.config.json` file with your project settings.

The configuration file includes:

- **docsDir**: Documentation directory path (default: `docs`)
- **docTemplates**: List of document templates to create (default: `requirements.md`, `tech-spec.md`, `user-stories.md`)
- **scaffoldPaths**: Additional scaffold path templates for test files and directories (must include `{slug}` placeholder)
- **branchFormat**: Branch naming format (default: `feature-{slug}`)
- **defaultMergeTarget**: Default merge target branch (default: `main`)

Example `spec.config.json`:

```json
{
  "schemaVersion": 1,
  "docsDir": "docs",
  "docTemplates": ["requirements.md", "tech-spec.md", "user-stories.md"],
  "scaffoldPaths": [
    "tests/e2e/{slug}.spec.ts",
    "tests/{slug}.test.ts"
  ],
  "branchFormat": "feature-{slug}",
  "defaultMergeTarget": "main"
}
```

## Usage

### Initialize Configuration

```bash
spec init
```

This interactive command guides you through setting up:

- Documentation directory path
- Document templates (with auto-detection)
- Scaffold paths for test files (auto-detects Jest/Vitest, Playwright, Cypress, Pytest)
- Branch naming format
- Default merge target branch

The wizard automatically detects your project's testing frameworks and suggests appropriate scaffold paths.

### Create a Feature

```bash
spec create "Add user authentication system"
```

This command will:

1. **Generate a slug**: Uses AI to convert your description into a kebab-case slug (e.g., `user-authentication`)
2. **Validate uniqueness**: Checks that the slug doesn't conflict with existing features, branches, or scaffold paths
3. **Create feature branch**: Creates and switches to a new branch following your `branchFormat` configuration
4. **Create documentation**: Generates documentation structure in `docs/{slug}/` with configured templates
5. **Create scaffolds**: Generates test files and directories based on `scaffoldPaths` configuration
6. **Initial commit**: Commits the scaffolded structure with a Conventional Commits message

**Important**: All file operations occur only in the new feature branch. The main branch remains unaffected.

### List Features

```bash
spec list
```

Lists all features alphabetically based on documentation directory structure. Only outputs feature slugs (one per line).

### Merge a Feature

```bash
spec merge user-authentication
```

Merges the feature branch to the default target branch:

1. Validates feature branch exists
2. Switches to target branch
3. Pulls latest changes
4. Merges feature branch (using `--no-ff` for merge commit)
5. Pushes changes

**Note**: If merge conflicts occur, the command will exit with an error code and provide instructions for manual resolution.

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Unknown error |
| `2` | Configuration/parameter validation failed |
| `3` | Preflight check failed (e.g., not in Git repo, working tree not clean) |
| `4` | LLM call or validation failed |
| `5` | Git operation failed |

## Architecture

The project follows a layered architecture:

- **CLI Layer** (`src/cli.ts`, `src/commands/`): Command parsing, parameter handling, and user interaction
- **Core Layer** (`src/core/`): Business logic for configuration, preflight checks, Git operations, and template generation
- **Adapter Layer** (`src/adapters/llm/`): LLM client abstraction (currently OpenAI via LangChain)

### Key Design Decisions

- **TypeScript ESM**: Pure ESM modules (`"type": "module"`), strict mode
- **No bundler**: Uses `tsc` for compilation only
- **Conventional Commits**: All commits follow the Conventional Commits specification
- **LLM dependency**: Slug generation requires LLM (no offline mode in MVP)
- **Git-first**: All operations respect Git workflow and maintain branch isolation

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/ishowshao/spec-cli.git
cd spec-cli

# Install dependencies
npm install
```

### Development Commands

```bash
# Run CLI from TypeScript source (development mode)
npm run dev -- init

# Build TypeScript to JavaScript
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check

# Clean build output
npm run clean
```

### Project Structure

```
src/
  cli.ts                 # CLI entry point
  commands/              # Command implementations
    init.ts
    create.ts
    list.ts
    merge.ts
  core/                  # Core utilities
    config.ts            # Configuration loading/validation
    preflight.ts         # Preflight checks
    git.ts               # Git operations wrapper
    templates.ts         # File/directory creation
    logger.ts            # Logging utilities
  adapters/
    llm/
      openai.ts          # OpenAI LLM client
  types.ts               # Type definitions
```

### Testing

Tests use Vitest and are located in the `tests/` directory. The test suite includes:

- Unit tests for configuration, validation, and utilities
- Integration tests for end-to-end command execution
- Mock LLM client for testing without network access

## Contributing

Contributions are welcome! Please follow these guidelines:

- Use Conventional Commits for commit messages
- Follow the existing code style (4-space indent, single quotes, no semicolons)
- Add tests for new features
- Update documentation as needed

## License

Apache-2.0

## Related Documentation

- [Requirements Document](docs/requirements.md) - Detailed feature requirements (in Chinese)
- [Technical Specification](docs/tech-spec.md) - Technical implementation details (in Chinese)
- [Repository Guidelines](AGENTS.md) - Development guidelines and conventions
