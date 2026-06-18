<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { browser } from '$app/environment';
	import { readerController } from '$lib/stores/reader.svelte';
	import { loadPdfJs } from '$lib/pdfjs/setup';
	import type {
		AnnotationLayer,
		PDFDocumentProxy,
		PDFPageProxy,
		RenderTask,
		TextLayer
	} from 'pdfjs-dist';

	let scrollEl: HTMLDivElement | undefined = $state();

	export function scrollToPage(n: number) {
		if (!scrollEl) return;
		const target = scrollEl.querySelector<HTMLElement>(`[data-page-number="${n}"]`);
		target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	export function fitToWidth() {
		const doc = readerController.pdfDocument;
		if (!doc || !scrollEl) return;
		const computedStyle = window.getComputedStyle(scrollEl);
		const paddingLeft = parseFloat(computedStyle.paddingLeft);
		const paddingRight = parseFloat(computedStyle.paddingRight);
		const availableWidth = scrollEl.clientWidth - paddingLeft - paddingRight;

		void doc.getPage(1).then((page: PDFPageProxy) => {
			const viewport = page.getViewport({ scale: 1 });
			const newScale = availableWidth / viewport.width;
			readerController.setZoom(newScale);
		});
	}

	type LinkService = {
		setDocument(doc: PDFDocumentProxy | null): void;
		goToPage(val: number | string): void;
		goToDestination(dest: string | unknown[] | Promise<unknown[]>): Promise<void>;
		getDestinationHash(dest: string | unknown[]): string;
		getAnchorUrl(anchor: string): string;
		addLinkAttributes(link: HTMLAnchorElement, url: string, newWindow?: boolean): void;
		executeNamedAction(action: string | { action: string }): void;
		executeSetOCGState(action: unknown): Promise<void>;
		isInPresentationMode: boolean;
		externalLinkEnabled: boolean;
		externalLinkTarget: number;
		externalLinkRel: string;
		baseUrl: string | null;
		eventBus: { dispatch(name: string, data: unknown): void };
	};

	const LinkTarget = { NONE: 0, SELF: 1, BLANK: 2, PARENT: 3, TOP: 4 } as const;

	function createLinkService(): LinkService {
		let doc: PDFDocumentProxy | null = null;
		const noopEventBus = { dispatch: () => {} };
		return {
			setDocument(d) {
				doc = d;
			},
			async goToDestination(dest) {
				if (!doc) return;
				let explicit: unknown[] | null = null;
				if (typeof dest === 'string') {
					explicit = (await doc.getDestination(dest)) as unknown[] | null;
				} else if (Array.isArray(dest)) {
					explicit = dest;
				} else if (dest && typeof (dest as Promise<unknown[]>).then === 'function') {
					explicit = (await dest) as unknown[] | null;
				}
				if (!Array.isArray(explicit) || explicit.length === 0) return;
				const ref = explicit[0] as { num: number; gen: number } | number;
				let pageNumber: number;
				if (typeof ref === 'number') {
					pageNumber = ref + 1;
				} else if (ref && typeof ref === 'object') {
					const cached = doc.cachedPageNumber(ref);
					pageNumber = cached ?? (await doc.getPageIndex(ref)) + 1;
				} else {
					return;
				}
				if (pageNumber < 1 || pageNumber > doc.numPages) return;
				readerController.scrollToPage(pageNumber);
			},
			goToPage(val) {
				if (!doc) return;
				const pageNumber = typeof val === 'string' ? parseInt(val, 10) : val;
				if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > doc.numPages) return;
				readerController.scrollToPage(pageNumber);
			},
			getDestinationHash(dest) {
				return this.getAnchorUrl(
					'#' + encodeURIComponent(typeof dest === 'string' ? dest : JSON.stringify(dest))
				);
			},
			getAnchorUrl(anchor) {
				return this.baseUrl ? this.baseUrl + anchor : anchor;
			},
			addLinkAttributes(link, url, newWindow = false) {
				if (!url || typeof url !== 'string') return;
				link.href = url;
				const target = newWindow ? LinkTarget.BLANK : this.externalLinkTarget;
				link.target =
					target === LinkTarget.BLANK
						? '_blank'
						: target === LinkTarget.SELF
							? '_self'
							: target === LinkTarget.PARENT
								? '_parent'
								: target === LinkTarget.TOP
									? '_top'
									: '';
				link.rel = this.externalLinkRel;
			},
			executeNamedAction(action) {
				const name = typeof action === 'string' ? action : action?.action;
				if (name === 'Print') window.print();
			},
			async executeSetOCGState() {
				/* no-op: optional content groups not supported in this viewer */
			},
			isInPresentationMode: false,
			externalLinkEnabled: true,
			externalLinkTarget: LinkTarget.BLANK,
			externalLinkRel: 'noopener noreferrer',
			baseUrl: null,
			eventBus: noopEventBus
		};
	}

	let linkService = $state.raw<LinkService | null>(null);

	$effect(() => {
		const doc = readerController.pdfDocument;
		const ls = createLinkService();
		ls.setDocument(doc);
		linkService = ls;
		return () => {
			ls.setDocument(null);
			if (linkService === ls) linkService = null;
		};
	});

	function handleWheel(e: WheelEvent) {
		if (!e.ctrlKey && !e.metaKey) return;
		e.preventDefault();
		if (e.deltaY < 0) {
			readerController.zoomIn();
		} else if (e.deltaY > 0) {
			readerController.zoomOut();
		}
	}

	function renderPage(
		page: PDFPageProxy,
		canvas: HTMLCanvasElement,
		scale: number
	): RenderTask | null {
		if (!browser) return null;
		const ctx = canvas.getContext('2d');
		if (!ctx) return null;

		const dpr = window.devicePixelRatio || 1;
		const viewport = page.getViewport({ scale });

		canvas.style.width = `${viewport.width}px`;
		canvas.style.height = `${viewport.height}px`;
		canvas.width = Math.floor(viewport.width * dpr);
		canvas.height = Math.floor(viewport.height * dpr);

		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined;
		return page.render({ canvas, canvasContext: ctx, viewport, transform });
	}

	$effect(() => {
		const doc = readerController.pdfDocument;
		const scale = readerController.zoomScale;
		if (!doc) return;

		const root = scrollEl;
		if (!root) return;

		const ls = linkService;
		if (!ls) return;

		const activeTasks = new SvelteSet<RenderTask>();
		const activeTextLayers: Array<{ textLayer: TextLayer | null; cancelled: boolean }> = [];
		const activeAnnotationLayers: Array<{
			annotationLayer: AnnotationLayer | null;
			cancelled: boolean;
		}> = [];
		let cancelled = false;

		void (async () => {
			const pdfjs = await loadPdfJs();
			if (cancelled) return;

			for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
				const canvas = root.querySelector<HTMLCanvasElement>(
					`canvas[data-page-canvas="${pageNum}"]`
				);
				const textContainer = root.querySelector<HTMLDivElement>(
					`div[data-page-text="${pageNum}"]`
				);
				const annotContainer = root.querySelector<HTMLDivElement>(
					`div[data-page-annot="${pageNum}"]`
				);
				if (!canvas || !textContainer || !annotContainer) continue;

				void doc.getPage(pageNum).then(async (page: PDFPageProxy) => {
					if (cancelled) return;

					const viewport = page.getViewport({ scale });

					const task = renderPage(page, canvas, scale);
					if (task) {
						activeTasks.add(task);
						task.promise.then(() => activeTasks.delete(task)).catch(() => activeTasks.delete(task));
					}

					const textLayerEntry = { textLayer: null as TextLayer | null, cancelled: false };
					activeTextLayers.push(textLayerEntry);

					const annotationLayerEntry = {
						annotationLayer: null as AnnotationLayer | null,
						cancelled: false
					};
					activeAnnotationLayers.push(annotationLayerEntry);

					try {
						const textContent = await page.getTextContent();
						if (cancelled || textLayerEntry.cancelled) return;

						textContainer.style.setProperty('--scale-factor', String(viewport.scale));
						textContainer.style.setProperty('--user-unit', '1');
						textContainer.style.setProperty(
							'--total-scale-factor',
							'calc(var(--scale-factor) * var(--user-unit))'
						);

						const textLayer = new pdfjs.TextLayer({
							textContentSource: textContent,
							container: textContainer,
							viewport
						});

						textLayerEntry.textLayer = textLayer;
						await textLayer.render();
					} catch (err) {
						if (cancelled || textLayerEntry.cancelled) return;
						console.error(`Text layer render failed for page ${pageNum}:`, err);
					}

					if (cancelled || annotationLayerEntry.cancelled) return;

					try {
						pdfjs.setLayerDimensions(annotContainer, viewport);
						const annotationLayer = new pdfjs.AnnotationLayer({
							div: annotContainer,
							page,
							viewport: viewport.clone({ dontFlip: true }),
							linkService: ls
						} as ConstructorParameters<typeof pdfjs.AnnotationLayer>[0]);
						annotationLayerEntry.annotationLayer = annotationLayer;
						const annotations = await page.getAnnotations({ intent: 'display' });
						if (cancelled || annotationLayerEntry.cancelled) return;
						await annotationLayer.render({
							viewport,
							annotations,
							linkService: ls as never,
							div: annotContainer,
							page,
							renderForms: false
						});
					} catch (err) {
						if (cancelled || annotationLayerEntry.cancelled) return;
						console.error(`Annotation layer render failed for page ${pageNum}:`, err);
					}
				});
			}
		})();

		return () => {
			cancelled = true;
			activeTasks.forEach((task) => {
				try {
					task.cancel();
				} catch {
					/* ignore */
				}
			});
			activeTasks.clear();

			activeTextLayers.forEach((entry) => {
				entry.cancelled = true;
				if (entry.textLayer) {
					try {
						entry.textLayer.cancel();
					} catch {
						/* ignore */
					}
				}
			});

			activeAnnotationLayers.forEach((entry) => {
				entry.cancelled = true;
			});

			if (root) {
				const textContainers = root.querySelectorAll<HTMLDivElement>('div[data-page-text]');
				textContainers.forEach((tc) => {
					tc.innerHTML = '';
					tc.style.cssText = '';
				});

				const annotContainers = root.querySelectorAll<HTMLDivElement>('div[data-page-annot]');
				annotContainers.forEach((ac) => {
					ac.innerHTML = '';
					ac.style.cssText = '';
				});
			}
		};
	});
