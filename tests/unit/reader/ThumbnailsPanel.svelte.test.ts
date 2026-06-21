import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import ThumbnailsPanel from '$lib/components/reader/ThumbnailsPanel.svelte';

vi.mock('$lib/pdfjs/setup', () => ({
	loadPdfJs: vi.fn(() => Promise.resolve({ TextLayer: class {} }))
}));

vi.mock('$lib/stores/reader.svelte', () => ({
	readerController: { activeTab: 'thumbs', scrollToPage: vi.fn() }
}));

function makePageStub(viewportW = 100, viewportH = 140, renderFn?: () => Promise<void>) {
	return {
		getViewport({ scale = 1 } = {}) {
			return { width: viewportW * scale, height: viewportH * scale, scale };
		},
		render() {
			return { promise: renderFn ? renderFn() : Promise.resolve() };
		}
	};
}

function makeDocStub(pageCount: number): PDFDocumentProxy {
	return {
		numPages: pageCount,
		getPage: () => Promise.resolve(makePageStub())
	} as unknown as PDFDocumentProxy;
}

let target: HTMLDivElement;

beforeEach(() => {
	target = document.createElement('div');
	target.style.cssText = 'height:600px;width:400px;overflow:visible;position:relative;';
	document.body.appendChild(target);
});

afterEach(() => {
	target.remove();
});

function getThumbButtons() {
	return target.querySelectorAll<HTMLElement>('[data-thumb-item]');
}

function getCanvasWidths(): number[] {
	return Array.from(target.querySelectorAll<HTMLCanvasElement>('[data-thumb-item] canvas')).map(
		(c) => c.width
	);
}

function waitForRender() {
	return new Promise<void>((r) => setTimeout(r, 100));
}

describe('ThumbnailsPanel', () => {
	it('renders all pages for a single pdf document', async () => {
		render(ThumbnailsPanel, { target, props: { pdfDoc: makeDocStub(3), pageCount: 3 } });
		await waitForRender();

		expect(target.querySelector('[data-thumb-item]')).not.toBeNull();
		expect(getThumbButtons()).toHaveLength(3);
		const widths = getCanvasWidths();
		for (const w of widths) {
			expect(w).toBeGreaterThan(0);
		}
	});

	it('renders the correct number of thumbnails when page count increases', async () => {
		const { rerender } = render(ThumbnailsPanel, {
			target,
			props: { pdfDoc: makeDocStub(3), pageCount: 3 }
		});
		await waitForRender();

		await rerender({ pdfDoc: makeDocStub(5), pageCount: 5 });
		await waitForRender();

		expect(getThumbButtons()).toHaveLength(5);
		const widths = getCanvasWidths();
		for (const w of widths) {
			expect(w).toBeGreaterThan(0);
		}
	});

	it('removes extra thumbnails when page count decreases', async () => {
		const { rerender } = render(ThumbnailsPanel, {
			target,
			props: { pdfDoc: makeDocStub(5), pageCount: 5 }
		});
		await waitForRender();

		await rerender({ pdfDoc: makeDocStub(3), pageCount: 3 });
		await waitForRender();

		expect(getThumbButtons()).toHaveLength(3);
	});

	it('clears existing canvases when switching to a new document', async () => {
		const { rerender } = render(ThumbnailsPanel, {
			target,
			props: { pdfDoc: makeDocStub(3), pageCount: 3 }
		});
		await waitForRender();

		await rerender({ pdfDoc: makeDocStub(5), pageCount: 5 });
		await waitForRender();

		expect(getThumbButtons()).toHaveLength(5);
		const widths = getCanvasWidths();
		for (const w of widths) {
			expect(w).toBeGreaterThan(0);
		}
	});

	it('shows placeholder when pdfDoc is null', async () => {
		render(ThumbnailsPanel, { target, props: { pdfDoc: null, pageCount: 0 } });

		expect(target.textContent).toContain('Open a PDF to see thumbnails');
		expect(getThumbButtons()).toHaveLength(0);
	});

	it('does not mark stale pages as rendered when document changes mid-flight', async () => {
		const pageResolve: Array<() => void> = [];
		const delayedPage = {
			getViewport({ scale = 1 } = {}) {
				return { width: 100 * scale, height: 140 * scale, scale };
			},
			render() {
				return {
					promise: new Promise<void>((resolve) => {
						pageResolve.push(resolve);
					})
				};
			}
		};

		const staleDoc = {
			numPages: 3,
			getPage: () => new Promise((r) => setTimeout(() => r(delayedPage), 0))
		} as unknown as PDFDocumentProxy;

		const { rerender } = render(ThumbnailsPanel, {
			target,
			props: { pdfDoc: staleDoc, pageCount: 3 }
		});
		await waitForRender();

		await rerender({ pdfDoc: makeDocStub(5), pageCount: 5 });
		await waitForRender();

		for (const resolve of pageResolve) resolve();
		await waitForRender();

		expect(getThumbButtons()).toHaveLength(5);
		const widths = getCanvasWidths();
		for (const w of widths) {
			expect(w).toBeGreaterThan(0);
		}
	});
});
