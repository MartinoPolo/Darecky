import { describe, it, expect } from 'vitest';
import { getNotificationEmailBody, NOTIFICATION_TYPE } from './types.js';

/**
 * `RESERVATION_CANCELLED` is dispatched from two different events (issue #213 reuses the type
 * rather than adding one): a BULK revert-to-draft that sweeps every reservation off a list
 * (issue #150), and a SINGLE release of one reservation by a správce/administrator. The email
 * body has to tell those apart, or a gifter reading „the list was unshared" about a list that is
 * still shared has been misinformed.
 *
 * The discriminator is the gift name: a single release always knows which gift it freed, a bulk
 * revert never names one because it cancels across the whole list.
 */
describe('getNotificationEmailBody — reservation cancelled (issue #213)', () => {
	it.each([
		['cs', 'Kávovar'],
		['en', 'Coffee maker'],
	] as const)('names the released gift in %s', (locale, giftName) => {
		const body = getNotificationEmailBody(NOTIFICATION_TYPE.RESERVATION_CANCELLED, locale, {
			giftName,
		});

		expect(body).toContain(giftName);
	});

	it('keeps the bulk revert-to-draft wording when no gift is named', () => {
		const bulkBody = getNotificationEmailBody(
			NOTIFICATION_TYPE.RESERVATION_CANCELLED,
			'cs',
			{},
		);
		const releaseBody = getNotificationEmailBody(
			NOTIFICATION_TYPE.RESERVATION_CANCELLED,
			'cs',
			{
				giftName: 'Kávovar',
			},
		);

		expect(bulkBody).not.toBe(releaseBody);
		// The bulk copy must not fall back to a placeholder gift name — it cancelled many gifts.
		expect(bulkBody).not.toContain('Kávovar');
	});
});
