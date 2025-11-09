# Spec CLI

A command-line tool to standardize Feature development workflow. Automates documentation structure, test files, and Git branch management for new features.

## Features

- **Initialize Configuration**: Interactive setup wizard to configure project standards
- **Create Features**: Automatically generate feature slugs using AI, create branches, documentation, and test scaffolds
- **List Features**: View all existing features in your project
- **Merge Features**: Merge feature branches to the default target branch

## Installation

```bash
npm install -g spec-cli
```

## Prerequisites

- Node.js 22 LTS or higher
- Git installed and configured
- OpenAI API Key (for feature slug generation)

## Configuration

### Environment Variables

Set the following environment variables before using the CLI:

- `OPENAI_API_KEY` (required): Your OpenAI API key
- `OPENAI_BASE_URL` (optional): Custom API base URL
- `SPEC_OPENAI_MODEL` (optional, default: `gpt-4o-mini`): Model name
- `SPEC_LLM_TIMEOUT_MS` (optional, default: `8000`): Request timeout in milliseconds
- `SPEC_LLM_MAX_ATTEMPTS` (optional, default: `3`): Maximum retry attempts

### Project Configuration

Run `spec init` in your Git repository to create a `spec.config.json` file with your project settings.

## Usage

### Initialize Configuration

```bash
spec init
```

This will guide you through setting up:
- Documentation directory path
- Document templates
- Scaffold paths (test files)
- Branch naming format
- Default merge target branch

### Create a Feature

```bash
spec create "Add user authentication system"
```

This command will:
1. Generate a kebab-case slug using AI (e.g., `user-authentication`)
2. Create and switch to a new feature branch
3. Create documentation structure
4. Create scaffold files based on configuration
5. Commit the initial structure

### List Features

```bash
spec list
```

Lists all features (based on documentation directory structure).

### Merge a Feature

```bash
spec merge user-authentication
```

Merges the feature branch to the default target branch:
1. Switches to target branch
2. Pulls latest changes
3. Merges feature branch (no-ff)
4. Pushes changes

## Exit Codes

- `0`: Success
- `1`: Unknown error
- `2`: Configuration/parameter validation failed
- `3`: Preflight check failed (e.g., not in Git repo, working tree not clean)
- `4`: LLM call or validation failed
- `5`: Git operation failed

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build

# Run tests
npm test
```

## License

Apache-2.0
