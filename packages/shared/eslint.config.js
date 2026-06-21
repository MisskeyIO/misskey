import globals from 'globals';
import pluginMisskey from '@misskey-dev/eslint-plugin';

export default [
	...pluginMisskey.configs['recommended'],
	{
		files: ['**/*.cjs'],
		languageOptions: {
			sourceType: 'commonjs',
			parserOptions: {
				sourceType: 'commonjs',
			},
		},
	},
	{
		files: ['**/*.js', '**/*.jsx'],
		languageOptions: {
			parserOptions: {
				sourceType: 'module',
			},
		},
	},
	{
		files: ['build.js'],
		languageOptions: {
			globals: globals.node,
		},
	},
	{
		files: ['**/*.js', '**/*.cjs'],
		rules: {
			'@typescript-eslint/no-var-requires': 'off',
		},
	},
	{
		rules: {
			'no-restricted-imports': ['error', {
				paths: [{ name: 'punycode' }],
			}],
			// 型の情報を利用してlintする必要があるため無効化
			// TODO: 有効化検討
			'@typescript-eslint/no-misused-promises': 'off',
			// ESLint 10でrecommended入りしたため、既存コードの整理は別タスクで行う
			'no-useless-assignment': 'off',
			// eslint-plugin更新でrecommended入りしたため、既存コードの整理は別タスクで行う
			'preserve-caught-error': 'off',
			'no-async-promise-executor': 'error',
		},
	},
	{
		// typescript
		files: ['**/*.ts', '**/*.tsx'],
		rules: {
			'@typescript-eslint/no-unused-vars': ['warn', {
				'args': 'all',
				'argsIgnorePattern': '^_',
				'caughtErrors': 'all',
				'caughtErrorsIgnorePattern': '^_',
				'destructuredArrayIgnorePattern': '^_',
				'varsIgnorePattern': '^_',
				'ignoreRestSiblings': true,
			}],
		},
	},
];
