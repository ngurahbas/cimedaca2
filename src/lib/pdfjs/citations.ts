// Matches: [1], [1,2], [1-3], [cit_1], [Smith2020], [Smith, 2020], [Smith and Jones, 2020],
// (Smith, 2020), (Smith and Jones, 2020), and Unicode superscript runs (¹², ¹²³, etc.).
const CITATION_RE =
	/\[(?:\d+(?:[-,]\s*\d+)*|cit[_-]?\d+|[A-Z][A-Za-z'-]*(?:\s+(?:and|&)\s+[A-Z][A-Za-z'-]*)?,?\s*\d{4}[a-z]?)\]|\([A-Z][A-Za-z'-]*(?:\s+(?:and|&)\s+[A-Z][A-Za-z'-]*)?,?\s*\d{4}[a-z]?\)|[\u00B9\u00B2\u00B3\u2070-\u2079]+/g;

const BUTTON_CLASSES =
	'citation-chip pointer-events-auto inline-flex items-center rounded-sm bg-primary-500/15 px-1 align-baseline text-primary-500 transition-colors outline-none select-none hover:bg-primary-500/25 hover:text-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500';

export function injectCitationButtons(textContainer: HTMLElement, pageNumber: number): void {
	for (const span of textContainer.querySelectorAll('span')) {
		if (span.classList.contains('markedContent')) continue;
		if (span.children.length > 0) continue;

		const text = span.textContent;
		if (!text) continue;

		const matches = [...text.matchAll(CITATION_RE)];
		if (matches.length === 0) continue;

		const fragment = document.createDocumentFragment();
		let lastIndex = 0;
		for (const match of matches) {
			const idx = match.index ?? 0;
			if (idx > lastIndex) {
				fragment.appendChild(document.createTextNode(text.slice(lastIndex, idx)));
			}
			const button = document.createElement('button');
			button.type = 'button';
			button.className = BUTTON_CLASSES;
			button.dataset.citation = '';
			button.dataset.page = String(pageNumber);
			button.setAttribute('aria-label', `Citation ${match[0]} on page ${pageNumber}`);
			button.textContent = match[0];
			button.addEventListener('click', () => {
				console.log('[citation] clicked', { label: match[0], page: pageNumber });
			});
			fragment.appendChild(button);
			lastIndex = idx + match[0].length;
		}
		if (lastIndex < text.length) {
			fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
		}

		span.replaceChildren(fragment);
	}
}
