import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { loadOutline, type OutlineNode } from '$lib/pdfjs/outline';
import type { ExtractedPdf, PdfPageText, PdfSectionNode } from './types';

type PageTextContent = Awaited<ReturnType<PDFPageProxy['getTextContent']>>;
type TextContentItem = PageTextContent['items'][number];
type TextItemShape = Extract<TextContentItem, { str: string }>;

type PageItems = {
	pageNumber: number;
	items: TextContentItem[];
};

type CandidateSection = {
	title: string;
	level: number;
	page: number;
	y: number | null;
};

const HEADING_TITLE_MAX_LEN = 120;

function isTextItem(item: TextContentItem): item is TextItemShape {
	return 'str' in item;
}

function itemY(item: TextItemShape): number | null {
	if (!Array.isArray(item.transform)) return null;
	const y = item.transform[5];
	if (typeof y !== 'number' || Number.isNaN(y)) return null;
	return y;
}

function joinItems(items: TextContentItem[]): string {
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

function resolveHeadingY(
	title: string,
	items: TextContentItem[],
	destY: number | null
): number | null {
	const textItems = items.filter(isTextItem);
	if (textItems.length === 0) return null;

	const titleLower = title.trim().toLowerCase();
	const matches = titleLower
		? textItems.filter((it) => {
				const s = it.str.trim();
				if (s.length === 0) return false;
				const sLower = s.toLowerCase();
				return sLower.includes(titleLower) || titleLower.includes(sLower);
			})
		: [];

	if (destY === null) {
		return matches.length > 0 ? itemY(matches[0]) : null;
	}

	const pool = matches.length > 0 ? matches : textItems;
	let best: number | null = null;
	let bestDist = Infinity;
	for (const it of pool) {
		const y = itemY(it);
		if (y === null) continue;
		const d = Math.abs(y - destY);
		if (d < bestDist) {
			bestDist = d;
			best = y;
		}
	}
	return best;
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
			if (isStart && startY !== null && y > startY) continue;
			if (isEnd && endY !== null && y <= endY) continue;
			result.push(item);
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
		const tc = await page.getTextContent({ includeMarkedContent: true });
		pageData.push({ pageNumber: i, items: tc.items });
	}
	const byPage: PdfPageText[] = pageData.map((p) => ({
		pageNumber: p.pageNumber,
		text: joinItems(p.items)
	}));
	return { byPage, pageData };
}

function untitledNode(startPage: number, endPage: number, text: string): PdfSectionNode {
	return {
		title: '(untitled)',
		level: 0,
		startPage,
		endPage,
		text,
		children: []
	};
}

