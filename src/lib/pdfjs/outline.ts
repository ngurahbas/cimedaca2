import type { PDFDocumentProxy } from 'pdfjs-dist';

export type OutlineNode = {
	title: string;
	pageNumber: number | null;
	items: OutlineNode[];
};

type RawOutlineItem = {
	title: string;
	dest: string | Array<unknown> | null;
	items: Array<unknown>;
};

type RefProxy = { num: number; gen: number };

async function resolveOutlineDest(
	doc: PDFDocumentProxy,
	dest: string | Array<unknown> | null
): Promise<number | null> {
	try {
		let explicit: Array<unknown> | null = null;
		if (typeof dest === 'string') {
			explicit = await doc.getDestination(dest);
		} else if (Array.isArray(dest)) {
			explicit = dest;
		}
		if (!explicit || explicit.length === 0) return null;
		const ref = explicit[0] as RefProxy;
		if (!ref || typeof ref !== 'object') return null;
		const pageIndex = await doc.getPageIndex(ref);
		return pageIndex + 1;
	} catch (err) {
		console.error('loadOutline: failed to resolve outline destination:', err);
		return null;
	}
}

async function transformOutline(
	doc: PDFDocumentProxy,
	items: RawOutlineItem[]
): Promise<OutlineNode[]> {
	const result: OutlineNode[] = [];
	for (const item of items) {
		const pageNumber = await resolveOutlineDest(doc, item.dest);
		const children =
			Array.isArray(item.items) && item.items.length > 0
				? await transformOutline(doc, item.items as RawOutlineItem[])
				: [];
		result.push({
			title: item.title,
			pageNumber,
			items: children
		});
	}
	return result;
}

export async function loadOutline(doc: PDFDocumentProxy): Promise<OutlineNode[]> {
	try {
		const raw = await doc.getOutline();
		if (!raw) return [];
		return await transformOutline(doc, raw as RawOutlineItem[]);
	} catch (err) {
		console.error('loadOutline: failed to read outline:', err);
		return [];
	}
}
