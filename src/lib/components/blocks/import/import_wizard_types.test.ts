import { describe, it, expect } from 'vitest';
import { COLUMN_ROLE, type DetectedColumn } from '$lib/modules/import/detect_columns.js';
import { normalizeColumnRoles } from './import_wizard_types.js';

function column(index: number, role: DetectedColumn['role']): DetectedColumn {
	return { index, role, headerLabel: null };
}

describe('normalizeColumnRoles', () => {
	it('demotes a duplicated single-use role to ignore, keeping the first column', () => {
		const result = normalizeColumnRoles([
			column(0, COLUMN_ROLE.name),
			column(1, COLUMN_ROLE.notes),
			column(2, COLUMN_ROLE.notes),
		]);
		expect(result.map((c) => c.role)).toEqual([
			COLUMN_ROLE.name,
			COLUMN_ROLE.notes,
			COLUMN_ROLE.ignore,
		]);
	});

	it('leaves multiple url columns intact (links aggregate, not single-use)', () => {
		const result = normalizeColumnRoles([
			column(0, COLUMN_ROLE.name),
			column(1, COLUMN_ROLE.url),
			column(2, COLUMN_ROLE.url),
		]);
		expect(result.map((c) => c.role)).toEqual([
			COLUMN_ROLE.name,
			COLUMN_ROLE.url,
			COLUMN_ROLE.url,
		]);
	});

	it('leaves bool and ignore columns untouched', () => {
		const result = normalizeColumnRoles([
			column(0, COLUMN_ROLE.bool),
			column(1, COLUMN_ROLE.bool),
			column(2, COLUMN_ROLE.ignore),
		]);
		expect(result.map((c) => c.role)).toEqual([
			COLUMN_ROLE.bool,
			COLUMN_ROLE.bool,
			COLUMN_ROLE.ignore,
		]);
	});

	it('is idempotent', () => {
		const input = [
			column(0, COLUMN_ROLE.name),
			column(1, COLUMN_ROLE.price),
			column(2, COLUMN_ROLE.price),
		];
		const once = normalizeColumnRoles(input);
		const twice = normalizeColumnRoles(once);
		expect(twice).toEqual(once);
	});
});
