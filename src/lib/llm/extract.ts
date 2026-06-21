import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { loadOutline, type OutlineNode } from '$lib/pdfjs/outline';
import type { ExtractedPdf, PdfPageText, PdfSectionNode } from './types';

type PageTextContent = Awaited<ReturnType<PDFPageProxy['getTextContent']>>;
type TextContentItem = PageTextContent['items'][number];
type TextItemShape = Extract<TextContentItem, { str: string }>;

type PageItems = {
	pageNumber: number;
	items: PageTextContent['items'];
};

const HEADING_TITLE_MAX_LEN = 120;

function isTextItem(item: TextContentItem): item is TextItemShape {
	return 'str' in item;
}

function joinItems(items: PageTextContent['items']): string {
	let out = '';
	for (const item of items) {
		if (!isTextItem(item)) continue;
		if (out.length > 0 && !out.endsWith('\n')) {
			out += item.hasEOL ? '\n' : ' ';
		}
		out += item.str;
	}
	return out
		.replace(/[ \t]+/g, ' ')
		.replace(/\n[ \t]+/g, '\n')
		.trim();
}

function itemY(item: TextItemShape): number | null {
	if (!Array.isArray(item.transform)) return null;
	const y = item.transform[5];
	if (typeof y !== 'number' || Number.isNaN(y)) return null;
	return y;
}

function findSplitY(title: string, items: TextContentItem[], destY: number | null): number | null {
	const trimmedTitle = title.trim();
	if (trimmedTitle.length === 0 && destY === null) return null;

	const textItems = items.filter(isTextItem);
	if (textItems.length === 0) return null;

	const titleLower = trimmedTitle.toLowerCase();
	const matches: TextItemShape[] = [];
	for (const it of textItems) {
		const str = it.str.trim();
		if (str.length === 0) continue;
		const strLower = str.toLowerCase();
		if (titleLower.length > 0 && (titleLower.includes(strLower) || strLower.includes(titleLower))) {
			matches.push(it);
		}
	}

	if (destY !== null) {
		const pool = matches.length > 0 ? matches : textItems;
		let best: TextItemShape | null = null;
		let bestDist = Infinity;
		for (const it of pool) {
			const y = itemY(it);
			if (y === null) continue;
			const d = Math.abs(y - destY);
			if (d < bestDist) {
				bestDist = d;
				best = it;
			}
		}
		return best ? itemY(best) : null;
	}

	return matches.length > 0 ? itemY(matches[0]) : null;
}

function itemsForSection(
	startPage: number,
	startY: number | null,
	endPage: number,
	endY: number | null,
	pageData: PageItems[]
): TextContentItem[] {
	const result: TextContentItem[] = [];
	for (const p of pageData) {
		if (p.pageNumber < startPage || p.pageNumber > endPage) continue;
		const isStart = p.pageNumber === startPage;
		const isEnd = p.pageNumber === endPage;
		for (const item of p.items) {
			if (!isTextItem(item)) continue;
			const y = itemY(item);
			if (y === null) {
				result.push(item);
				continue;
			}
			if (isStart && isEnd) {
				if ((startY === null || y <= startY) && (endY === null || y > endY)) {
					result.push(item);
				}
			} else if (isStart) {
				if (startY === null || y <= startY) result.push(item);
			} else if (isEnd) {
				if (endY === null || y > endY) result.push(item);
			} else {
				result.push(item);
			}
		}
	}
	return result;
}

async function buildByPage(
	doc: PDFDocumentProxy
): Promise<{ byPage: PdfPageText[]; pageData: PageItems[] }> {
	const pageData: PageItems[] = [];
	for (let i = 1; i <= doc.numPages; i++) {
		const page = await doc.getPage(i);
		const tc = await page.getTextContent();
		pageData.push({ pageNumber: i, items: tc.items });
	}
	const byPage: PdfPageText[] = pageData.map((p) => ({
		pageNumber: p.pageNumber,
		text: joinItems(p.items)
	}));
	return { byPage, pageData };
}

