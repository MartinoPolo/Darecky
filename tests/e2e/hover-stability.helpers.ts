import {
	expect,
	chromium,
	type BrowserContext,
	type Locator,
	type Page,
	type TestInfo,
} from '@playwright/test';
import { rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCookiesForContext } from './fixtures/auth-helpers.js';

export const DEPTHS = ['soft', 'ink', 'black'] as const;
export const BROWSER_ZOOMS = [1, 1.25, 1.5] as const;
const EXTENSION_PATH = resolve(
	dirname(fileURLToPath(import.meta.url)),
	'fixtures/browser-zoom-extension',
);

interface PointerSample {
	time: number;
	hovered: boolean;
	reachable: boolean;
	y: number;
	translateY: number;
}

interface HoverEventDetail {
	type: string;
	time: number;
	clientX: number;
	clientY: number;
	relatedTarget: string | null;
	hitTarget: string | null;
	focusTarget: string | null;
	documentFocused: boolean;
	visibility: DocumentVisibilityState;
}

interface HoverEventEvidence {
	enter: number;
	leave: number;
	over: number;
	out: number;
	details: HoverEventDetail[];
}

export interface StationaryEvidence {
	control: string;
	coordinate: { x: number; y: number };
	restingRect: { x: number; y: number; width: number; height: number };
	pseudoAfter: { content: string; height: number; top: string };
	entryEvents: HoverEventEvidence;
	events: HoverEventEvidence;
	lowerBoundaryReachable: boolean;
	hoverTransitions: number;
	verticalTravel: number;
	samples: PointerSample[];
}

export async function launchZoomableContext(
	testInfo: TestInfo,
	rawCookies: string[],
	baseURL: string,
): Promise<BrowserContext> {
	const profile = testInfo.outputPath('chromium-profile');
	await rm(profile, { recursive: true, force: true });
	const context = await chromium.launchPersistentContext(profile, {
		// Isolated exception: bundled Chromium retains unpacked-extension flags that Chrome removed.
		channel: 'chromium',
		headless: true,
		viewport: { width: 1602, height: 1100 },
		deviceScaleFactor: 2,
		args: [
			`--disable-extensions-except=${EXTENSION_PATH}`,
			`--load-extension=${EXTENSION_PATH}`,
			'--window-size=1602,1100',
		],
	});
	await context.addCookies(parseCookiesForContext(rawCookies, baseURL));
	return context;
}

export async function setRealBrowserZoom(
	page: Page,
	baseURL: string,
	zoom: number,
	baseline: { dpr: number; innerWidth: number } | null,
) {
	await page.goto(`${baseURL}/w/xmas2026?browserZoom=${zoom}`, {
		waitUntil: 'load',
	});
	await expect(page.getByTestId('wishlist-toolbar')).toBeVisible();

	await expect
		.poll(() => page.evaluate(() => window.devicePixelRatio))
		.toBeCloseTo((baseline?.dpr ?? 2) * zoom, 1);

	const metrics = await page.evaluate(() => ({
		dpr: window.devicePixelRatio,
		innerWidth: window.innerWidth,
		outerWidth: window.outerWidth,
	}));
	if (baseline !== null) {
		expect(metrics.innerWidth, 'browser zoom must shrink the CSS layout viewport').toBeCloseTo(
			baseline.innerWidth / zoom,
			-1,
		);
	}
	return metrics;
}

async function prepareRestingControl(page: Page, control: Locator) {
	await page.mouse.move(1, 1);
	await expect(control).toBeVisible();
	await control.scrollIntoViewIfNeeded();
	await page.evaluate(() => document.fonts.ready.then(() => undefined));
	await expect
		.poll(() =>
			control.evaluate((element) => {
				const animations = element.getAnimations({ subtree: true });
				for (
					let ancestor = element.parentElement;
					ancestor;
					ancestor = ancestor.parentElement
				) {
					animations.push(...ancestor.getAnimations());
				}
				return animations.filter(
					(animation) =>
						animation.playState !== 'finished' &&
						animation.playState !== 'idle' &&
						animation.effect?.getComputedTiming().endTime !== Infinity,
				).length;
			}),
		)
		.toBe(0);
}

