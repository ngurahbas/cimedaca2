import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { extractPdf, toMarkdown } from '$lib/llm/extract';

const FIXTURE_DIR = new URL('../../fixtures/pdf/', import.meta.url);
const FIXTURE_PLAIN = new URL('fake_scientific_paper.pdf', FIXTURE_DIR);
const FIXTURE_OUTLINE = new URL('fake_scientific_paper_with_outline.pdf', FIXTURE_DIR);
const FIXTURE_SHARED_OUTLINE = new URL('shared_outline_same_page.pdf', FIXTURE_DIR);
const FIXTURE_SHARED_STRUCTURE = new URL('shared_structure_same_page.pdf', FIXTURE_DIR);

type GetDocumentParams = Parameters<typeof getDocument>[0];

async function loadFixture(url: URL): Promise<PDFDocumentProxy> {
	const buf = readFileSync(url);
	const params: GetDocumentParams = {
		data: new Uint8Array(buf),
		useWorkerFetch: false,
		disableFontFace: true,
		verbosity: 0
	};
	const task = getDocument(params);
	return await task.promise;
}

function flattenTitles(
	nodes: { title: string; level: number }[]
): { title: string; level: number }[] {
	return nodes.flatMap((n) => [{ title: n.title, level: n.level }]);
}