function outlineToTree(
	outline: OutlineNode[],
	numPages: number,
	pageData: PageItems[]
): PdfSectionNode[] {
	type Flat = {
		node: OutlineNode;
		depth: number;
		startPage: number;
		startY: number | null;
		endPage: number;
		endY: number | null;
	};
	const flat: Flat[] = [];

	function walk(nodes: OutlineNode[], depth: number): void {
		for (const n of nodes) {
			flat.push({
				node: n,
				depth,
				startPage: n.pageNumber ?? 0,
				startY: n.destY,
				endPage: 0,
				endY: null
			});
			walk(n.items, depth + 1);
		}
	}
	walk(outline, 0);

	if (flat.length === 0) return [];

	// Forward-pass: fill startPage for entries that didn't resolve.
	for (let i = 0; i < flat.length; i++) {
		const cur = flat[i];
		if (cur.startPage > 0) continue;
		for (let j = i + 1; j < flat.length; j++) {
			if (flat[j].startPage > 0) {
				cur.startPage = flat[j].startPage;
				break;
			}
		}
		if (cur.startPage === 0) cur.startPage = 1;
		cur.startY = null;
	}

	// Compute endPage/endY and resolve startY using page items + title.
	for (let i = 0; i < flat.length; i++) {
		const cur = flat[i];
		const pageItems = pageData.find((p) => p.pageNumber === cur.startPage)?.items ?? [];
		cur.startY = findSplitY(cur.node.title, pageItems, cur.startY);

		const next = flat[i + 1];
		if (next) {
			cur.endPage = Math.max(cur.startPage, next.startPage);
			if (next.startPage === cur.startPage && next.startY === null) {
				// Can't split the shared page: exclude it from this section's text.
				cur.endY = Number.POSITIVE_INFINITY;
			} else {
				cur.endY = next.startY;
			}
		} else {
			cur.endPage = numPages;
			cur.endY = null;
		}
	}

	// Build the section tree, preserving the outline's depth as level (1-based).
	const nodeMap = new Map<OutlineNode, PdfSectionNode>();
	for (const f of flat) {
		const items = itemsForSection(f.startPage, f.startY, f.endPage, f.endY, pageData);
		nodeMap.set(f.node, {
			title: f.node.title.trim() || '(untitled)',
			level: f.depth + 1,
			startPage: f.startPage,
			endPage: f.endPage,
			text: joinItems(items),
			children: []
		});
	}

	const result: PdfSectionNode[] = [];
	for (const f of flat) {
		const built = nodeMap.get(f.node);
		if (!built) continue;
		const parent = findOutlineParent(outline, f.node, f.depth);
		if (parent) {
			const parentBuilt = nodeMap.get(parent);
			if (parentBuilt) {
				parentBuilt.children.push(built);
				continue;
			}
		}
		result.push(built);
	}
	return result;
}

function findOutlineParent(
	outline: OutlineNode[],
	target: OutlineNode,
	targetDepth: number,
	current: OutlineNode[] = outline,
	depth: number = 0
): OutlineNode | null {
	if (targetDepth === 0) return null;
	for (const n of current) {
		if (n === target) return null;
		if (depth + 1 === targetDepth) {
			if (n.items.includes(target)) return n;
			continue;
		}
		const found = findOutlineParent(n.items, target, targetDepth, n.items, depth + 1);
		if (found) return found;
	}
	return null;
}

function isHeadingRole(role: string): boolean {
	const r = role.toLowerCase();
	return r === 'h1' || /^h[2-6]$/.test(r) || r === 'heading' || r === 'title';
}

function headingLevelFromRole(role: string): number | null {
	if (!isHeadingRole(role)) return null;
	const r = role.toLowerCase();
	if (r === 'title' || r === 'heading') return 1;
	const m = r.match(/^h(\d)$/);
	if (m) return Number(m[1]);
	return null;
}

