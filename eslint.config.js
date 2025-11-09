import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import prettierConfig from 'eslint-config-prettier'

// Scope helper: map a flat config array to only apply to given files
const scope = (confs, files, extra = {}) =>
  confs.map(c => ({
    ...c,
    files,
    languageOptions: {
      ...(c.languageOptions ?? {}),
      parser: tsparser,
      parserOptions: {
        ...(c.languageOptions?.parserOptions ?? {}),
        ecmaVersion: 2023,
        sourceType: 'module',
        ...(extra.parserOptions ?? {}),
      },
      ...(extra.languageOptions ?? {}),
    },
  }))

// Strict, type-checked rules for source files
const tsStrictTypeCheckedForSrc = scope(
  tseslint.configs['flat/strict-type-checked'],
  ['src/**/*.ts'],
  { parserOptions: { project: './tsconfig.json' } }
)

// Strict (non type-checked) rules for test files
const tsStrictForTests = scope(tseslint.configs['flat/strict'], [
  '**/*.test.ts',
  '**/*.spec.ts',
  'tests/**/*.ts',
], {
  languageOptions: {
    globals: {
      vi: 'readonly',
      describe: 'readonly',
      it: 'readonly',
      test: 'readonly',
      expect: 'readonly',
      beforeEach: 'readonly',
      afterEach: 'readonly',
      beforeAll: 'readonly',
      afterAll: 'readonly',
    },
  },
})

export default [
  // Global ignores (do not ignore tests so that they are linted)
  {
    ignores: [
      'dist/**',
      'build/**',
      'node_modules/**',
      '**/*.config.js',
      '**/*.config.ts',
      '**/*.d.ts.map',
    ],
  },

  // Apply strict + type-checked rules to src/**
  ...tsStrictTypeCheckedForSrc,
  // Project-specific customizations for src/** (overrides/extra rules)
  {
    files: ['src/**/*.ts'],
    rules: {
      // Keep ergonomic returns inferred by TS
      '@typescript-eslint/explicit-function-return-type': 'off',

      // Keep underscore as an allowed placeholder while staying strict
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // CLI tool can use console
      'no-console': 'off',
      // Additional modern JS/TS preferences
      'object-shorthand': 'error',
      'prefer-arrow-callback': 'error',

      // Prettier integration - disable conflicting rules
      ...prettierConfig.rules,
    },
  },

  // Apply strict (non type-checked) rules to tests/**
  ...tsStrictForTests,
  // Test-specific additions (Prettier, etc.)
  {
    files: ['**/*.test.ts', '**/*.spec.ts', 'tests/**/*.ts'],
    rules: {
      ...prettierConfig.rules,
    },
  },
]
