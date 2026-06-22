import { browser } from '$app/environment';

export type UiChatRole = 'user' | 'assistant';

export type UiChatMessage = {
	role: UiChatRole;
	content: string;
	reasoningContent?: string;
	isStreaming?: boolean;
};

const THINKING_SNIPPETS = [
	'Let me look through the document structure…',
	'Checking the sections and page references…',
	'Organizing the key points…',
	'Thinking about the best way to answer…'
];

const RESPONSE_SNIPPETS = [
	'That is an interesting question. Based on what I can see, the document covers several related topics.',
	'I would suggest starting with the introduction and then moving to the sections that match your question.',
	'From the extracted structure, there appear to be multiple angles to explore here.',
	'Good question! The document has a clear structure, so the answer likely depends on which section you focus on.',
	'I do not have enough context to give a definitive answer, but the outline suggests a few relevant pages.'
];

function pickRandom<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

class ChatController {
	messages = $state<UiChatMessage[]>([]);
	isThinking = $state(false);
	isStreaming = $state(false);
	error = $state<string | null>(null);

	private abortController: AbortController | null = null;

	send(text: string) {
		if (!browser) return;
		this.abort();

		this.messages = [...this.messages, { role: 'user', content: text }];
		this.isThinking = true;
		this.isStreaming = false;
		this.error = null;

		this.abortController = new AbortController();
		const signal = this.abortController.signal;

		const reasoningContent = pickRandom(THINKING_SNIPPETS);
		const responseWords = pickRandom(RESPONSE_SNIPPETS).split(' ');

		const assistantMessage: UiChatMessage = {
			role: 'assistant',
			content: '',
			reasoningContent,
			isStreaming: true
		};

		setTimeout(
			() => {
				if (signal.aborted) return;
				this.isThinking = false;
				this.isStreaming = true;
				this.messages = [...this.messages, assistantMessage];

				let index = 0;
				const streamWord = () => {
					if (signal.aborted) return;
					if (index >= responseWords.length) {
						this.isStreaming = false;
						assistantMessage.isStreaming = false;
						this.messages = [...this.messages];
						return;
					}
					assistantMessage.content += (index > 0 ? ' ' : '') + responseWords[index];
					index++;
					this.messages = [...this.messages];
					setTimeout(streamWord, 25 + Math.random() * 55);
				};
				streamWord();
			},
			1200 + Math.random() * 800
		);
	}

	abort() {
		this.abortController?.abort();
		this.abortController = null;
		this.isThinking = false;
		this.isStreaming = false;
		for (const message of this.messages) {
			if (message.isStreaming) message.isStreaming = false;
		}
	}

	clear() {
		this.abort();
		this.messages = [];
		this.error = null;
	}
}

export const chatController = new ChatController();
