import { describe, expect, it } from 'vitest';
import { renderActionEmail, renderActionEmailText } from './email.js';

describe('action email rendering', () => {
	it('escapes user-controlled HTML in the HTML body', () => {
		expect.assertions(3);

		const html = renderActionEmail({
			heading: 'Gift reserved',
			body: 'Wishlist: <img src=x onerror=alert(1)>',
			buttonLabel: 'Open wishlist',
			url: 'https://prejemesi.cz/w/test?x="bad"',
		});

		expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
		expect(html).toContain('https://prejemesi.cz/w/test?x=&quot;bad&quot;');
		expect(html).not.toContain('<img src=x onerror=alert(1)>');
	});

	it('renders a plain-text alternative', () => {
		expect.assertions(1);

		const text = renderActionEmailText({
			heading: 'Sign in',
			body: 'Use this one-time link.',
			buttonLabel: 'Sign in',
			url: 'https://prejemesi.cz/magic',
		});

		expect(text).toContain('Sign in: https://prejemesi.cz/magic');
	});

	// issue #206: the unsubscribe footer is opt-in per call so auth emails
	// (verify/reset) never render it, while notification emails do.
	describe('unsubscribe footer (issue #206)', () => {
		const baseParams = {
			heading: 'Gift reserved',
			body: 'Someone reserved a gift.',
			buttonLabel: 'Open wishlist',
			url: 'https://prejemesi.cz/w/test',
		};

		it('omits the footer from the HTML when no footer params are given (auth emails)', () => {
			expect.assertions(1);

			const html = renderActionEmail(baseParams);

			expect(html).not.toContain('unsubscribe');
		});

		it('omits the footer from the plain text when no footer params are given (auth emails)', () => {
			expect.assertions(1);

			const text = renderActionEmailText(baseParams);

			expect(text).not.toContain('unsubscribe');
		});

		it('renders the footer text and unsubscribe link in the HTML when provided', () => {
			expect.assertions(2);

			const html = renderActionEmail({
				...baseParams,
				footerText: 'Do not want these emails?',
				unsubscribeUrl: 'https://prejemesi.cz/unsubscribe?token=abc',
				unsubscribeLabel: 'Manage notifications',
			});

			expect(html).toContain('Do not want these emails?');
			expect(html).toContain('https://prejemesi.cz/unsubscribe?token=abc');
		});

		it('escapes the footer text and unsubscribe URL in the HTML', () => {
			expect.assertions(1);

			const html = renderActionEmail({
				...baseParams,
				footerText: '<script>alert(1)</script>',
				unsubscribeUrl: 'https://prejemesi.cz/unsubscribe?token=abc',
			});

			expect(html).not.toContain('<script>alert(1)</script>');
		});

		it('appends the footer text and unsubscribe URL to the plain-text version when provided', () => {
			expect.assertions(2);

			const text = renderActionEmailText({
				...baseParams,
				footerText: 'Do not want these emails?',
				unsubscribeUrl: 'https://prejemesi.cz/unsubscribe?token=abc',
			});

			expect(text).toContain('Do not want these emails?');
			expect(text).toContain('https://prejemesi.cz/unsubscribe?token=abc');
		});
	});
});
