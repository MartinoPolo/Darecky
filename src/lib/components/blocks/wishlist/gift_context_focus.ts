function isUsableFocusTarget(element: HTMLButtonElement): boolean {
	return (
		element.isConnected &&
		!element.disabled &&
		element.getClientRects().length > 0 &&
		element.closest('[inert], [aria-hidden="true"]') === null
	);
}

/**
 * Resolve the More action for the gift that opened a context surface. Gift ids are
 * compared through dataset values rather than interpolated into a CSS selector.
 */
export function resolveGiftContextFocusTarget(
	originalAnchor: HTMLButtonElement,
	giftId: string,
	root: ParentNode,
): HTMLButtonElement | null {
	if (isUsableFocusTarget(originalAnchor)) {
		return originalAnchor;
	}

	for (const giftItem of root.querySelectorAll<HTMLElement>('[data-gift-item][data-gift-id]')) {
		if (giftItem.dataset.giftId !== giftId) {
			continue;
		}
		for (const candidate of giftItem.querySelectorAll<HTMLButtonElement>(
			'button[data-gift-action="more"]',
		)) {
			if (isUsableFocusTarget(candidate)) {
				return candidate;
			}
		}
	}

	return null;
}
