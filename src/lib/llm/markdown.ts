import { browser } from '$app/environment';
import { marked } from 'marked';

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

let purify: typeof import('dompurify').default | null = null;

export async function renderMarkdown(text: string): Promise<string> {
	if (!browser) return escapeHtml(text);
	if (!purify) {
		const mod = await import('dompurify');
		purify = mod.default;
	}
	const raw = marked.parse(text, { async: false, gfm: true }) as string;
	return purify.sanitize(raw, { USE_PROFILES: { html: true } });
}
