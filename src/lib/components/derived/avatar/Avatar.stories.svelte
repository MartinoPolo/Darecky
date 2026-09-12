<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Avatar, AVATAR_SHAPES, AVATAR_SIZES } from './index.js';

	const { Story } = defineMeta({
		title: 'Derived/Avatar',
		component: Avatar,
		tags: ['autodocs'],
		argTypes: {
			size: {
				control: 'select',
				options: [...AVATAR_SIZES],
			},
			shape: {
				control: 'select',
				options: [...AVATAR_SHAPES],
			},
		},
	});

	/** Deterministic inline SVG portrait so stories render without network access. */
	function portrait(fill: string): string {
		const doc = `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><rect width='100%' height='100%' fill='${fill}'/><circle cx='48' cy='38' r='16' fill='rgba(255,255,255,0.85)'/><ellipse cx='48' cy='82' rx='26' ry='18' fill='rgba(255,255,255,0.85)'/></svg>`;
		return `data:image/svg+xml,${encodeURIComponent(doc)}`;
	}

	const PHOTO = portrait('#3b5168');
	const PHOTO_WARM = portrait('#8a4b3a');
</script>

<Story name="Image">
	{#snippet template()}
		<Avatar src={PHOTO} alt="Martin Novák" initials="MN" />
	{/snippet}
</Story>

<Story name="Initials fallback">
	{#snippet template()}
		<Avatar src={null} alt="Martin Novák" initials="MN" />
	{/snippet}
</Story>

<Story name="Sizes">
	{#snippet template()}
		<div class="flex items-end gap-4">
			{#each AVATAR_SIZES as size (size)}
				<div class="flex flex-col items-center gap-1">
					<Avatar {size} src={PHOTO} alt="Martin Novák" initials="MN" />
					<span class="text-xs text-muted-foreground">{size}</span>
				</div>
			{/each}
		</div>
	{/snippet}
</Story>

<Story name="Recipient">
	{#snippet template()}
		<div class="flex items-center gap-3">
			<Avatar appearance="recipient" src={PHOTO} alt="Martin Novák" initials="MN" />
			<Avatar appearance="recipient" src={null} alt="Martin Novák" initials="MN" />
		</div>
	{/snippet}
</Story>

<!-- Sticker treatment for header placement: ink border + hard offset shadow. -->
<Story name="Bordered">
	{#snippet template()}
		<div class="flex items-center gap-4">
			<Avatar bordered src={PHOTO_WARM} alt="Jana Dvořáková" initials="JD" />
			<Avatar bordered src={null} alt="Jana Dvořáková" initials="JD" />
		</div>
	{/snippet}
</Story>

<Story name="All Variants">
	{#snippet template()}
		<div
			class="grid items-center gap-x-4 gap-y-3"
			style="grid-template-columns: 6rem repeat({AVATAR_SIZES.length}, minmax(0, 1fr))"
		>
			<div></div>
			{#each AVATAR_SIZES as size (size)}
				<div class="text-center text-xs text-muted-foreground">{size}</div>
			{/each}

			<div class="text-xs text-muted-foreground">image</div>
			{#each AVATAR_SIZES as size (size)}
				<div class="flex justify-center">
					<Avatar {size} src={PHOTO} alt="Martin Novák" initials="MN" />
				</div>
			{/each}

			<div class="text-xs text-muted-foreground">initials</div>
			{#each AVATAR_SIZES as size (size)}
				<div class="flex justify-center">
					<Avatar {size} src={null} alt="Martin Novák" initials="MN" />
				</div>
			{/each}

			<div class="text-xs text-muted-foreground">image / bordered</div>
			{#each AVATAR_SIZES as size (size)}
				<div class="flex justify-center">
					<Avatar {size} bordered src={PHOTO_WARM} alt="Jana Dvořáková" initials="JD" />
				</div>
			{/each}

			<div class="text-xs text-muted-foreground">initials / bordered</div>
			{#each AVATAR_SIZES as size (size)}
				<div class="flex justify-center">
					<Avatar {size} bordered src={null} alt="Jana Dvořáková" initials="JD" />
				</div>
			{/each}
		</div>
	{/snippet}
</Story>
