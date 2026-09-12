<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, userEvent, within } from 'storybook/test';
	import { Tabs } from './index.js';

	const { Story } = defineMeta({
		title: 'Base/Tabs',
		component: Tabs,
		tags: ['autodocs'],
	});

	const playTabSwitchToSecond = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const tabs = canvas.getAllByRole('tab');

		// Initial state – first tab active
		await expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

		// Click second tab
		await userEvent.click(tabs[1]);
		await expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
		await expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
	};

	const playKeyboardActivation = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const tabs = canvas.getAllByRole('tab');

		// Initial state
		await expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

		// Focus second tab and press Enter
		tabs[1].focus();
		await userEvent.keyboard('{Enter}');
		await expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
		await expect(tabs[0]).toHaveAttribute('aria-selected', 'false');

		// Focus third tab and press Space
		tabs[2].focus();
		await userEvent.keyboard(' ');
		await expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
		await expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
	};

	const playDisabledTabIgnored = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const tabs = canvas.getAllByRole('tab');

		// First tab starts active
		await expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

		// Click disabled tab (third tab in "With Disabled Tab" story)
		await userEvent.click(tabs[2]);

		// First tab should remain active – disabled tab should not activate
		await expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
		await expect(tabs[2]).toHaveAttribute('aria-selected', 'false');
	};
</script>

<script lang="ts">
	import { Tab } from './index.js';
	import { Badge } from '$lib/components/base/badge/index.js';
	import StoryKeyboardHints from '$lib/storybook/StoryKeyboardHints.svelte';
	import KeyboardHint from '$lib/storybook/KeyboardHint.svelte';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import UserIcon from '@lucide/svelte/icons/user';
	import BellIcon from '@lucide/svelte/icons/bell';

	let defaultActive = $state('Overview');
	let iconsActive = $state('Profile');
	let disabledActive = $state('Active');
	let badgeActive = $state('Inbox');
	let manyActive = $state('Day');
</script>

<Story name="Default [play: tab switch second]" play={playTabSwitchToSecond}>
	{#snippet template()}
		<Tabs>
			<Tab active={defaultActive === 'Overview'} onclick={() => (defaultActive = 'Overview')}
				>Overview</Tab
			>
			<Tab active={defaultActive === 'Activity'} onclick={() => (defaultActive = 'Activity')}
				>Activity</Tab
			>
			<Tab active={defaultActive === 'Settings'} onclick={() => (defaultActive = 'Settings')}
				>Settings</Tab
			>
		</Tabs>
	{/snippet}
</Story>

<Story name="With Icons">
	{#snippet template()}
		<Tabs>
			<Tab active={iconsActive === 'Profile'} onclick={() => (iconsActive = 'Profile')}
				><UserIcon class="size-3.5" /> Profile</Tab
			>
			<Tab
				active={iconsActive === 'Notifications'}
				onclick={() => (iconsActive = 'Notifications')}
				><BellIcon class="size-3.5" /> Notifications</Tab
			>
			<Tab active={iconsActive === 'Settings'} onclick={() => (iconsActive = 'Settings')}
				><SettingsIcon class="size-3.5" /> Settings</Tab
			>
		</Tabs>
	{/snippet}
</Story>

<Story name="With Disabled Tab [play: disabled tab ignored]" play={playDisabledTabIgnored}>
	{#snippet template()}
		<Tabs>
			<Tab active={disabledActive === 'Active'} onclick={() => (disabledActive = 'Active')}
				>Active</Tab
			>
			<Tab active={disabledActive === 'Normal'} onclick={() => (disabledActive = 'Normal')}
				>Normal</Tab
			>
			<Tab disabled>Disabled</Tab>
		</Tabs>
	{/snippet}
</Story>

<Story name="With Badge [play: keyboard activation]" play={playKeyboardActivation}>
	{#snippet template()}
		<div>
			<StoryKeyboardHints>
				<KeyboardHint keys="Enter / Space" action="Activate focused tab" />
				<KeyboardHint keys="→ / ←" action="Move focus between tabs" />
			</StoryKeyboardHints>
			<Tabs>
				<Tab active={badgeActive === 'Inbox'} onclick={() => (badgeActive = 'Inbox')}
					>Inbox <Badge tone="primary" class="ml-1.5">3</Badge></Tab
				>
				<Tab active={badgeActive === 'Drafts'} onclick={() => (badgeActive = 'Drafts')}
					>Drafts</Tab
				>
				<Tab active={badgeActive === 'Archive'} onclick={() => (badgeActive = 'Archive')}
					>Archive</Tab
				>
			</Tabs>
		</div>
	{/snippet}
</Story>

<Story name="Many Tabs">
	{#snippet template()}
		<Tabs>
			<Tab active={manyActive === 'Day'} onclick={() => (manyActive = 'Day')}>Day</Tab>
			<Tab active={manyActive === 'Week'} onclick={() => (manyActive = 'Week')}>Week</Tab>
			<Tab active={manyActive === 'Month'} onclick={() => (manyActive = 'Month')}>Month</Tab>
			<Tab active={manyActive === 'Quarter'} onclick={() => (manyActive = 'Quarter')}
				>Quarter</Tab
			>
			<Tab active={manyActive === 'Year'} onclick={() => (manyActive = 'Year')}>Year</Tab>
		</Tabs>
	{/snippet}
</Story>
