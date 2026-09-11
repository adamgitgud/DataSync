// @ts-check
import stylistic from '@stylistic/eslint-plugin';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import tseslint from 'typescript-eslint';

const spacedStatements = [
  'do',
  'export',
  'for',
  'if',
  'import',
  'interface',
  'switch',
  'try',
  'type',
  'while',
];

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.recommended, tseslint.configs.stylistic],
  },
  prettierRecommended,
  {
    files: ['**/*.ts'],
    plugins: {
      '@stylistic': stylistic,
    },
    rules: {
      '@stylistic/lines-between-class-members': ['error', 'always'],
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: '*', next: spacedStatements },
        { blankLine: 'always', prev: spacedStatements, next: '*' },
        { blankLine: 'never', prev: 'import', next: 'import' },
      ],
      curly: ['error', 'all'],
    },
  },
);
