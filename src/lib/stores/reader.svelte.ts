import { browser } from '$app/environment';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { loadPdfJs } from '$lib/pdfjs/setup';
import { extractPdf } from '$lib/llm/extract';
import type { ExtractedPdf } from '$lib/llm/types';

export type ReaderTab = 'thumbs' | 'outline';

export type ViewerRef = {
	scrollToPage(n: number): void;
	fitToWidth(): void;
};

const PANE_BOUNDS = { min: 240, max: 720 } as const;

class ReaderController {
	showNav = $state(true);
	showAi = $state(true);
	activeTab = $state<ReaderTab>('thumbs');
	isMobile = $state(false);
	doc = $state.raw<{ name: string; data: ArrayBuffer } | null>(null);
	viewerRef = $state.raw<ViewerRef | null>(null);

	pdfDocument = $state.raw<PDFDocumentProxy | null>(null);
	loadError = $state<string | null>(null);

	extracted = $state.raw<ExtractedPdf | null>(null);
	extractionError = $state<string | null>(null);

	navPaneWidth = $state(256);
	aiPaneWidth = $state(320);

	zoomScale = $state(1.0);
	zoomMin = 0.25;
	zoomMax = 4.0;

	zoomIn() {
		this.zoomScale = Math.min(this.zoomMax, Math.floor(this.zoomScale * 4) / 4 + 0.25);
	}
	zoomOut() {
		this.zoomScale = Math.max(this.zoomMin, Math.ceil(this.zoomScale * 4) / 4 - 0.25);
	}
	setZoom(n: number) {
		this.zoomScale = Math.max(this.zoomMin, Math.min(this.zoomMax, Math.round(n * 100) / 100));
	}
	resetZoom() {
		this.zoomScale = 1.0;
	}
	fitToWidth() {
		this.viewerRef?.fitToWidth();
	}

	clampWidth(w: number) {
		return Math.max(PANE_BOUNDS.min, Math.min(PANE_BOUNDS.max, w));
	}

	setNavPaneWidth(w: number) {
		this.navPaneWidth = this.clampWidth(w);
		if (browser) localStorage.setItem('reader-nav-pane-width', String(this.navPaneWidth));
	}
	setAiPaneWidth(w: number) {
		this.aiPaneWidth = this.clampWidth(w);
		if (browser) localStorage.setItem('reader-ai-pane-width', String(this.aiPaneWidth));
	}

	toggleNav() {
		this.showNav = !this.showNav;
	}
	toggleAi() {
		this.showAi = !this.showAi;
	}

	setTab(tab: ReaderTab) {
		this.activeTab = tab;
	}

	async openPdfFile(file: File): Promise<void> {
		try {
			const data = await file.arrayBuffer();
			this.doc = { name: file.name, data };
		} catch (err) {
			console.error('Failed to read PDF file:', err);
		}
	}
	clearDoc() {
		this.doc = null;
	}

	openPdfDialog() {
		if (!browser) return;
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'application/pdf';
		input.style.display = 'none';
		input.onchange = async () => {
			const file = input.files?.[0];
			input.remove();
			if (file) await this.openPdfFile(file);
		};
		document.body.appendChild(input);
		input.click();
	}

	scrollToPage(n: number): void {
		this.viewerRef?.scrollToPage(n);
	}
}

export const readerController = new ReaderController();

if (browser) {
	const savedNav = localStorage.getItem('reader-nav-pane-width');
	if (savedNav) readerController.setNavPaneWidth(parseInt(savedNav, 10));
	const savedAi = localStorage.getItem('reader-ai-pane-width');
	if (savedAi) readerController.setAiPaneWidth(parseInt(savedAi, 10));

	const mql = window.matchMedia('(max-width: 767px)');
	readerController.isMobile = mql.matches;
	mql.addEventListener('change', (e) => {
		readerController.isMobile = e.matches;
	});

	document.addEventListener('keydown', (e) => {
		if (!e.ctrlKey && !e.metaKey) return;
		const target = e.target as HTMLElement;
		if (
			target &&
			(target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
		)
			return;

		if (e.key === '+' || e.key === '=' || e.key === 'NumpadAdd') {
			e.preventDefault();
			readerController.zoomIn();
		} else if (e.key === '-' || e.key === 'NumpadSubtract') {
			e.preventDefault();
			readerController.zoomOut();
		} else if (e.key === '0' || e.key === 'Numpad0') {
			e.preventDefault();
			readerController.resetZoom();
		}
	});

	// Parse the current doc into a shared PDFDocumentProxy. Re-runs whenever `doc`
	// changes; cleanup happens on swap or when the doc is cleared.
	$effect.root(() => {
		$effect(() => {
			const docState = readerController.doc;
			if (!docState) {
				const prev = readerController.pdfDocument;
				readerController.pdfDocument = null;
				readerController.loadError = null;
				readerController.extracted = null;
				readerController.extractionError = null;
				void prev?.cleanup();
				return;
			}

			let cancelled = false;
			readerController.loadError = null;
			readerController.extracted = null;
			readerController.extractionError = null;

			(async () => {
				try {
					const pdfjs = await loadPdfJs();
					const copy = docState.data.slice(0);
					const pdf = await pdfjs.getDocument({ data: copy }).promise;
					if (cancelled) {
						await pdf.cleanup();
						return;
					}
					const prev = readerController.pdfDocument;
					readerController.pdfDocument = pdf;
					if (prev) await prev.cleanup();

					try {
						const result = await extractPdf(pdf);
						if (cancelled) return;
						readerController.extracted = result;
					} catch (err) {
						if (cancelled) return;
						console.error('ReaderController: failed to extract PDF structure:', err);
						readerController.extractionError = err instanceof Error ? err.message : String(err);
					}
				} catch (err) {
					if (cancelled) return;
					console.error('ReaderController: failed to load PDF:', err);
					readerController.loadError = err instanceof Error ? err.message : String(err);
					readerController.pdfDocument = null;
				}
			})();

			return () => {
				cancelled = true;
			};
		});
	});
}