</script>

{#if readerController.loadError}
	<div class="flex h-full w-full items-center justify-center p-6">
		<div
			class="flex max-w-md flex-col gap-2 card border border-error-500 preset-tonal-surface p-6 text-center"
		>
			<h3 class="text-base font-semibold text-error-500">Failed to render PDF</h3>
			<p class="text-sm opacity-80">{readerController.loadError}</p>
		</div>
	</div>
{:else if readerController.pdfDocument}
	{@const pageCount = readerController.pdfDocument.numPages}
	<div
		bind:this={scrollEl}
		class="h-full w-full overflow-auto bg-surface-100-900 p-4"
		onwheel={handleWheel}
	>
		<div class="mx-auto flex flex-col items-center gap-4">
			{#each Array.from({ length: pageCount }, (_, i) => i + 1) as pageNum (pageNum)}
				<div data-page-number={pageNum} class="flex w-full flex-col items-center gap-1">
					<div class="relative">
						<canvas data-page-canvas={pageNum} class="rounded-sm bg-white shadow-sm"></canvas>
						<div data-page-text={pageNum} class="textLayer absolute inset-0 overflow-clip"></div>
						<div data-page-annot={pageNum} class="annotationLayer absolute inset-0"></div>
					</div>
					<span class="text-xs opacity-60">Page {pageNum}</span>
				</div>
			{/each}
		</div>
	</div>
{:else if readerController.doc}
	<div class="flex h-full w-full items-center justify-center">
		<div class="flex flex-col items-center gap-3 text-surface-950-50">
			<div
				class="h-8 w-8 animate-spin rounded-full border-2 border-surface-300-700 border-t-primary-500"
				aria-hidden="true"
			></div>
			<p class="text-sm opacity-70">Loading PDF…</p>
		</div>
	</div>
{/if}

<style>
	.textLayer {
		position: absolute;
		text-align: initial;
		inset: 0;
		overflow: clip;
		opacity: 1;
		line-height: 1;
		letter-spacing: normal;
		word-spacing: normal;
		text-size-adjust: none;
		forced-color-adjust: none;
		transform-origin: 0 0;
		caret-color: CanvasText;
		z-index: 0;
		--scale-factor: 1;
		--user-unit: 1;
		--total-scale-factor: calc(var(--scale-factor) * var(--user-unit));
		--min-font-size: 1;
		--text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size));
		--min-font-size-inv: calc(1 / var(--min-font-size));
	}

	.textLayer :global(span),
	.textLayer :global(br) {
		color: transparent;
		position: absolute;
		white-space: pre;
		cursor: text;
		transform-origin: 0% 0%;
		user-select: text;
		-webkit-user-select: text;
	}

	.textLayer :global(> :not(.markedContent)),
	.textLayer :global(.markedContent span:not(.markedContent)) {
		z-index: 1;
		--font-height: 0;
		font-size: calc(var(--text-scale-factor) * var(--font-height));
		--scale-x: 1;
		--rotate: 0deg;
		transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv));
	}

	.textLayer :global(.markedContent) {
		display: contents;
	}

	.textLayer :global(span[role='img']) {
		user-select: none;
		-webkit-user-select: none;
		cursor: default;
	}

	.textLayer :global(::selection) {
		background: color-mix(in srgb, AccentColor, transparent 50%);
		color: transparent;
	}

	/* Chromium renders a selection background on <br> elements in the text layer,
	 causing a stray blue square at the top-left of the page. Keep the <br> in the
	 selection (so copy/paste line breaks are unaffected) but make its highlight
	 invisible. Firefox does not paint this background, so it is unaffected. */
	.textLayer :global(br::selection) {
		background: transparent;
	}
</style>
