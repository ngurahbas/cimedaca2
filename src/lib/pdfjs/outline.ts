import type { PDFDocumentProxy } from 'pdfjs-dist';

export type OutlineNode = {
	title: string;
	pageNumber: number | null;
	destY: number | null;
	items: OutlineNode[];
};

type RawOutlineItem = {
	title: string;
	dest: string | Array<unknown> | null;
	items: Array<unknown>;
};

type RefProxy = { num: number; gen: number };

function extractDestY(explicit: Array<unknown>): number | null {
	if (explicit.length < 2) return null;
	const name = explicit[1];
	let nameStr: string | null = null;
	if (typeof name === 'string') {
		nameStr = name;
	} else if (
		name &&
		typeof name === 'object' &&
		'name' in name &&
		typeof (name as { name: unknown }).name === 'string'
	) {
		nameStr = (name as { name: string }).name;
	}
	if (!nameStr) return null;
	switch (nameStr.toLowerCase()) {
		case 'xyz':
			return typeof explicit[3] === 'number' ? explicit[3] : null;
		case 'fith':
		case 'fitbh':
			return typeof explicit[2] === 'number' ? explicit[2] : null;
		case 'fitr':
			return typeof explicit[5] === 'number' ? explicit[5] : null;
		default:
			return null;
	}
}

async function resolveOutlineDest(
	doc: PDFDocumentProxy,
	dest: string | Array<unknown> | null
): Promise<{ pageNumber: number | null; destY: number | null }> {
	try {
		let explicit: Array<unknown> | null = null;
		if (typeof dest === 'string') {
			explicit = await doc.getDestination(dest);
		} else if (Array.isArray(dest)) {
			explicit = dest;
		}
		if (!explicit || explicit.length === 0) return { pageNumber: null, destY: null };
		const ref = explicit[0] as RefProxy;
		if (!ref || typeof ref !== 'object') return { pageNumber: null, destY: null };
		const pageIndex = await doc.getPageIndex(ref);
		return { pageNumber: pageIndex + 1, destY: extractDestY(explicit) };
	} catch (err) {
		console.error('loadOutline: failed to resolve outline destination:', err);
		return { pageNumber: null, destY: null };
	}
}

async function transformOutline(
	doc: PDFDocumentProxy,
	items: RawOutlineItem[]
): Promise<OutlineNode[]> {
	const result: OutlineNode[] = [];
	for (const item of items) {
		const { pageNumber, destY } = await resolveOutlineDest(doc, item.dest);
		const children =
			Array.isArray(item.items) && item.items.length > 0
				? await transformOutline(doc, item.items as RawOutlineItem[])
				: [];
		result.push({
			title: item.title,
			pageNumber,
			destY,
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