export async function stationaryLowerEdge(
	page: Page,
	control: Locator,
	controlName: string,
): Promise<StationaryEvidence> {
	await prepareRestingControl(page, control);
	const box = await control.boundingBox();
	expect(box).not.toBeNull();
	const restingAfter = await control.evaluate((element) => {
		const after = getComputedStyle(element, '::after');
		return {
			content: after.content,
			height: after.content === 'none' ? 0 : Number.parseFloat(after.height) || 0,
			top: after.top,
		};
	});
	const ordinaryShadowOffset = await control.evaluate((element) =>
		Number.parseFloat(
			getComputedStyle(element).getPropertyValue('--elevation-ordinary-offset'),
		),
	);
	const coordinate = {
		x: box!.x + box!.width / 2,
		// This is the reported lower edge of the resting hard shadow, not merely
		// the DOM border. It is where subpixel rounding exposes the moving buffer.
		y: box!.y + box!.height + ordinaryShadowOffset - 0.25,
	};

	await control.evaluate((element) => {
		type ProbeState = HoverEventEvidence & { startedAt: number };
		type ProbeElement = Element & {
			__hoverProbe?: ProbeState;
			__hoverProbeInstalled?: boolean;
		};
		const probed = element as ProbeElement;
		probed.__hoverProbe = {
			enter: 0,
			leave: 0,
			over: 0,
			out: 0,
			details: [],
			startedAt: performance.now(),
		};
		if (probed.__hoverProbeInstalled === true) {
			return;
		}
		probed.__hoverProbeInstalled = true;
		const describeTarget = (target: EventTarget | null) => {
			if (!(target instanceof Element)) {
				return null;
			}
			return `${target.tagName.toLowerCase()}${target.id ? `#${target.id}` : ''}${
				target.classList.length > 0 ? `.${[...target.classList].slice(0, 3).join('.')}` : ''
			}`;
		};
		for (const [eventName, key] of [
			['mouseenter', 'enter'],
			['mouseleave', 'leave'],
			['mouseover', 'over'],
			['mouseout', 'out'],
		] as const) {
			element.addEventListener(eventName, (event) => {
				const state = probed.__hoverProbe!;
				const mouseEvent = event as MouseEvent;
				state[key] += 1;
				if (state.details.length < 16) {
					state.details.push({
						type: eventName,
						time: performance.now() - state.startedAt,
						clientX: mouseEvent.clientX,
						clientY: mouseEvent.clientY,
						relatedTarget: describeTarget(mouseEvent.relatedTarget),
						hitTarget: describeTarget(
							document.elementFromPoint(mouseEvent.clientX, mouseEvent.clientY),
						),
						focusTarget: describeTarget(document.activeElement),
						documentFocused: document.hasFocus(),
						visibility: document.visibilityState,
					});
				}
			});
		}
	});

	const lowerBoundaryReachable = await control.evaluate((element, point) => {
		const target = document.elementFromPoint(point.x, point.y);
		return target !== null && (target === element || element.contains(target));
	}, coordinate);
	expect(lowerBoundaryReachable, `${controlName} resting lower boundary is reachable`).toBe(true);
	await page.mouse.move(coordinate.x, coordinate.y);
	const measurement = await control.evaluate(async (element, point) => {
		type ProbeState = HoverEventEvidence & { startedAt: number };
		type ProbeElement = Element & { __hoverProbe?: ProbeState };
		await new Promise<void>((resolveFrame) =>
			requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame())),
		);
		const state = (element as ProbeElement).__hoverProbe!;
		const entryEvents = { ...state, details: [...state.details] };
		const initiallyHovered = element.matches(':hover');
		state.enter = 0;
		state.leave = 0;
		state.over = 0;
		state.out = 0;
		state.details = [];
		state.startedAt = performance.now();
		const frames: PointerSample[] = [];
		const start = performance.now();
		do {
			await new Promise<void>((resolveFrame) => requestAnimationFrame(() => resolveFrame()));
			const style = getComputedStyle(element);
			const [, translateY = '0'] = style.translate.split(' ');
			const target = document.elementFromPoint(point.x, point.y);
			frames.push({
				reachable: target !== null && (target === element || element.contains(target)),
				time: performance.now() - start,
				hovered: element.matches(':hover'),
				y: element.getBoundingClientRect().y,
				translateY: Number.parseFloat(translateY) || 0,
			});
		} while (performance.now() - start < 650);
		return {
			entryEvents,
			initiallyHovered,
			samples: frames,
			events: { ...state, details: [...state.details] },
		};
	}, coordinate);
	const { samples, events, entryEvents } = measurement;
	expect(entryEvents.enter, `${controlName} pointer entry must enter once`).toBe(1);
	expect(entryEvents.leave, `${controlName} pointer entry must not leave`).toBe(0);
	expect(entryEvents.out, `${controlName} pointer entry must not move out`).toBe(0);
	expect(measurement.initiallyHovered, `${controlName} starts stationary sampling hovered`).toBe(
		true,
	);
	expect(
		samples.every(({ reachable }) => reachable),
		`${controlName} lower boundary stays reachable throughout motion`,
	).toBe(true);

	const hoverTransitions = samples.slice(1).filter((sample, index) => {
		return sample.hovered !== samples[index]!.hovered;
	}).length;
	const positions = samples.map(({ y }) => y);

	return {
		control: controlName,
		coordinate,
		restingRect: box!,
		entryEvents,
		events,
		pseudoAfter: restingAfter,
		lowerBoundaryReachable,
		hoverTransitions,
		verticalTravel: Math.max(...positions) - Math.min(...positions),
		samples,
	};
}

export async function bottomToTopSweep(page: Page, control: Locator, controlName: string) {
	await prepareRestingControl(page, control);
	const box = await control.boundingBox();
	expect(box).not.toBeNull();
	const afterHeight = await control.evaluate((element) => {
		const style = getComputedStyle(element, '::after');
		return style.content === 'none' ? 0 : Number.parseFloat(style.height) || 0;
	});
	const ordinaryOffset = await control.evaluate((element) =>
		Number.parseFloat(
			getComputedStyle(element).getPropertyValue('--elevation-ordinary-offset'),
		),
	);
	const x = box!.x + box!.width / 2;
	const lowerBoundary = box!.y + box!.height + ordinaryOffset - 0.25;
	const lowerBoundaryReachable = await control.evaluate(
		(element, point) => {
			const target = document.elementFromPoint(point.x, point.y);
			return target !== null && (target === element || element.contains(target));
		},
		{ x, y: lowerBoundary },
	);
	expect(lowerBoundaryReachable, `${controlName} resting shadow edge is reachable`).toBe(true);
	const states: Array<{ y: number; hovered: boolean }> = [];
	for (let y = lowerBoundary; y >= box!.y + 0.5; y -= 1) {
		await page.mouse.move(x, y);
		const hovered = await control.evaluate(async (element) => {
			await new Promise<void>((resolveFrame) => requestAnimationFrame(() => resolveFrame()));
			return element.matches(':hover');
		});
		states.push({ y, hovered });
	}
	const interveningUnhovered = states.filter(({ hovered }) => !hovered);
	return {
		control: controlName,
		restingRect: box!,
		afterHeight,
		lowerBoundary,
		lowerBoundaryReachable,
		states,
		interveningUnhovered,
	};
}

export function expectNoStationaryTransitions(evidence: StationaryEvidence, scenario = '') {
	for (const eventName of ['enter', 'leave', 'over', 'out'] as const) {
		expect(
			evidence.events[eventName],
			`${evidence.control} must have no stationary ${eventName} event${scenario}`,
		).toBe(0);
	}
}

export function expectStableLift(evidence: StationaryEvidence, hoverScale = 1) {
	expectNoStationaryTransitions(evidence);
	expect(evidence.hoverTransitions).toBe(0);
	expect(evidence.samples.every(({ hovered }) => hovered)).toBe(true);
	expect(evidence.verticalTravel).toBeLessThanOrEqual(
		2.25 + (evidence.restingRect.height * (hoverScale - 1)) / 2,
	);
	const positions = evidence.samples.map(({ y }) => y);
	for (let index = 1; index < positions.length; index += 1) {
		expect(positions[index]! - positions[index - 1]!).toBeLessThanOrEqual(0.05);
	}
}

export async function expectReachable(control: Locator) {
	await expect(control).toBeVisible();
	await control.hover();
	expect(
		await control.evaluate((element) => {
			const box = element.getBoundingClientRect();
			const target = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
			return target !== null && (element === target || element.contains(target));
		}),
	).toBe(true);
	await control.click({ trial: true });
}

export async function expectSafeClick(page: Page, control: Locator) {
	await expectReachable(control);
	const url = page.url();
	await control.evaluate((element) => {
		element.addEventListener(
			'click',
			(event) => {
				event.preventDefault();
				event.stopImmediatePropagation();
				element.setAttribute('data-hover-probe-clicked', 'true');
			},
			{ capture: true, once: true },
		);
	});
	await control.click();
	await expect(control).toHaveAttribute('data-hover-probe-clicked', 'true');
	expect(page.url()).toBe(url);
}
