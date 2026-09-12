import { describe, it, expect } from 'vitest';
import { buildDraftRows } from '$lib/modules/import/import_draft_builder.js';
import { detectColumns } from '$lib/modules/import/detect_columns.js';
import {
	createDraftGridRow,
	rowToDraft,
} from '$lib/components/blocks/gift-draft-grid/gift_draft_grid_model.js';
import { validateDraft } from '$lib/modules/gifts/gift_draft.js';

describe('ImportReviewStep: editable draft grid seeding', () => {
	const headerRow = ['Name', 'Notes', 'Price', 'Link'];
	const dataRows = [
		['PlayStation 5', 'Digital edition', '12990 Kc', 'https://alza.cz/ps5'],
		['', 'just notes', '500', 'https://example.com/gift'],
		['Kniha', '', '', ''],
	];

	const detected = detectColumns([headerRow, ...dataRows]);
	const drafts = buildDraftRows(dataRows, detected.columns);

	it('produces GiftDraft[] that createDraftGridRow accepts', () => {
		const rows = drafts.map((d) => createDraftGridRow(d, { pristine: false }));
		expect(rows).toHaveLength(3);
		expect(rows[0].name).toBe('PlayStation 5');
		expect(rows[0].links).toHaveLength(1);
		expect(rows[0].links[0].url).toBe('https://alza.cz/ps5');
	});

	it('blank-name rows become committable after editing name in the grid', () => {
		const blankRow = createDraftGridRow(drafts[1], { pristine: false });
		expect(blankRow.name).toBe('');
		// Simulate user editing name
		blankRow.name = 'My Gift';
		const draft = rowToDraft(blankRow);
		const { valid } = validateDraft(draft);
		expect(valid).toBe(true);
		expect(draft.name).toBe('My Gift');
	});
});
