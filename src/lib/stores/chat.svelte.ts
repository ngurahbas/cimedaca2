import { browser } from '$app/environment';
import { LlmError } from '$lib/llm/types';
import { streamChat } from '$lib/llm/client';
import { toMarkdown } from '$lib/llm/extract';
import { llmController } from '$lib/stores/llm.svelte';
import { readerController } from '$lib/stores/reader.svelte';
import type { ChatMessage, ChatDelta, PdfSectionNode } from '$lib/llm/types';

export type UiChatRole = 'user' | 'assistant';

export type UiChatMessage = {
	role: UiChatRole;
	content: string;
	reasoningContent?: string;
	isStreaming?: boolean;
};

const CONTEXT_LIMIT_STORAGE_KEY = 'chat-context-limit';
const MIN_CONTEXT_LIMIT = 4096;
const MAX_CONTEXT_LIMIT = 1_000_000;
const DEFAULT_CONTEXT_LIMIT = 120_000;

export { DEFAULT_CONTEXT_LIMIT, MAX_CONTEXT_LIMIT, MIN_CONTEXT_LIMIT };

class ChatController {
	messages = $state<UiChatMessage[]>([]);
	isThinking = $state(false);
	isStreaming = $state(false);
	error = $state<string | null>(null);
	contextLimit = $state(DEFAULT_CONTEXT_LIMIT);

	private abortController: AbortController | null = null;

	constructor() {
		this.loadContextLimit();
	}

	setContextLimit(n: number) {
		const clamped = Math.max(MIN_CONTEXT_LIMIT, Math.min(MAX_CONTEXT_LIMIT, Math.round(n)));
		this.contextLimit = clamped;
		if (browser) {
			localStorage.setItem(CONTEXT_LIMIT_STORAGE_KEY, String(clamped));
		}
	}

	private loadContextLimit() {
		if (!browser) return;
		const raw = localStorage.getItem(CONTEXT_LIMIT_STORAGE_KEY);
		if (!raw) return;
		const parsed = Number(raw);
		if (!Number.isNaN(parsed)) {
			this.contextLimit = Math.max(MIN_CONTEXT_LIMIT, Math.min(MAX_CONTEXT_LIMIT, parsed));
		}
	}

	send(text: string) {
		if (!browser) return;
		this.abort();
		this.error = null;

		console.log('[chat] send() called:', text.slice(0, 80));

		const settings = llmController.asSettings();
		if (!settings) {
			console.warn('[chat] LLM not configured');
			this.error = 'LLM provider is not configured. Verify your settings first.';
			return;
		}
		console.log('[chat] settings:', { baseUrl: settings.baseUrl, model: settings.model });

		const doc = readerController.doc;
		const extracted = readerController.extracted;
		if (!doc || !extracted) {
			console.warn('[chat] no doc or extraction:', { doc: !!doc, extracted: !!extracted });
			this.error = 'Open a PDF and wait for extraction to finish before chatting.';
			return;
		}

		const history = this.toChatMessages(this.messages);
		this.messages = [...this.messages, { role: 'user', content: text }];
		this.isThinking = true;

		this.messages = [...this.messages, { role: 'assistant', content: '', isStreaming: true }];
		const assistantIndex = this.messages.length - 1;
		console.log('[chat] assistant message index:', assistantIndex);

		this.abortController = new AbortController();
		const signal = this.abortController.signal;

		(async () => {
			try {
				const context = this.buildContext(doc.name, extracted.tree);
				console.log('[chat] context length:', context.length);
				const messages: ChatMessage[] = [
					{ role: 'system', content: context },
					...history,
					{ role: 'user', content: text }
				];

				if (signal.aborted) return;

				this.isThinking = false;
				this.isStreaming = true;

				await streamChat({
					...settings,
					messages,
					signal,
					onDelta: (delta) => {
						this.applyDelta(assistantIndex, delta);
					}
				});

				if (!signal.aborted) {
					console.log('[chat] stream finished');
					this.setAssistantStreaming(assistantIndex, false);
					this.isStreaming = false;
				}
			} catch (err) {
				if (signal.aborted) {
					console.log('[chat] aborted by user');
					return;
				}
				console.error('[chat] stream error:', err);
				this.setAssistantStreaming(assistantIndex, false);
				this.isStreaming = false;
				this.error = err instanceof LlmError ? err.message : 'An unexpected error occurred';
			} finally {
				this.abortController = null;
			}
		})();
	}

	private applyDelta(index: number, delta: ChatDelta) {
		const message = this.messages[index];
		if (!message || message.role !== 'assistant') {
			console.warn('[chat] cannot update message at index', index, message);
			return;
		}
		if (delta.content !== undefined) {
			message.content += delta.content;
		}
		if (delta.reasoningContent !== undefined) {
			message.reasoningContent = (message.reasoningContent ?? '') + delta.reasoningContent;
		}
		console.log('[chat] delta applied:', {
			contentLen: message.content.length,
			reasoningLen: message.reasoningContent?.length
		});
	}

	private setAssistantStreaming(index: number, isStreaming: boolean) {
		const message = this.messages[index];
		if (!message || message.role !== 'assistant') {
			console.warn('[chat] cannot set streaming at index', index, message);
			return;
		}
		message.isStreaming = isStreaming;
	}

	private buildContext(docName: string, tree: PdfSectionNode[]): string {
		const markdown = toMarkdown(tree);
		const truncated =
			markdown.length > this.contextLimit
				? markdown.slice(0, this.contextLimit) + '\n\n... [document context truncated]'
				: markdown;
		return [
			`You are a helpful research assistant answering questions about the PDF document "${docName}".`,
			'Use the extracted content below to answer. If the answer is not in the document, say so.',
			'',
			'```markdown',
			truncated,
			'```'
		].join('\n');
	}

	private toChatMessages(messages: UiChatMessage[]): ChatMessage[] {
		return messages
			.filter((m) => m.role === 'user' || m.role === 'assistant')
			.map((m) => ({ role: m.role, content: m.content }));
	}

	abort() {
		this.abortController?.abort();
		this.abortController = null;
		this.isThinking = false;
		this.isStreaming = false;
		for (const message of this.messages) {
			if (message.isStreaming) {
				message.isStreaming = false;
			}
		}
	}

	clear() {
		this.abort();
		this.messages = [];
		this.error = null;
	}
}

export const chatController = new ChatController();
