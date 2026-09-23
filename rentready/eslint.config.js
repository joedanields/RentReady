import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'node_modules/',
      'coverage/',
      'playwright-report/',
      'test-results/',
      'dev-dist/',
      '.env*',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      'react-hooks/exhaustive-deps': 'warn',
      'jsx-a11y/anchor-is-valid': 'off',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-noninteractive-element-interactions': 'warn',
      'jsx-a11y/role-has-required-aria-props': 'warn',
      // Code-execution sinks are banned outright (SECURITY.md §3: XSS via agreement/model text).
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message:
            'dangerouslySetInnerHTML is banned. Render text as React nodes (see components/Mark.tsx).',
        },
      ],
    },
    settings: {
      react: { version: '19' },
    },
  },
  {
    // The Gemini layer handles the user's key: no console output of any kind, errors go
    // through redact() in errors.ts instead.
    files: ['src/core/gemini/**/*.ts'],
    rules: {
      // Banning the global itself covers every method, including the warn/error allowed above.
      'no-restricted-globals': [
        'error',
        { name: 'console', message: 'No console in src/core/gemini — route errors through redact().' },
      ],
    },
  },
  {
    // Node-side tooling prints its report to the terminal.
    files: ['scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  }
);