type StructNode = { role: string; children: unknown[] };

type StructContentRef = { type: 'content'; id: string };

function isStructContentRef(child: unknown): child is StructContentRef {
	return (
		child !== null &&
		typeof child === 'object' &&
		'type' in child &&
		child.type === 'content' &&
		'id' in child &&
		typeof (child as { id: unknown }).id === 'string'
	);
}

function buildContentMap(items: TextContentItem[]): Map<string, TextItemShape[]> {
	const map = new Map<string, TextItemShape[]>();
	let currentId: string | null = null;
	for (const item of items) {
		if (isTextItem(item)) {
			if (currentId) {
				if (!map.has(currentId)) map.set(currentId, []);
				map.get(currentId)!.push(item);
			}
			continue;
		}
		const marked = item as unknown as { type: string; id?: string };
		if (
			(marked.type === 'beginMarkedContent' || marked.type === 'beginMarkedContentProps') &&
			marked.id
		) {
			currentId = marked.id;
		} else if (marked.type === 'endMarkedContent') {
			currentId = null;
		}
	}
	return map;
}

function collectStructText(node: StructNode, contentMap: Map<string, TextItemShape[]>): string {
	const parts: string[] = [];
	for (const child of node.children) {
		if (isStructContentRef(child)) {
			const items = contentMap.get(child.id) ?? [];
			for (const item of items) parts.push(item.str);
		} else if (child && typeof child === 'object' && 'role' in child && 'children' in child) {
			parts.push(collectStructText(child as StructNode, contentMap));
		}
	}
	return parts.join(' ');
}

function findHeadingY(node: StructNode, contentMap: Map<string, TextItemShape[]>): number | null {
	for (const child of node.children) {
		if (isStructContentRef(child)) {
			const items = contentMap.get(child.id) ?? [];
			for (const item of items) {
				const y = itemY(item);
				if (y !== null) return y;
			}
		} else if (child && typeof child === 'object' && 'role' in child && 'children' in child) {
			const y = findHeadingY(child as StructNode, contentMap);
			if (y !== null) return y;
		}
	}
	return null;
}

async function tryStructureTree(
	doc: PDFDocumentProxy,
	pageData: PageItems[]
): Promise<PdfSectionNode[] | null> {
	type Heading = { level: number; title: string; page: number; y: number | null };
	const headings: Heading[] = [];

	for (const p of pageData) {
		const page = await doc.getPage(p.pageNumber);
		const tree = await page.getStructTree().catch(() => null);
		if (!tree) continue;

		const tc = await page.getTextContent({ includeMarkedContent: true });
		const contentMap = buildContentMap(tc.items);
		collectHeadings(tree as StructNode, headings, p.pageNumber, contentMap);
	}

	if (headings.length === 0) return null;

	const flat: Array<{
		title: string;
		level: number;
		startPage: number;
		startY: number | null;
		endPage: number;
		endY: number | null;
		text: string;
	}> = [];
	const numPages = doc.numPages;
	for (let i = 0; i < headings.length; i++) {
		const h = headings[i];
		const next = headings[i + 1];
		const startPage = h.page;
		const startY = h.y;
		let endPage: number;
		let endY: number | null;
		if (next) {
			endPage = next.page;
			if (next.page === startPage && next.y === null) {
				endY = Number.POSITIVE_INFINITY;
			} else {
				endY = next.y;
			}
		} else {
			endPage = numPages;
			endY = null;
		}
		const items = itemsForSection(startPage, startY, endPage, endY, pageData);
		flat.push({
			title: h.title,
			level: h.level,
			startPage,
			startY,
			endPage,
			endY,
			text: joinItems(items)
		});
	}
	return nestFlatByLevel(flat, pageData, numPages);
}

