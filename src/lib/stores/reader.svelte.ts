import { browser } from '$app/environment';

export type ReaderTab = 'thumbs' | 'outline';

class ReaderController {
	showNav = $state(true);
	showAi = $state(true);
	mobileNavOpen = $state(false);
	activeTab = $state<ReaderTab>('thumbs');
	isMobile = $state(false);
	doc = $state.raw<{ name: string; data: ArrayBuffer } | null>(null);

	toggleNav() {
		this.showNav = !this.showNav;
	}
	toggleAi() {
		this.showAi = !this.showAi;
	}
	openMobileNav() {
		this.mobileNavOpen = true;
	}
	closeMobileNav() {
		this.mobileNavOpen = false;
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
}

export const readerController = new ReaderController();

if (browser) {
	const mql = window.matchMedia('(max-width: 767px)');
	readerController.isMobile = mql.matches;
	mql.addEventListener('change', (e) => {
		readerController.isMobile = e.matches;
	});

	document.documentElement.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') readerController.closeMobileNav();
	});
}