function nestFlatByLevel(nodes: PdfSectionNode[]): PdfSectionNode[] {
	const result: PdfSectionNode[] = [];
	const stack: PdfSectionNode[] = [];
	for (const node of nodes) {
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

function buildTree(
	candidates: CandidateSection[],
	pageData: PageItems[],
	numPages: number
): PdfSectionNode[] {
	if (candidates.length === 0) {
		const allText = pageData.map((p) => joinItems(p.items)).join('\n\n');
		return [untitledNode(1, numPages, allText)];
	}

	const nodes: PdfSectionNode[] = candidates.map((c, i) => {
		const next = candidates[i + 1];
		const endPage = next ? Math.max(c.page, next.page) : numPages;
		let endY: number | null = null;
		if (next) {
			if (next.page === c.page && next.y === null) {
				endY = Number.POSITIVE_INFINITY;
			} else {
				endY = next.y;
			}
		}
		const items = itemsForSection(c.page, c.y, endPage, endY, pageData);
		return {
			title: c.title,
			level: c.level,
			startPage: c.page,
			endPage,
			text: joinItems(items),
			children: []
		};
	});

	return nestFlatByLevel(nodes);
}

function findAbstractHeading(pageData: PageItems[]): { page: number; y: number } | null {
	const firstPage = pageData.find((p) => p.pageNumber === 1);
	if (!firstPage) return null;
	const candidates: { y: number; item: TextItemShape }[] = [];
	for (const item of firstPage.items) {
		if (!isTextItem(item)) continue;
		const str = item.str.trim();
		if (!/^abstract[\s:.]*$/i.test(str)) continue;
		const y = itemY(item);
		if (y === null) continue;
		candidates.push({ y, item });
	}
	if (candidates.length === 0) return null;
	const withEol = candidates.find((c) => c.item.hasEOL);
	return { page: 1, y: withEol ? withEol.y : candidates[0].y };
}

type OutlineFlat = {
	node: OutlineNode;
	depth: number;
	startPage: number;
	startY: number | null;
};

function outlineToTree(
	outline: OutlineNode[],
	numPages: number,
	pageData: PageItems[]
): PdfSectionNode[] {
	const flat: OutlineFlat[] = [];

	function walk(nodes: OutlineNode[], depth: number): void {
		for (const n of nodes) {
			flat.push({
				node: n,
				depth,
				startPage: n.pageNumber ?? 0,
				startY: n.destY
			});
			walk(n.items, depth + 1);
		}
	}
	walk(outline, 0);

	if (flat.length === 0) return [];

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

	for (const f of flat) {
		const pageItems = pageData.find((p) => p.pageNumber === f.startPage)?.items ?? [];
		f.startY = resolveHeadingY(f.node.title, pageItems, f.startY);
	}

	const candidates: CandidateSection[] = flat.map((f) => ({
		title: f.node.title.trim() || '(untitled)',
		level: f.depth + 1,
		page: f.startPage,
		y: f.startY
	}));

	const tree = buildTree(candidates, pageData, numPages);
	const frontMatter = extractFrontMatter(flat, pageData);
	return frontMatter.length > 0 ? [...frontMatter, ...tree] : tree;
}

function extractFrontMatter(flat: OutlineFlat[], pageData: PageItems[]): PdfSectionNode[] {
	const hasAbstract = flat.some((f) => /abstract/i.test(f.node.title.trim()));
	if (hasAbstract) return [];

	const first = flat[0];
	if (!first) return [];

	if (first.startPage > 1) {
		const items = itemsForSection(1, null, first.startPage, first.startY, pageData);
		if (items.length === 0) return [];
		return [
			{
				title: '(front matter)',
				level: 0,
				startPage: 1,
				endPage: first.startPage,
				text: joinItems(items),
				children: []
			}
		];
	}

	if (first.startPage !== 1 || first.startY === null) return [];

	const abstract = findAbstractHeading(pageData);
	if (!abstract || abstract.y <= first.startY) {
		const items = itemsForSection(1, null, 1, first.startY, pageData);
		if (items.length === 0) return [];
		return [
			{
				title: '(front matter)',
				level: 0,
				startPage: 1,
				endPage: 1,
				text: joinItems(items),
				children: []
			}
		];
	}

	const nodes: PdfSectionNode[] = [];
	const titleItems = itemsForSection(1, null, 1, abstract.y, pageData);
	if (titleItems.length > 0) {
		nodes.push({
			title: '(front matter)',
			level: 0,
			startPage: 1,
			endPage: 1,
			text: joinItems(titleItems),
			children: []
		});
	}

	const abstractItems = itemsForSection(1, abstract.y, 1, first.startY, pageData);
	nodes.push({
		title: 'Abstract',
		level: 1,
		startPage: 1,
		endPage: 1,
		text: joinItems(abstractItems),
		children: []
	});
	return nodes;
}

// Structure-tree fallback

type StructNode = { role: string; children: unknown[] };

function isStructContentRef(child: unknown): child is { type: 'content'; id: string } {
	if (child === null || typeof child !== 'object') return false;
	const obj = child as Record<string, unknown>;
	return obj.type === 'content' && typeof obj.id === 'string';
}

function isStructNode(child: unknown): child is StructNode {
	return (
		child !== null &&
		typeof child === 'object' &&
		'role' in (child as object) &&
		'children' in (child as object)
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
		} else if (isStructNode(child)) {
			parts.push(collectStructText(child, contentMap));
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
		} else if (isStructNode(child)) {
			const y = findHeadingY(child, contentMap);
			if (y !== null) return y;
		}
	}
	return null;
}

function headingLevelFromRole(role: string): number | null {
	const r = role.toLowerCase();
	if (r === 'title' || r === 'heading') return 1;
	const m = r.match(/^h(\d)$/);
	if (m) return Number(m[1]);
	return null;
}

function collectHeadings(
	node: StructNode,
	page: number,
	contentMap: Map<string, TextItemShape[]>,
	out: CandidateSection[]
): void {
	const level = headingLevelFromRole(node.role);
	if (level !== null) {
		const title =
			collectStructText(node, contentMap).trim().slice(0, HEADING_TITLE_MAX_LEN) || '(untitled)';
		const y = findHeadingY(node, contentMap);
		out.push({ title, level, page, y });
		return;
	}
	for (const child of node.children) {
		if (isStructNode(child)) {
			collectHeadings(child, page, contentMap, out);
		}
	}
}

async function tryStructureTree(
	doc: PDFDocumentProxy,
	pageData: PageItems[]
): Promise<PdfSectionNode[] | null> {
	const candidates: CandidateSection[] = [];
	for (const p of pageData) {
		const page = await doc.getPage(p.pageNumber);
		const tree = await page.getStructTree().catch(() => null);
		if (!tree) continue;
		const contentMap = buildContentMap(p.items);
		collectHeadings(tree as StructNode, p.pageNumber, contentMap, candidates);
	}
	if (candidates.length === 0) return null;
	return buildTree(candidates, pageData, doc.numPages);
}

// Font-size heuristic fallback

type FontItem = { page: number; y: number | null; str: string; hasEOL: boolean; size: number };

function computeTitleSize(items: FontItem[], headingSizeSet: Set<number>): number | null {
	let chosen: number | null = null;
	for (const it of items) {
		if (it.page !== 1) break;
		const bucket = Math.round(it.size * 2) / 2;
		if (!headingSizeSet.has(bucket)) continue;
		if (chosen === null || bucket > chosen) chosen = bucket;
	}
	return chosen;
}

function fontSizeCandidates(pageData: PageItems[]): CandidateSection[] {
	const items: FontItem[] = [];
	for (const p of pageData) {
		for (const raw of p.items) {
			if (!isTextItem(raw)) continue;
			if (!Array.isArray(raw.transform) || typeof raw.transform[3] !== 'number') continue;
			items.push({
				page: p.pageNumber,
				y: itemY(raw),
				str: raw.str,
				hasEOL: raw.hasEOL,
				size: raw.transform[3]
			});
		}
	}

	if (items.length === 0) return [];

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
		.filter(([size, count]) => size > bodySize + 1 && count < bodyCount / 2)
		.sort(([a], [b]) => b - a)
		.slice(0, 4)
		.map(([size], idx) => ({ size, level: idx + 1 }));

	if (headingSizes.length === 0) return [];

	const headingSizeSet = new Set(headingSizes.map((h) => h.size));
	const titleSize = computeTitleSize(items, headingSizeSet);

	const sectionSizes = headingSizes.filter((h) => h.size !== titleSize);
	const sizeToLevel = new Map(sectionSizes.map((h, idx) => [h.size, idx + 1]));

	const firstPageNumber = pageData[0]?.pageNumber ?? 1;
	const candidates: CandidateSection[] = [];
	for (const it of items) {
		const bucket = Math.round(it.size * 2) / 2;
		if (titleSize !== null && bucket === titleSize && it.page === firstPageNumber) {
			continue;
		}
		const level = sizeToLevel.get(bucket);
		const trimmed = it.str.trim();
		if (level !== undefined && trimmed.length > 0 && trimmed.length <= HEADING_TITLE_MAX_LEN) {
			candidates.push({ title: trimmed, level, page: it.page, y: it.y });
		}
	}
	return candidates;
}

function fontSizeToTree(pageData: PageItems[], numPages: number): PdfSectionNode[] {
	const candidates = fontSizeCandidates(pageData);
	if (candidates.length === 0) {
		const allText = pageData.map((p) => joinItems(p.items)).join('\n\n');
		return [untitledNode(1, numPages, allText)];
	}

	const first = candidates[0];
	let prefix: PdfSectionNode | null = null;
	if (first.page > 1) {
		const items = itemsForSection(1, null, first.page - 1, null, pageData);
		if (items.length > 0) {
			prefix = untitledNode(1, first.page - 1, joinItems(items));
		}
	} else if (first.y !== null) {
		const items = itemsForSection(1, null, 1, first.y, pageData);
		if (items.length > 0) {
			prefix = untitledNode(1, 1, joinItems(items));
		}
	}

	const tree = buildTree(candidates, pageData, numPages);
	return prefix ? [prefix, ...tree] : tree;
}

export async function extractPdf(doc: PDFDocumentProxy): Promise<ExtractedPdf> {
	const { byPage, pageData } = await buildByPage(doc);
	const outline = await loadOutline(doc);

	let tree: PdfSectionNode[];
	if (outline.length > 0) {
		tree = outlineToTree(outline, doc.numPages, pageData);
	} else {
		const struct = await tryStructureTree(doc, pageData);
		tree = struct ?? fontSizeToTree(pageData, doc.numPages);
	}

	return { tree, byPage };
}

export type { ExtractedPdf, PdfPageText, PdfSectionNode } from './types';

export function toMarkdown(tree: PdfSectionNode[]): string {
	const lines: string[] = [];
	for (const node of tree) {
		renderNode(node, lines);
	}
	return lines
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

function renderNode(node: PdfSectionNode, lines: string[]): void {
	const hashes = '#'.repeat(Math.max(1, node.level));
	lines.push(`${hashes} ${node.title} (pages ${node.startPage}-${node.endPage})`);
	lines.push(node.text.trim().length > 0 ? node.text.trim() : '(no text)');
	lines.push('');
	for (const child of node.children) {
		renderNode(child, lines);
	}
}