function collectHeadings(
	node: StructNode,
	out: { level: number; title: string; page: number; y: number | null }[],
	page: number,
	contentMap: Map<string, TextItemShape[]>
): void {
	const lvl = headingLevelFromRole(node.role);
	if (lvl !== null) {
		const title =
			collectStructText(node, contentMap).trim().slice(0, HEADING_TITLE_MAX_LEN) || '(untitled)';
		const y = findHeadingY(node, contentMap);
		out.push({ level: lvl, title, page, y });
		return;
	}
	for (const child of node.children) {
		if (child && typeof child === 'object' && 'role' in child && 'children' in child) {
			collectHeadings(child as StructNode, out, page, contentMap);
		}
	}
}

function fontSizeToTree(pageData: PageItems[], numPages: number): PdfSectionNode[] {
	type Item = { page: number; str: string; hasEOL: boolean; size: number };
	const items: Item[] = [];
	for (const p of pageData) {
		for (const raw of p.items) {
			if (!isTextItem(raw)) continue;
			const ti = raw;
			if (!Array.isArray(ti.transform) || typeof ti.transform[3] !== 'number') continue;
			items.push({
				page: p.pageNumber,
				str: ti.str,
				hasEOL: ti.hasEOL,
				size: ti.transform[3]
			});
		}
	}

	if (items.length === 0) {
		return [
			{
				title: '(untitled)',
				level: 0,
				startPage: 1,
				endPage: numPages,
				text: '',
				children: []
			}
		];
	}

	const buckets = new Map<number, number>();
	for (const it of items) {
		const bucket = Math.round(it.size * 2) / 2;
		buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
	}

	let bodySize = 0;
	let bodyCount = -1;
	for (const [size, count] of buckets) {
		if (count > bodyCount) {
			bodyCount = count;
			bodySize = size;
		}
	}

	const headingSizes = [...buckets.entries()]
		.filter(([size, count]) => size > bodySize + 1 && count >= 1 && count < bodyCount / 2)
		.sort(([a], [b]) => b - a)
		.slice(0, 4)
		.map(([size], idx) => ({ size, level: idx + 1 }));

	if (headingSizes.length === 0) {
		const allText = pageData.map((p) => joinItems(p.items)).join('\n\n');
		return [
			{
				title: '(untitled)',
				level: 0,
				startPage: 1,
				endPage: numPages,
				text: allText,
				children: []
			}
		];
	}

	// Identify the document title: the largest heading size whose items appear on
	// page 1. These items are excluded from the section tree.
	const titleSize = computeTitleSize(items, headingSizes, pageData[0]?.pageNumber ?? 1);

	// After excluding the title, renumber heading sizes so the largest remaining
	// size maps to level 1 (H1).
	const sectionSizes = headingSizes.filter((h) => h.size !== titleSize);
	const sizeToLevel = new Map(sectionSizes.map((h, idx) => [h.size, idx + 1] as [number, number]));

	type Event = {
		kind: 'heading' | 'body';
		page: number;
		str: string;
		level: number;
		hasEOL: boolean;
	};
	const events: Event[] = [];
	for (const it of items) {
		const bucket = Math.round(it.size * 2) / 2;
		const isTitleOnFirstPage =
			titleSize !== null && bucket === titleSize && it.page === (pageData[0]?.pageNumber ?? 1);
		if (isTitleOnFirstPage) {
			events.push({ kind: 'body', page: it.page, str: it.str, level: 0, hasEOL: it.hasEOL });
			continue;
		}
		const level = sizeToLevel.get(bucket);
		const trimmed = it.str.trim();
		const isHeadingCandidate =
			level !== undefined && trimmed.length > 0 && trimmed.length <= HEADING_TITLE_MAX_LEN;
		if (isHeadingCandidate) {
			events.push({ kind: 'heading', page: it.page, str: trimmed, level, hasEOL: it.hasEOL });
		} else {
			events.push({ kind: 'body', page: it.page, str: it.str, level: 0, hasEOL: it.hasEOL });
		}
	}

	type Flat = { title: string; level: number; startPage: number; endPage: number; text: string };
	const flat: Flat[] = [];
	let current: Flat | null = null;

	for (const ev of events) {
		if (ev.kind === 'heading') {
			if (current) {
				flat.push(current);
			}
			current = {
				title: ev.str,
				level: ev.level,
				startPage: ev.page,
				endPage: ev.page,
				text: ev.str
			};
		} else {
			if (!current) {
				current = { title: '(untitled)', level: 0, startPage: ev.page, endPage: ev.page, text: '' };
			}
			if (current.text.length > 0 && !current.text.endsWith('\n') && ev.str.trim().length > 0) {
				current.text += ev.hasEOL ? '\n' : ' ';
			}
			current.text += ev.str;
		}
	}
	if (current) flat.push(current);

	for (let i = 0; i < flat.length; i++) {
		const cur = flat[i];
		const next = flat[i + 1];
		if (next) {
			cur.endPage = Math.max(cur.endPage, Math.max(cur.startPage, next.startPage - 1));
		} else {
			cur.endPage = Math.max(cur.endPage, numPages);
		}
		if (cur.endPage < cur.startPage) cur.endPage = cur.startPage;
	}

	return nestFlatByLevel(flat, pageData, numPages);
}

