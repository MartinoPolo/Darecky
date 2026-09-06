import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { helpTextVariants } from './help-text/help_text_variants.js';

const sourceRoot = resolve('src');

function readSource(path: string): string {
	return readFileSync(resolve(path), 'utf8');
}

function sourceFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			return sourceFiles(path);
		}
		return ['.svelte', '.ts', '.css'].includes(extname(entry.name)) ? [path] : [];
	});
}

describe('design-system control contracts', () => {
	it('defines only the 26, 32, 38, and 48px shared control steps', () => {
		const appCss = readSource('src/app.css');

		expect(appCss).toContain('--size-control-sm: 26px');
		expect(appCss).toContain('--size-control-md: 32px');
		expect(appCss).toContain('--size-control-lg: 38px');
		expect(appCss).toContain('--size-control-xl: 48px');
		expect(appCss).toContain(
			'--muted-foreground: color-mix(in oklab, var(--p-ink) 62%, transparent)',
		);
		expect(appCss).toContain(
			'--muted-foreground: color-mix(in oklab, var(--ink) 65%, transparent)',
		);
	});

	it('uses semantic sm, md, and lg Select trigger sizes with md by default', () => {
		const selectTrigger = readSource('src/lib/components/base/select/select-trigger.svelte');

		expect(selectTrigger).toContain("size = 'md'");
		expect(selectTrigger).toContain("size?: 'sm' | 'md' | 'lg'");
		expect(selectTrigger).toContain('h-(--size-control-sm)');
		expect(selectTrigger).toContain('h-(--size-control-md)');
		expect(selectTrigger).toContain('h-(--size-control-lg)');
		expect(selectTrigger).toContain('*:data-[slot=select-value]:flex');
		expect(selectTrigger).toContain('*:data-[slot=select-value]:items-center');
		expect(selectTrigger).toContain('*:data-[slot=select-value]:gap-1.5');
		expect(selectTrigger).toContain('*:data-[slot=select-value]:line-clamp-1');
		expect(selectTrigger).toContain('*:data-[slot=select-value]:min-w-0');
		expect(selectTrigger).toContain("[&_svg:not([class*='size-'])]:size-4");
		expect(selectTrigger).toContain('[&_svg]:pointer-events-none');
		expect(selectTrigger).toContain('[&_svg]:shrink-0');
		expect(selectTrigger).toContain('font-semibold');
		expect(selectTrigger).toContain('data-placeholder:text-muted-foreground');
	});

	it('keeps Select triggers shrinkable inside constrained flex layouts', () => {
		const selectTrigger = readSource('src/lib/components/base/select/select-trigger.svelte');

		expect(selectTrigger).toMatch(/ownerBaseClasses = `[^`]*\bw-fit min-w-0 max-w-full\b/);
	});

	it('uses only phrasing markup inside the share method Button surface', () => {
		const shareMethodButton = readSource(
			'src/lib/components/blocks/sharing/ShareMethodButton.svelte',
		);
		const buttonContents = shareMethodButton.match(
			/<Button\b[\s\S]*?>([\s\S]*?)<\/Button>/,
		)?.[1];

		expect(buttonContents).toBeDefined();
		expect(buttonContents).not.toMatch(/<div\b/);
	});

	it('does not restore raw legacy control heights in migrated feature surfaces', () => {
		const selectTrigger = readSource('src/lib/components/base/select/select-trigger.svelte');
		const inputGroup = readSource('src/lib/components/base/input-group/input-group.svelte');
		const shareWizard = readSource('src/lib/components/blocks/sharing/ShareWizard.svelte');
		const landingHero = readSource('src/lib/components/blocks/landing/LandingHero.svelte');
		const landingCallToAction = readSource(
			'src/lib/components/blocks/landing/LandingCallToAction.svelte',
		);
		const giftListItem = readSource('src/lib/components/blocks/gift/GiftListItem.svelte');
		const appCss = readSource('src/app.css');

		expect(selectTrigger).not.toMatch(/data-\[size=(?:default|sm)\]:h-(?:8|9)/);
		expect(inputGroup).not.toMatch(/(?:^|\s)h-(?:8|9)(?:\s|$)/);
		expect(shareWizard).not.toMatch(/(?:^|\s)h-11(?:\s|$)/);
		expect(`${landingHero}\n${landingCallToAction}`).not.toContain('h-12 px-5 text-[16px]');
		expect(giftListItem).not.toMatch(
			/<LikeButton[\s\S]*?class="[^"]*\bsize-9\b[^"]*"[\s\S]*?\/>/,
		);
		expect(appCss).toContain(
			".elevation-owner-raised:is(:disabled, [aria-disabled='true'], [data-disabled]) {",
		);
		expect(appCss).toContain('pointer-events: none;');
	});

	it('keeps gift-link hover grouping scoped to the link owners', () => {
		const giftLinkListVariants = readSource(
			'src/lib/components/blocks/gift/gift_link_list_variants.ts',
		);

		expect(giftLinkListVariants).toContain(
			"link: 'group inline-flex max-w-full rounded-full no-underline'",
		);
		expect(giftLinkListVariants).toContain("root: 'flex flex-wrap items-center gap-1.5'");
		expect(giftLinkListVariants).toContain("root: 'flex flex-col gap-2'");
		expect(giftLinkListVariants).not.toContain(
			"root: 'group flex flex-wrap items-center gap-1.5'",
		);
		expect(giftLinkListVariants).not.toContain("root: 'group flex flex-col gap-2'");
	});

	it('uses muted-foreground as the only secondary-text role across source', () => {
		const obsoleteUses = sourceFiles(sourceRoot)
			.filter((path) => !path.endsWith('design_system_contract.test.ts'))
			.flatMap((path) => {
				const obsoleteRolePattern = new RegExp(
					`${['foreground', 'subtle'].join('-')}|${['foreground', 'muted'].join('-')}|${['ink', 'soft'].join('-')}`,
					'g',
				);
				const matches = readFileSync(path, 'utf8').match(obsoleteRolePattern);
				return matches ? [`${relative(sourceRoot, path)}: ${matches.join(', ')}`] : [];
			});

		expect(obsoleteUses).toEqual([]);
	});

	it('renders field help at 12px with muted-foreground ink', () => {
		const classes = helpTextVariants();

		expect(classes).toContain('text-(length:--text-sm)');
		expect(classes).toContain('text-muted-foreground');
	});

	it('keeps Label at 12px semibold with scoped 72% ink', () => {
		const label = readSource('src/lib/components/base/label/Label.svelte');

		expect(label).toContain('text-(length:--text-sm)');
		expect(label).toContain('font-semibold');
		expect(label).toContain('color-mix(in_oklab,var(--foreground)_72%,transparent)');
	});

	it('uses the 22px heading ladder for dialog titles while descriptions stay body copy', () => {
		const title = readSource('src/lib/components/base/dialog/dialog-title.svelte');
		const description = readSource('src/lib/components/base/dialog/dialog-description.svelte');

		expect(title).toContain('font-heading text-2xl');
		expect(title).toContain('font-semibold');
		expect(description).toContain('text-muted-foreground text-sm');
	});
});
