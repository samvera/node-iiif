import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'public'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      // Keep basic project style
      'brace-style': ['error', '1tbs'],
      'comma-dangle': ['error', 'never'],
      indent: 'off',
      'key-spacing': 'off',
      'max-len': 'off',
      'object-curly-spacing': ['error', 'always'],
      semi: ['error', 'always'],
      'space-in-parens': ['error', 'never'],
      // TS settings similar to root
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
)
