// Flat config for tiny-iiif example; no Standard config
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default [
  {
    ignores: [
      'node_modules/**',
      'public/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      'brace-style': ['error', '1tbs'],
      'comma-dangle': ['error', 'never'],
      indent: ['error', 2, { SwitchCase: 1 }],
      'key-spacing': 'off',
      'max-len': 'off',
      'max-lines-per-function': ['warn', { max: 30, skipBlankLines: true, skipComments: true }],
      'no-unused-vars': ['warn', { vars: 'all', args: 'after-used', ignoreRestSiblings: false }],
      'no-var': 'warn',
      'object-curly-spacing': ['error', 'always'],
      'prefer-const': ['warn', { destructuring: 'any', ignoreReadBeforeAssign: true }],
      semi: ['error', 'always'],
      'space-in-parens': ['error', 'never'],
      complexity: ['warn', 5]
    }
  }
]
