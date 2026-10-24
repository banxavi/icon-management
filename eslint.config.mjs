import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['.next/**', 'node_modules/**', 'public/**', 'pnpm-lock.yaml', 'tsconfig.tsbuildinfo', 'scripts/**', 'supabase/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
)
