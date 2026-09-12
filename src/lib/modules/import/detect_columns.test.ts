import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseTabular } from './parse_tabular.js';
import { detectColumns, COLUMN_ROLE } from './detect_columns.js';

describe('detectColumns – sample fixtures', () => {
	it('classifies the clean file and skips the 2 preamble rows', () => {
		const { rows } = parseTabular(
			readFileSync(
				fileURLToPath(new URL('./fixtures/darky_rosie_clean.csv', import.meta.url)),
				'utf-8',
			),
		);
		const result = detectColumns(rows);
		expect(result.headerRowIndex).toBe(2);
		expect(result.dataStartIndex).toBe(3);
		expect(result.skippedPreambleRows).toBe(2);
		expect(result.skippedFooterRows).toBe(0);
		expect(result.columns.map((c) => c.role)).toEqual([
			COLUMN_ROLE.name,
			COLUMN_ROLE.notes,
			COLUMN_ROLE.url,
			COLUMN_ROLE.bool,
		]);
		expect(result.columns[0].headerLabel).toBe('Name');
	});

	it('classifies the dirty file and skips the trailing note row', () => {
		const { rows } = parseTabular(
			readFileSync(
				fileURLToPath(new URL('./fixtures/maggie_dirty.csv', import.meta.url)),
				'utf-8',
			),
		);
		const result = detectColumns(rows);
		expect(result.headerRowIndex).toBe(0);
		expect(result.skippedFooterRows).toBe(1);
		// 4 data rows remain (note row excluded).
		expect(result.dataEndIndex - result.dataStartIndex).toBe(4);
		expect(result.columns.map((c) => c.role)).toEqual([
			COLUMN_ROLE.name,
			COLUMN_ROLE.notes,
			COLUMN_ROLE.url,
			COLUMN_ROLE.bool,
		]);
	});

	it('classifies the messy headerless 2-column file without dropping the link-only last row', () => {
		const { rows } = parseTabular(
			readFileSync(
				fileURLToPath(new URL('./fixtures/rosie_vse_messy.csv', import.meta.url)),
				'utf-8',
			),
		);
		const result = detectColumns(rows);
		expect(result.headerRowIndex).toBeNull();
		// Leading section-header row ("Hračky") is preamble.
		expect(result.skippedPreambleRows).toBe(1);
		// Last row is a valid link-only row – must NOT be trimmed as a footer.
		expect(result.skippedFooterRows).toBe(0);
		expect(result.columns.map((c) => c.role)).toEqual([COLUMN_ROLE.name, COLUMN_ROLE.url]);
	});
});

describe('detectColumns – role heuristics', () => {
	it('detects price columns by value when there is no header', () => {
		const rows = parseTabular(
			'Boty,https://example.com/boty,1 299 Kč\nKniha,https://example.com/k,349',
		).rows;
		const result = detectColumns(rows);
		expect(result.columns.map((c) => c.role)).toEqual([
			COLUMN_ROLE.name,
			COLUMN_ROLE.url,
			COLUMN_ROLE.price,
		]);
	});

	it('honors a price header label even with a Czech name', () => {
		const rows = parseTabular('Název,Cena\nBoty,1299').rows;
		expect(detectColumns(rows).columns.map((c) => c.role)).toEqual([
			COLUMN_ROLE.name,
			COLUMN_ROLE.price,
		]);
	});

	it('maps approved English and Czech image and quantity header aliases', () => {
		for (const imageLabel of ['image', 'image url', 'obrázek', 'foto']) {
			for (const quantityLabel of ['quantity', 'qty', 'počet', 'kusy']) {
				const rows = parseTabular(
					`Name,${imageLabel},${quantityLabel}\nKniha,https://images.example.test/book.jpg,2`,
				).rows;
				expect(detectColumns(rows).columns.map((column) => column.role)).toEqual([
					COLUMN_ROLE.name,
					COLUMN_ROLE.imageUrl,
					COLUMN_ROLE.quantity,
				]);
			}
		}
	});

	it('detects category columns by localized header labels', () => {
		const rows = parseTabular('Název,Kategorie\nKostky,Hračky\nKniha,Knihy').rows;
		expect(detectColumns(rows).columns.map((c) => c.role)).toEqual([
			COLUMN_ROLE.name,
			COLUMN_ROLE.category,
		]);
	});

	it('detects boolean status columns by TRUE/FALSE values', () => {
		const rows = parseTabular('Boty,TRUE\nKniha,FALSE\nHrnek,FALSE').rows;
		expect(detectColumns(rows).columns.map((c) => c.role)).toEqual([
			COLUMN_ROLE.name,
			COLUMN_ROLE.bool,
		]);
	});

	it('treats a URL column with a few non-URL values as url (does not crash on outliers)', () => {
		const rows = parseTabular(
			'Svetr,Mají i v HM nebo Lindex\nBoty,https://a.example.com\nKniha,https://b.example.com\nHrnek,https://c.example.com',
		).rows;
		expect(detectColumns(rows).columns.map((c) => c.role)).toEqual([
			COLUMN_ROLE.name,
			COLUMN_ROLE.url,
		]);
	});

	it('assigns the first free-text column to name and later ones to notes', () => {
		const rows = parseTabular('Boty,kožené hnědé,velikost 42\nKniha,sci-fi,brožovaná').rows;
		expect(detectColumns(rows).columns.map((c) => c.role)).toEqual([
			COLUMN_ROLE.name,
			COLUMN_ROLE.notes,
			COLUMN_ROLE.notes,
		]);
	});

	it('returns an empty result for no rows', () => {
		expect(detectColumns([])).toEqual({
			headerRowIndex: null,
			dataStartIndex: 0,
			dataEndIndex: 0,
			skippedPreambleRows: 0,
			skippedFooterRows: 0,
			columns: [],
		});
	});
});
