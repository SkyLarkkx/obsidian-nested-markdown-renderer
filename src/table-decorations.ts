import type { Range } from '@codemirror/state';
import type { EditorSelection } from '@codemirror/state';
import {
	Decoration,
	type DecorationSet,
	type EditorView,
} from '@codemirror/view';
import type { App } from 'obsidian';

import { isLivePreview, sourcePath } from './live-preview';
import { NestedTableWidget } from './table-widget';
import type { TableBlock } from './types';

function selectionOverlaps(
	selection: EditorSelection,
	from: number,
	to: number,
): boolean {
	return selection.ranges.some(
		(range) => range.from <= to && range.to >= from,
	);
}

export function buildTableDecorations(
	view: EditorView,
	app: App,
	tables: TableBlock[],
): DecorationSet {
	if (!isLivePreview(view)) return Decoration.none;

	const path = sourcePath(view);
	const ranges: Range<Decoration>[] = [];
	for (const table of tables) {
		if (selectionOverlaps(view.state.selection, table.from, table.to)) {
			continue;
		}

		ranges.push(
			Decoration.replace({
				widget: new NestedTableWidget(app, table, path),
			}).range(table.from, view.state.doc.line(table.startLine).to),
		);
		ranges.push(
			Decoration.line({
				class: 'nmr-table-host-line',
				attributes: {
					style: `--nmr-table-indent: ${table.indentColumns}ch`,
				},
			}).range(table.from),
		);

		for (
			let number = table.startLine + 1;
			number <= table.endLine;
			number += 1
		) {
			ranges.push(
				Decoration.line({ class: 'nmr-hidden-table-line' }).range(
					view.state.doc.line(number).from,
				),
			);
		}
	}

	return Decoration.set(ranges, true);
}
