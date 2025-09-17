// ESLint Flat Config for iiif-processor
// Migrated from .eslintrc and .eslintignore; no Standard config.

import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  // Ignored paths (migrated from .eslintignore and common generated dirs)
  {
    ignores: [
      "examples/**",
      "dist/**",
      "coverage/**",
      "node_modules/**"
    ]
  },

  // Base JS rules and environment
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node
      }
    },
    rules: {
      // Core style rules (from previous .eslintrc)
      "brace-style": ["error", "1tbs"],
      "comma-dangle": ["error", "never"],
      "indent": ["error", 2, { SwitchCase: 1 }],
      "key-spacing": "off",
      "max-len": "off",
      "max-lines-per-function": [
        "warn",
        { max: 30, skipBlankLines: true, skipComments: true }
      ],
      "no-unused-vars": [
        "warn",
        { vars: "all", args: "after-used", ignoreRestSiblings: false }
      ],
      "no-var": "warn",
      "object-curly-spacing": ["error", "always"],
      "prefer-const": [
        "warn",
        { destructuring: "any", ignoreReadBeforeAssign: true }
      ],
      "semi": ["error", "always"],
      "space-in-parens": ["error", "never"],
      // Complexity warning (slightly strict, per prior comment)
      complexity: ["warn", 6]
    }
  },

  // Recommended JS best practices
  js.configs.recommended,

  // TypeScript support and rules
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.node
      }
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      // Match JS style expectations where applicable
      "object-curly-spacing": ["error", "always"],
      "semi": ["error", "always"]
    }
  },

  // Jest globals for test files (no plugin needed)
  {
    files: ["**/*.{test,spec}.{js,ts}", "tests/**/*.{js,ts,tsx,jsx}"],
    languageOptions: {
      globals: {
        ...globals.jest
      }
    },
    rules: {
      // Relax strict style rules in test code
      semi: "off",
      "object-curly-spacing": "off",
      "prefer-const": "off"
    }
  }
];
