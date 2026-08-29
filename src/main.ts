import { Plugin } from 'obsidian';

import { createEditorExtension } from './editor-extension';

export default class NestedMarkdownRendererPlugin extends Plugin {
	onload(): void {
		this.registerEditorExtension(createEditorExtension(this.app));
	}
}