function computeTitleSize(
	items: { page: number; size: number }[],
	headingSizes: { size: number; level: number }[],
	firstPageNumber: number
): number | null {
	const headingSizeSet = new Set(headingSizes.map((h) => h.size));
	let chosen: number | null = null;
	for (const it of items) {
		if (it.page !== firstPageNumber) break;
		const bucket = Math.round(it.size * 2) / 2;
		if (!headingSizeSet.has(bucket)) continue;
		if (chosen === null || bucket > chosen) chosen = bucket;
	}
	return chosen;
}

function nestFlatByLevel(
	flat: Array<{ title: string; level: number; startPage: number; endPage: number; text: string }>,
	pageData: PageItems[],
	numPages: number
): PdfSectionNode[] {
	if (flat.length === 0) {
		return [
			{
				title: '(untitled)',
				level: 0,
				startPage: 1,
				endPage: numPages,
				text: pageData.map((p) => joinItems(p.items)).join('\n\n'),
				children: []
			}
		];
	}

	const result: PdfSectionNode[] = [];
	const stack: PdfSectionNode[] = [];
	for (const f of flat) {
		const node: PdfSectionNode = { ...f, children: [] };
		while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
			stack.pop();
		}
		if (stack.length === 0) {
			result.push(node);
		} else {
			stack[stack.length - 1].children.push(node);
		}
		stack.push(node);
	}
	return result;
}

export async function extractPdf(doc: PDFDocumentProxy): Promise<ExtractedPdf> {
	const { byPage, pageData } = await buildByPage(doc);
	const numPages = doc.numPages;

	const outline = await loadOutline(doc);
	let tree: PdfSectionNode[];
	if (outline.length > 0) {
		tree = outlineToTree(outline, numPages, pageData);
	} else {
		const struct = await tryStructureTree(doc, pageData);
		tree = struct ?? fontSizeToTree(pageData, numPages);
	}

	return { tree, byPage };
}

export type { ExtractedPdf, PdfPageText, PdfSectionNode } from './types';

export function toMarkdown(tree: PdfSectionNode[]): string {
	const lines: string[] = [];
	for (const node of tree) {
		renderNode(node, lines);
	}
	const out = lines.join('\n').replace(/\n{3,}/g, '\n\n');
	return out.trim();
}

function renderNode(node: PdfSectionNode, lines: string[]): void {
	const hashes = '#'.repeat(Math.max(1, node.level));
	lines.push(`${hashes} ${node.title} (pages ${node.startPage}-${node.endPage})`);
	const body = node.text.trim().length > 0 ? node.text.trim() : '(no text)';
	lines.push(body);
	lines.push('');
	for (const child of node.children) {
		renderNode(child, lines);
	}
}
