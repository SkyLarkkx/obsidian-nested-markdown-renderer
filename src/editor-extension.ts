import type { Extension } from '@codemirror/state';
import {
	Decoration,
	type DecorationSet,
	type EditorView,
	type PluginValue,
	ViewPlugin,
	type ViewUpdate,
} from '@codemirror/view';
import type { App } from 'obsidian';

import { CalloutRepairer } from './callout-repairer';
import { didLivePreviewChange } from './live-preview';
import { scanIndentedTables } from './table-parser';
import { buildTableDecorations } from './table-decorations';
import type { TableBlock } from './types';

class NestedMarkdownViewPlugin implements PluginValue {
	decorations: DecorationSet = Decoration.none;

	private tables: TableBlock[];
	private readonly calloutRepairer: CalloutRepairer;

	constructor(
		private readonly view: EditorView,
		private readonly app: App,
	) {
		this.tables = scanIndentedTables(view.state.doc);
		this.decorations = buildTableDecorations(view, app, this.tables);
		this.calloutRepairer = new CalloutRepairer(view, app);
	}

	update(update: ViewUpdate): void {
		if (update.docChanged) {
			this.tables = scanIndentedTables(update.state.doc);
		}

		if (
			update.docChanged ||
			update.selectionSet ||
			update.viewportChanged ||
			didLivePreviewChange(update)
		) {
			this.decorations = buildTableDecorations(
				update.view,
				this.app,
				this.tables,
			);
		}
		this.calloutRepairer.schedule();
	}

	destroy(): void {
		this.calloutRepairer.destroy();
	}
}

export function createEditorExtension(app: App): Extension {
	return ViewPlugin.define(
		(view) => new NestedMarkdownViewPlugin(view, app),
		{ decorations: (value) => value.decorations },
	);
}