describe('extractPdf', () => {
	it('returns a non-null result for both fixtures with byPage matching numPages', async () => {
		for (const url of [FIXTURE_PLAIN, FIXTURE_OUTLINE]) {
			const doc = await loadFixture(url);
			const result = await extractPdf(doc);
			expect(result).toBeTruthy();
			expect(result.byPage.length).toBe(doc.numPages);
			expect(result.tree).toBeDefined();
			await doc.cleanup();
		}
	});

	it('byPage[i].pageNumber is 1-based and sequential', async () => {
		for (const url of [FIXTURE_PLAIN, FIXTURE_OUTLINE]) {
			const doc = await loadFixture(url);
			const result = await extractPdf(doc);
			for (let i = 0; i < result.byPage.length; i++) {
				expect(result.byPage[i].pageNumber).toBe(i + 1);
			}
			await doc.cleanup();
		}
	});

	it('concatenated byPage text contains identifiable content from the paper', async () => {
		for (const url of [FIXTURE_PLAIN, FIXTURE_OUTLINE]) {
			const doc = await loadFixture(url);
			const result = await extractPdf(doc);
			const all = result.byPage.map((p) => p.text).join('\n');
			expect(all).toContain('LearnedANN');
			expect(all).toContain('Approximate Nearest Neighbor');
			await doc.cleanup();
		}
	});

	it('outline path: tree mirrors the PDF outline and levels are valid', async () => {
		const doc = await loadFixture(FIXTURE_OUTLINE);
		const result = await extractPdf(doc);
		expect(result.tree.length).toBeGreaterThan(0);

		const titles = flattenTitles(result.tree);
		const seenTitles = new Set(titles.map((t) => t.title));

		// Outline from the LaTeX-paper fixture: Introduction, Background, Method,
		// Experiments, Discussion, Conclusion. The source also has an abstract, but
		// the PDF outline omits it, so extraction synthesizes an Abstract node.
		const expected = [
			'Abstract',
			'Introduction',
			'Background and Related Work',
			'Method',
			'Experiments',
			'Discussion',
			'Conclusion'
		];
		for (const e of expected) {
			expect(
				seenTitles.has(e),
				`expected to find outline entry "${e}" in extracted tree (got: ${[...seenTitles].join(' | ')})`
			).toBe(true);
		}

		// Structural invariants: every node has a valid level and page range.
		function walk(nodes: typeof result.tree): void {
			for (const n of nodes) {
				expect(n.level).toBeGreaterThanOrEqual(0);
				expect(n.startPage).toBeGreaterThanOrEqual(1);
				expect(n.endPage).toBeGreaterThanOrEqual(n.startPage);
				expect(n.endPage).toBeLessThanOrEqual(doc.numPages);
				expect(n.title.length).toBeGreaterThan(0);
				walk(n.children);
			}
		}
		walk(result.tree);

		await doc.cleanup();
	});

	it('outline path: synthesizes an Abstract section when the PDF outline omits it', async () => {
		const doc = await loadFixture(FIXTURE_OUTLINE);
		const result = await extractPdf(doc);

		const abstractNode = result.tree.find((n) => n.title.toLowerCase() === 'abstract');
		expect(abstractNode).toBeDefined();
		expect(abstractNode!.startPage).toBe(1);
		expect(abstractNode!.text).toContain('Approximate nearest neighbor (ANN) search');

		const introNode = result.tree.find((n) => n.title === 'Introduction');
		expect(introNode).toBeDefined();
		expect(introNode!.text).not.toContain('Approximate nearest neighbor (ANN) search');

		await doc.cleanup();
	});

	it('font-size path: tree is non-empty with at least one detected heading and starts at page 1', async () => {
		const doc = await loadFixture(FIXTURE_PLAIN);
		const result = await extractPdf(doc);
		expect(result.tree.length).toBeGreaterThan(0);
		expect(result.tree[0].startPage).toBe(1);

		function maxLevel(
			nodes: { level: number; children: { level: number; children: unknown[] }[] }[]
		): number {
			let m = 0;
			for (const n of nodes) {
				if (n.level > m) m = n.level;
				const c = maxLevel(
					n.children as { level: number; children: { level: number; children: unknown[] }[] }[]
				);
				if (c > m) m = c;
			}
			return m;
		}
		expect(maxLevel(result.tree)).toBeGreaterThan(0);

		// At least one node should have level 1 (i.e. a detected heading).
		function hasLevel1(
			nodes: { level: number; children: { level: number; children: unknown[] }[] }[]
		): boolean {
			for (const n of nodes) {
				if (n.level === 1) return true;
				if (
					hasLevel1(
						n.children as { level: number; children: { level: number; children: unknown[] }[] }[]
					)
				)
					return true;
			}
			return false;
		}
		expect(hasLevel1(result.tree)).toBe(true);

		await doc.cleanup();
	});

	it('is deterministic across repeated calls on the same buffer', async () => {
		for (const url of [FIXTURE_PLAIN, FIXTURE_OUTLINE]) {
			const doc1 = await loadFixture(url);
			const doc2 = await loadFixture(url);
			const a = await extractPdf(doc1);
			const b = await extractPdf(doc2);
			expect(a.tree).toEqual(b.tree);
			expect(a.byPage).toEqual(b.byPage);
			await doc1.cleanup();
			await doc2.cleanup();
		}
	});

	it('toMarkdown produces a hierarchical document with page ranges and preserves byPage text', async () => {
		for (const url of [FIXTURE_PLAIN, FIXTURE_OUTLINE]) {
			const doc = await loadFixture(url);
			const result = await extractPdf(doc);
			const md = toMarkdown(result.tree);

			expect(md.length).toBeGreaterThan(0);
			expect(md.startsWith('# ')).toBe(true);

			const headingLines = md.split('\n').filter((l) => /^#{1,6} /.test(l));
			expect(headingLines.length).toBeGreaterThan(0);
			for (const line of headingLines) {
				expect(line).toMatch(/\(pages \d+-\d+\)$/);
			}

			// Concatenating every node's body text (modulo whitespace) should be a
			// substring of the concatenated byPage text — sections are page-aligned.
			const allNodeText = collectAllText(result.tree).replace(/\s+/g, ' ').trim();
			const allByPageText = result.byPage
				.map((p) => p.text)
				.join('\n')
				.replace(/\s+/g, ' ')
				.trim();
			expect(allByPageText).toContain(allNodeText.slice(0, 200));

			await doc.cleanup();
		}
	});

	it('every section has startPage <= endPage and endPage <= numPages', async () => {
		for (const url of [FIXTURE_PLAIN, FIXTURE_OUTLINE, FIXTURE_SHARED_OUTLINE]) {
			const doc = await loadFixture(url);
			const result = await extractPdf(doc);
			function walk(nodes: typeof result.tree): void {
				for (const n of nodes) {
					expect(n.startPage).toBeLessThanOrEqual(n.endPage);
					expect(n.endPage).toBeLessThanOrEqual(doc.numPages);
					walk(n.children);
				}
			}
			walk(result.tree);
			await doc.cleanup();
		}
	});

	it('outline path: sections sharing a start page do not duplicate text', async () => {
		const doc = await loadFixture(FIXTURE_SHARED_OUTLINE);
		const result = await extractPdf(doc);

		expect(result.tree.length).toBe(3);
		const [first, second, third] = result.tree;
		expect(first?.title).toBe('First Section');
		expect(second?.title).toBe('Second Section');
		expect(third?.title).toBe('Third Section');

		expect(first?.startPage).toBe(1);
		expect(first?.endPage).toBe(1);
		expect(second?.startPage).toBe(1);
		expect(second?.endPage).toBe(2);
		expect(third?.startPage).toBe(2);
		expect(third?.endPage).toBe(2);

		expect(first?.text).toContain('alpha');
		expect(first?.text).not.toContain('beta');

		expect(second?.text).toContain('beta');
		expect(second?.text).not.toContain('alpha');

		expect(third?.text).toContain('gamma');
		expect(third?.text).not.toContain('alpha');

		await doc.cleanup();
	});

	it('structure-tree path: sections sharing a start page do not duplicate text', async () => {
		const doc = await loadFixture(FIXTURE_SHARED_STRUCTURE);
		const result = await extractPdf(doc);

		expect(result.tree.length).toBeGreaterThanOrEqual(2);
		const titles = result.tree.map((n) => n.title);
		expect(titles).toContain('First Section');
		expect(titles).toContain('Second Section');

		const first = result.tree.find((n) => n.title === 'First Section');
		const second = result.tree.find((n) => n.title === 'Second Section');

		expect(first?.text).toContain('alpha');
		expect(first?.text).not.toContain('beta');

		expect(second?.text).toContain('beta');
		expect(second?.text).not.toContain('alpha');

		await doc.cleanup();
	});
});

function collectAllText(
	nodes: { text: string; children: { text: string; children: unknown[] }[] }[]
): string {
	const parts: string[] = [];
	for (const n of nodes) {
		parts.push(n.text);
		parts.push(
			collectAllText(
				n.children as { text: string; children: { text: string; children: unknown[] }[] }[]
			)
		);
	}
	return parts.join('\n');
}
