import { browser } from '$app/environment';

export type ReaderTab = 'thumbs' | 'outline';

export type ViewerRef = {
	scrollToPage(n: number): void;
	fitToWidth(): void;
};

class ReaderController {
	showNav = $state(true);
	showAi = $state(true);
	activeTab = $state<ReaderTab>('thumbs');
	isMobile = $state(false);
	doc = $state.raw<{ name: string; data: ArrayBuffer } | null>(null);
	viewerRef = $state.raw<ViewerRef | null>(null);

	navPaneWidth = $state(256);
	aiPaneWidth = $state(320);
	minPaneWidth = 240;
	maxPaneWidth = 720;

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
		return Math.max(this.minPaneWidth, Math.min(this.maxPaneWidth, w));
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
}
