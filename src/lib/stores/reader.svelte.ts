import { browser } from '$app/environment';

export type ReaderTab = 'thumbs' | 'outline';

export type ViewerRef = {
	scrollToPage(n: number): void;
};

class ReaderController {
	showNav = $state(true);
	showAi = $state(true);
	activeTab = $state<ReaderTab>('thumbs');
	isMobile = $state(false);
	doc = $state.raw<{ name: string; data: ArrayBuffer } | null>(null);
	viewerRef = $state.raw<ViewerRef | null>(null);

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
	const mql = window.matchMedia('(max-width: 767px)');
	readerController.isMobile = mql.matches;
	mql.addEventListener('change', (e) => {
		readerController.isMobile = e.matches;
	});
}
