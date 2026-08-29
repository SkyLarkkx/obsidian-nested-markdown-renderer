import type { Text } from '@codemirror/state';

import type { FenceMarker, ParsedTableRow, TableBlock } from './types';

const TABLE_SEPARATOR_CELL_RE = /^:?-{3,}:?$/;
const LIST_ITEM_RE = /^[ \t]*(?:[-+*]|\d+[.)])\s+/;

export function indentationColumns(text: string, tabSize = 4): number {
	let columns = 0;
	for (const char of text) {
		if (char === ' ') {
			columns += 1;
		} else if (char === '\t') {
			columns += tabSize - (columns % tabSize);
		} else {
			break;
		}
	}
	return columns;
}

function isEscaped(text: string, index: number): boolean {
	let backslashes = 0;
	for (
		let cursor = index - 1;
		cursor >= 0 && text.charAt(cursor) === '\\';
		cursor -= 1
	) {
		backslashes += 1;
	}
	return backslashes % 2 === 1;
}

export function splitTableCells(content: string): string[] | null {
	let source = content.trim();
	if (!source) return null;

	const hasLeadingPipe = source.startsWith('|');
	const hasTrailingPipe =
		source.endsWith('|') && !isEscaped(source, source.length - 1);
	if (hasLeadingPipe) source = source.slice(1);
	if (hasTrailingPipe) source = source.slice(0, -1);

	const cells: string[] = [];
	let cell = '';
	let foundSeparator = false;
	for (let index = 0; index < source.length; index += 1) {
		const char = source.charAt(index);
		if (char === '|' && !isEscaped(source, index)) {
			cells.push(cell.trim());
			cell = '';
			foundSeparator = true;
		} else {
			cell += char;
		}
	}

	if (!foundSeparator) {
		return hasLeadingPipe && hasTrailingPipe ? [source.trim()] : null;
	}
	cells.push(cell.trim());
	return cells;
}

export function parseIndentedTableRow(text: string): ParsedTableRow | null {
	const match = text.match(/^([ \t]+)(.*)$/);
	const indent = match?.[1];
	const content = match?.[2];
	if (indent === undefined || content === undefined) return null;

	const cells = splitTableCells(content);
	return cells ? { indent, cells } : null;
}

function isTableSeparator(row: ParsedTableRow): boolean {
	return row.cells.every((cell) => TABLE_SEPARATOR_CELL_RE.test(cell));
}

function fenceMarker(text: string): FenceMarker | null {
	const marker = text.match(/^[ \t]*(`{3,}|~{3,})/)?.[1];
	if (!marker) return null;
	return { char: marker.charAt(0), length: marker.length };
}

function closesFence(text: string, fence: FenceMarker): boolean {
	const trimmed = text.trim();
	return (
		trimmed.length >= fence.length &&
		Array.from(trimmed).every((char) => char === fence.char)
	);
}

function hasListParent(
	doc: Text,
	lineNumber: number,
	childIndent: number,
): boolean {
	for (let number = lineNumber - 1; number >= 1; number -= 1) {
		const text = doc.line(number).text;
		if (!text.trim()) continue;
		if (indentationColumns(text) >= childIndent) continue;
		return LIST_ITEM_RE.test(text);
	}
	return false;
}

export function scanIndentedTables(doc: Text): TableBlock[] {
	const tables: TableBlock[] = [];
	let fence: FenceMarker | null = null;

	for (let number = 1; number <= doc.lines; number += 1) {
		const line = doc.line(number);

		if (fence) {
			if (closesFence(line.text, fence)) fence = null;
			continue;
		}

		const openingFence = fenceMarker(line.text);
		if (openingFence) {
			fence = openingFence;
			continue;
		}

		if (number === doc.lines) continue;
		const header = parseIndentedTableRow(line.text);
		if (!header) continue;

		const separatorRow = parseIndentedTableRow(doc.line(number + 1).text);
		if (
			!separatorRow ||
			separatorRow.indent !== header.indent ||
			separatorRow.cells.length !== header.cells.length ||
			!isTableSeparator(separatorRow)
		) {
			continue;
		}

		const indent = header.indent;
		const indentWidth = indentationColumns(indent);
		if (!hasListParent(doc, number, indentWidth)) continue;

		let endLine = number + 1;
		while (endLine < doc.lines) {
			const row = parseIndentedTableRow(doc.line(endLine + 1).text);
			if (!row || row.indent !== indent) break;
			endLine += 1;
		}

		const markdown: string[] = [];
		for (let row = number; row <= endLine; row += 1) {
			markdown.push(doc.line(row).text.slice(indent.length));
		}

			tables.push({
				startLine: number,
				endLine,
				from: line.from,
				contentFrom: line.from + indent.length,
				to: doc.line(endLine).to,
			indentColumns: indentWidth,
			markdown: markdown.join('\n'),
		});
		number = endLine;
	}

	return tables;
}
