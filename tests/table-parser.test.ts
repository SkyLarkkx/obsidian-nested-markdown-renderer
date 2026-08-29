import { strict as assert } from 'node:assert';
import test from 'node:test';

import { Text } from '@codemirror/state';

import {
	indentationColumns,
	scanIndentedTables,
	splitTableCells,
} from '../src/table-parser';

void test('counts tabs using editor tab stops', () => {
	assert.equal(indentationColumns('\t'), 4);
	assert.equal(indentationColumns(' \t'), 4);
	assert.equal(indentationColumns('\t  '), 6);
});

void test('parses optional outer pipes and escaped pipes', () => {
	assert.deepEqual(splitTableCells('| A | B |'), ['A', 'B']);
	assert.deepEqual(splitTableCells('| A | B'), ['A', 'B']);
	assert.deepEqual(splitTableCells('A | B |'), ['A', 'B']);
	assert.deepEqual(splitTableCells('A | B'), ['A', 'B']);
	assert.deepEqual(splitTableCells('| A\\|B | C |'), ['A\\|B', 'C']);
	assert.deepEqual(splitTableCells('| A |'), ['A']);
	assert.equal(splitTableCells('plain text'), null);
});

void test('finds a nested table and dedents markdown', () => {
	const doc = Text.of([
		'- Comparison',
		'',
		'\tFeature | Result',
		'\t:--- | ---:',
		'\tA\\|B | 100',
		'',
		'- End',
	]);

	const tables = scanIndentedTables(doc);
	assert.equal(tables.length, 1);
	assert.equal(tables[0]?.indentColumns, 4);
	assert.equal(
		tables[0]?.markdown,
		'Feature | Result\n:--- | ---:\nA\\|B | 100',
	);
});

void test('supports a single-column table with explicit outer pipes', () => {
	const doc = Text.of([
		'- Values',
		'',
		'  | Value |',
		'  | --- |',
		'  | one |',
	]);

	assert.equal(scanIndentedTables(doc).length, 1);
});

void test('rejects mismatched columns and non-list indentation', () => {
	const mismatched = Text.of([
		'- Broken',
		'',
		'\t| A | B | C |',
		'\t| --- | --- |',
		'\t| 1 | 2 | 3 |',
	]);
	const noListParent = Text.of([
		'Paragraph',
		'',
		'    | A | B |',
		'    | --- | --- |',
		'    | 1 | 2 |',
	]);

	assert.equal(scanIndentedTables(mismatched).length, 0);
	assert.equal(scanIndentedTables(noListParent).length, 0);
});

void test('ignores table-shaped text inside fenced code', () => {
	const doc = Text.of([
		'- Example',
		'',
		'\t```text',
		'\t| A | B |',
		'\t| --- | --- |',
		'\t| 1 | 2 |',
		'\t```',
	]);

	assert.equal(scanIndentedTables(doc).length, 0);
});
