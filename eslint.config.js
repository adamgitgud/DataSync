// @ts-check
import stylistic from '@stylistic/eslint-plugin';
import perfectionist from 'eslint-plugin-perfectionist';
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
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    extends: [
      tseslint.configs.recommendedTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
  },
  prettierRecommended,
  {
    files: ['**/*.ts'],
    plugins: {
      '@stylistic': stylistic,
      perfectionist,
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
      'max-params': ['error', 3],
      'perfectionist/sort-objects': 'error',
      'perfectionist/sort-interfaces': 'error',
      'perfectionist/sort-object-types': 'error',
    },
  },
);
