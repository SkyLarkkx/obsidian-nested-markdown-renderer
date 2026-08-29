import type { EditorState } from '@codemirror/state';
import type { EditorView, ViewUpdate } from '@codemirror/view';
import { editorInfoField, editorLivePreviewField } from 'obsidian';

function livePreviewFieldValue(state: EditorState): boolean {
	try {
		return state.field(editorLivePreviewField, false) === true;
	} catch {
		return false;
	}
}

export function isLivePreview(view: EditorView): boolean {
	return (
		livePreviewFieldValue(view.state) ||
		view.dom
			.closest('.markdown-source-view')
			?.classList.contains('is-live-preview') === true
	);
}

export function didLivePreviewChange(update: ViewUpdate): boolean {
	return (
		livePreviewFieldValue(update.startState) !==
		livePreviewFieldValue(update.state)
	);
}

export function sourcePath(view: EditorView): string {
	try {
		return view.state.field(editorInfoField, false)?.file?.path ?? '';
	} catch {
		return '';
	}
}
