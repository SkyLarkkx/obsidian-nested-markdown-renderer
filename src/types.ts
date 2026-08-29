export interface ParsedTableRow {
	indent: string;
	cells: string[];
}

export interface TableBlock {
	startLine: number;
	endLine: number;
	from: number;
	contentFrom: number;
	to: number;
	indentColumns: number;
	markdown: string;
}

export interface FenceMarker {
	char: string;
	length: number;
}
