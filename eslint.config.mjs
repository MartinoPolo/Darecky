import tseslint from 'typescript-eslint';
import sveltePlugin from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import checkFile from 'eslint-plugin-check-file';
import storybook from 'eslint-plugin-storybook';
import globals from 'globals';
// Cache-safe subset of svelte.config.js – the real config uses a function for
// compilerOptions.runes which ESLint cannot serialize for --cache.
const eslintSvelteConfig = {
	compilerOptions: { runes: true },
};

export default [
	{
		ignores: [
			'.svelte-kit',
			'.wrangler',
			'.storybook',
			'storybook-static',
			'.design-probe',
			'build',
			'coverage',
			'node_modules',
			'src/lib/paraglide',
			'src/paraglide',
			'test-results',
			'**/*.config.*',
			'**/*.d.ts',
			'scripts/**',
			'.claude/worktrees/**',
		],
	},
	...tseslint.configs.recommended,
	...storybook.configs['flat/recommended'],
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
			parserOptions: {
				extraFileExtensions: ['.svelte'],
				project: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			// typescript-eslint recommends disabling no-undef for TS projects
			// https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off',
			// Gap rules not covered by OxLint
			'@typescript-eslint/strict-boolean-expressions': 'error',
			'@typescript-eslint/switch-exhaustiveness-check': [
				'error',
				{ considerDefaultExhaustiveForUnions: true },
			],
			'@typescript-eslint/require-array-sort-compare': 'error',
			'@typescript-eslint/naming-convention': [
				'warn',
				{
					selector: 'variableLike',
					format: ['camelCase', 'PascalCase'],
					leadingUnderscore: 'allow',
				},
				{
					selector: 'variable',
					format: ['UPPER_CASE', 'camelCase', 'PascalCase'],
					modifiers: ['global', 'const'],
					leadingUnderscore: 'allow',
				},
				{
					selector: 'typeLike',
					format: ['PascalCase'],
				},
			],
			'@typescript-eslint/consistent-type-definitions': 'warn',
			'@typescript-eslint/consistent-type-imports': [
				'warn',
				{ fixStyle: 'inline-type-imports' },
			],
			'@typescript-eslint/no-import-type-side-effects': 'warn',
		},
	},
	...sveltePlugin.configs['flat/recommended'],
	{
		// The app uses paraglide for URL localization (localizeInternalHref wrapping resolve()),
		// which satisfies the intent of this rule but doesn't match its narrow pattern check.
		rules: {
			'svelte/no-navigation-without-resolve': [
				'error',
				{ ignoreLinks: true, ignoreGoto: true },
			],
		},
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parser: svelteParser,
			parserOptions: {
				parser: '@typescript-eslint/parser',
				extraFileExtensions: ['.svelte'],
				project: true,
				svelteConfig: eslintSvelteConfig,
				svelteFeatures: {
					experimentalGenerics: true,
				},
			},
		},
	},
	{
		files: ['**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				project: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	{
		files: ['src/**/*.ts'],
		ignores: ['src/routes/**/+*'],
		plugins: { 'check-file': checkFile },
		rules: {
			'check-file/filename-naming-convention': [
				'error',
				{ '**/*.ts': 'SNAKE_CASE' },
				{ ignoreMiddleExtensions: true },
			],
		},
	},
	{
		files: ['src/lib/**/*.svelte'],
		ignores: ['src/lib/components/base/**'],
		plugins: { 'check-file': checkFile },
		rules: {
			'check-file/filename-naming-convention': [
				'error',
				{ '**/*.svelte': 'PASCAL_CASE' },
				{ ignoreMiddleExtensions: true },
			],
		},
	},
	{
		...tseslint.configs.disableTypeChecked,
		files: ['designs/**/*.{js,mjs}'],
	},
];
