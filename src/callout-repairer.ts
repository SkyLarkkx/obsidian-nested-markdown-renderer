import type { EditorView } from '@codemirror/view';
import {
	type App,
	MarkdownRenderChild,
	MarkdownRenderer,
} from 'obsidian';

import { isLivePreview, sourcePath } from './live-preview';

const CALLOUT_RE = /^\s*>\s*\[![^\]]+\]/i;

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
	return (
		typeof value === 'object' &&
		value !== null &&
		'then' in value &&
		typeof value.then === 'function'
	);
}

export class CalloutRepairer {
	private readonly renderChildren = new Map<HTMLElement, MarkdownRenderChild>();
	private readonly pendingRenderChildren = new Set<MarkdownRenderChild>();
	private readonly observer: MutationObserver;
	private repairTimer: number | null = null;
	private destroyed = false;

	constructor(
		private readonly view: EditorView,
		private readonly app: App,
	) {
		this.observer = new MutationObserver(() => this.schedule());
		this.observer.observe(view.dom, { childList: true, subtree: true });
		this.schedule();
	}

	schedule(): void {
		if (this.repairTimer !== null) return;
		this.repairTimer = window.setTimeout(() => {
			this.repairTimer = null;
			this.repairMalformedCallouts();
		}, 0);
	}

	destroy(): void {
		this.destroyed = true;
		this.observer.disconnect();
		if (this.repairTimer !== null) window.clearTimeout(this.repairTimer);
		for (const child of this.renderChildren.values()) child.unload();
		for (const child of this.pendingRenderChildren) child.unload();
		this.renderChildren.clear();
		this.pendingRenderChildren.clear();
	}

	private repairMalformedCallouts(): void {
		this.cleanupDetachedCallouts();
		if (this.destroyed || !isLivePreview(this.view)) return;

		const path = sourcePath(this.view);
		for (const element of Array.from(
			this.view.dom.getElementsByClassName('cm-callout'),
		)) {
			if (!element.instanceOf(HTMLElement)) continue;
			const wrapper = element;
			const host = Array.from(wrapper.children).find(
				(child): child is HTMLElement =>
					child.instanceOf(HTMLElement) &&
					child.classList.contains('markdown-rendered'),
			);
			const pre = host
				? Array.from(host.children).find(
						(child): child is HTMLPreElement =>
							child.instanceOf(HTMLPreElement),
					)
				: undefined;
			const code = pre
				? Array.from(pre.children).find(
						(child): child is HTMLElement =>
							child.instanceOf(HTMLElement) && child.tagName === 'CODE',
					)
				: undefined;
			const hasCallout = host
				? Array.from(host.children).some((child) =>
						child.classList.contains('callout'),
					)
				: false;
			if (!host || !code || hasCallout) continue;

			const markdown = code.textContent ?? '';
			if (!CALLOUT_RE.test(markdown) || wrapper.dataset.nmrRepairing === 'true') {
				continue;
			}

			this.renderCallout(wrapper, host, markdown, path);
		}
	}

	private renderCallout(
		wrapper: HTMLElement,
		host: HTMLElement,
		markdown: string,
		path: string,
	): void {
		wrapper.dataset.nmrRepairing = 'true';
		const originalNodes = Array.from(host.childNodes);
		const renderChild = new MarkdownRenderChild(host);
		renderChild.load();
		this.pendingRenderChildren.add(renderChild);
		host.replaceChildren();

		let settled = false;
		const succeed = (): boolean => {
			if (settled || this.destroyed || !wrapper.isConnected) return false;
			if (!host.querySelector(':scope > .callout')) return false;
			settled = true;
			this.pendingRenderChildren.delete(renderChild);
			delete wrapper.dataset.nmrRepairing;
			wrapper.dataset.nmrRepaired = 'true';
			this.renderChildren.set(wrapper, renderChild);
			this.view.requestMeasure();
			return true;
		};

		const fail = (error: unknown, restore = true): void => {
			if (settled) return;
			settled = true;
			this.pendingRenderChildren.delete(renderChild);
			renderChild.unload();
			if (restore && wrapper.isConnected) host.replaceChildren(...originalNodes);
			delete wrapper.dataset.nmrRepairing;
			if (error !== null) {
				console.error(
					'[nested-markdown-renderer] Could not repair callout.',
					error,
				);
			}
			if (!this.destroyed) this.view.requestMeasure();
		};

		let attempts = 0;
		const checkRenderedCallout = (): void => {
			if (succeed() || settled) return;
			if (this.destroyed || !wrapper.isConnected) {
				fail(null, false);
				return;
			}
			attempts += 1;
			if (attempts < 30) {
				window.setTimeout(checkRenderedCallout, 16);
			} else {
				fail(new Error('Rendered content did not contain a callout.'));
			}
		};

		let renderResult: unknown;
		try {
			renderResult = MarkdownRenderer.render(
				this.app,
				markdown,
				host,
				path,
				renderChild,
			);
		} catch (error) {
			fail(error);
			return;
		}

		queueMicrotask(checkRenderedCallout);
		if (isPromiseLike(renderResult)) {
			void Promise.resolve(renderResult)
				.then(() => succeed())
				.catch((error: unknown) => fail(error));
		}
	}

	private cleanupDetachedCallouts(): void {
		for (const [wrapper, child] of this.renderChildren) {
			if (wrapper.isConnected) continue;
			child.unload();
			this.renderChildren.delete(wrapper);
		}
	}
}
