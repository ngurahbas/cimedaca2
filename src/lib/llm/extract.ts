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

function pageTextForRange(start: number, end: number, byPage: PdfPageText[]): string {
	const parts: string[] = [];
	for (const p of byPage) {
		if (p.pageNumber < start || p.pageNumber > end) continue;
		if (p.text.length > 0) parts.push(p.text);
	}
	return parts.join('\n\n');
}

function outlineToTree(
	outline: OutlineNode[],
	numPages: number,
	byPage: PdfPageText[]
): PdfSectionNode[] {
	type Flat = {
		node: OutlineNode;
		depth: number;
		startPage: number;
		endPage: number;
	};
	const flat: Flat[] = [];

	function walk(nodes: OutlineNode[], depth: number): void {
		for (const n of nodes) {
			flat.push({ node: n, depth, startPage: n.pageNumber ?? 0, endPage: 0 });
			walk(n.items, depth + 1);
		}
	}
	walk(outline, 0);

	if (flat.length === 0) return [];

	// Forward-pass: fill startPage for entries that didn't resolve.
	for (let i = 0; i < flat.length; i++) {
		const cur = flat[i];
		if (cur.startPage > 0) continue;
		// Look forward for the next entry with a known startPage.
		for (let j = i + 1; j < flat.length; j++) {
			if (flat[j].startPage > 0) {
				cur.startPage = flat[j].startPage;
				break;
			}
		}
		if (cur.startPage === 0) cur.startPage = 1;
	}

	// Compute endPage: the page just before the next flat entry's startPage.
	for (let i = 0; i < flat.length; i++) {
		const cur = flat[i];
		const next = flat[i + 1];
		if (next) {
			cur.endPage = Math.max(cur.startPage, next.startPage - 1);
		} else {
			cur.endPage = numPages;
		}
	}

	// Build the section tree, preserving the outline's depth as level (1-based).
	const nodeMap = new Map<OutlineNode, PdfSectionNode>();
	for (const f of flat) {
		nodeMap.set(f.node, {
			title: f.node.title.trim() || '(untitled)',
			level: f.depth + 1,
			startPage: f.startPage,
			endPage: f.endPage,
			text: pageTextForRange(f.startPage, f.endPage, byPage),
			children: []
		});
	}

	const result: PdfSectionNode[] = [];
	for (const f of flat) {
		const built = nodeMap.get(f.node);
		if (!built) continue;
		// Find parent by walking flat until we find a node whose .items includes f.node
		// at a depth one less than f.depth. The outline shape guarantees this.
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
	const r = role.toLowerCase().replace(/\d+$/, '');
	return r === 'h1' || /^h[2-6]$/.test(r) || r === 'heading' || r === 'title';
}

function headingLevelFromRole(role: string): number | null {
	if (!isHeadingRole(role)) return null;
	const r = role.toLowerCase().replace(/\d+$/, '');
	if (r === 'title') return 1;
	if (r === 'heading') return 1;
	const m = r.match(/^h(\d)$/);
	if (m) return Number(m[1]);
	return null;
}

async function tryStructureTree(
	doc: PDFDocumentProxy,
	pageData: PageItems[]
): Promise<PdfSectionNode[] | null> {
	type Heading = { level: number; title: string; page: number };
	const headings: Heading[] = [];

	for (const p of pageData) {
		const page = await doc.getPage(p.pageNumber);
		const tree = await page.getStructTree().catch(() => null);
		if (!tree) continue;

		const pageText = joinItems(p.items);
		collectHeadings(tree, headings, p.pageNumber, pageText);
	}

	if (headings.length === 0) return null;

	const flat: Array<{
		title: string;
		level: number;
		startPage: number;
		endPage: number;
		text: string;
	}> = [];
	const numPages = doc.numPages;
	for (let i = 0; i < headings.length; i++) {
		const h = headings[i];
		const next = headings[i + 1];
		const startPage = h.page;
		const endPage = next ? Math.max(startPage, next.page - 1) : numPages;
		flat.push({ title: h.title, level: h.level, startPage, endPage, text: '' });
	}
	return nestFlatByLevel(flat, pageData, numPages);
}

function collectHeadings(
	node: { role: string; children: unknown[] },
	out: { level: number; title: string; page: number }[],
	page: number,
	pageText: string
): void {
	const lvl = headingLevelFromRole(node.role);
	if (lvl !== null) {
		out.push({
			level: lvl,
			title: pageText.slice(0, HEADING_TITLE_MAX_LEN).trim() || '(untitled)',
			page
		});
		return;
	}
	for (const child of node.children) {
		if (child && typeof child === 'object' && 'role' in child && 'children' in child) {
			collectHeadings(child as { role: string; children: unknown[] }, out, page, pageText);
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
		tree = outlineToTree(outline, numPages, byPage);
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
