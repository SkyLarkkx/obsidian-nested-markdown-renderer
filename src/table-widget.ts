import { EditorView, WidgetType } from '@codemirror/view';
import {
	type App,
	MarkdownRenderChild,
	MarkdownRenderer,
} from 'obsidian';

import type { TableBlock } from './types';

export class NestedTableWidget extends WidgetType {
	private renderChild: MarkdownRenderChild | null = null;
	private pendingRender: Promise<void> | null = null;
	private editTimer: number | null = null;

	constructor(
		private readonly app: App,
		readonly table: TableBlock,
		private readonly path: string,
	) {
		super();
	}

	eq(other: WidgetType): boolean {
		return (
			other instanceof NestedTableWidget &&
			other.table.from === this.table.from &&
			other.table.markdown === this.table.markdown &&
			other.table.indentColumns === this.table.indentColumns &&
			other.path === this.path
		);
	}

	toDOM(view: EditorView): HTMLElement {
		const container = createSpan({
			cls: ['nmr-table-widget', 'cm-embed-block', 'markdown-rendered'],
		});
		container.setAttribute('contenteditable', 'false');
		container.setAttribute('aria-busy', 'true');

		const renderChild = new MarkdownRenderChild(container);
		this.renderChild = renderChild;
		renderChild.load();
		this.pendingRender = this.renderTable(container, view, renderChild);

		container.addEventListener('mousedown', (event) => {
			if (event.button !== 0) return;
			const target = event.target;
			if (
				target instanceof Element &&
				target.closest('a, button, input, textarea, select')
			) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();
			if (this.editTimer !== null) window.clearTimeout(this.editTimer);
			this.editTimer = window.setTimeout(() => {
				this.editTimer = null;
				view.dispatch({
					selection: { anchor: this.table.from },
					scrollIntoView: true,
				});
				view.focus();
			}, 0);
		});

		return container;
	}

	ignoreEvent(): boolean {
		return false;
	}

	destroy(): void {
		if (this.editTimer !== null) window.clearTimeout(this.editTimer);
		const unload = (): void => {
			this.renderChild?.unload();
			this.renderChild = null;
		};
		if (this.pendingRender) {
			void this.pendingRender.finally(unload);
		} else {
			unload();
		}
	}

	private async renderTable(
		container: HTMLElement,
		view: EditorView,
		renderChild: MarkdownRenderChild,
	): Promise<void> {
		try {
			await MarkdownRenderer.render(
				this.app,
				this.table.markdown,
				container,
				this.path,
				renderChild,
			);
			if (!container.querySelector('table')) {
				throw new Error('Rendered content did not contain a table.');
			}
		} catch (error) {
			console.error(
				'[nested-markdown-renderer] Could not render table.',
				error,
			);
			container.replaceChildren();
			const fallback = createEl('pre');
			fallback.textContent = this.table.markdown;
			container.appendChild(fallback);
			container.classList.add('nmr-render-error');
		} finally {
			container.setAttribute('aria-busy', 'false');
			if (container.isConnected) view.requestMeasure();
		}
	}
}
