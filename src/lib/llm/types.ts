export type ChatRole = 'system' | 'user' | 'assistant';

export type ChatMessage = {
	role: ChatRole;
	content: string;
};

export type LlmSettings = {
	baseUrl: string;
	apiKey?: string;
	model: string;
};

export type ChatDelta = {
	content?: string;
	reasoningContent?: string;
	finishReason?: string | null;
};

export type ChatRequest = LlmSettings & {
	messages: ChatMessage[];
	signal?: AbortSignal;
	temperature?: number;
};

export type StreamChatRequest = ChatRequest & {
	onDelta: (delta: ChatDelta) => void;
};

export class LlmError extends Error {
	status?: number;
	code?: string;

	constructor(message: string, opts?: { status?: number; code?: string; cause?: unknown }) {
		super(message);
		this.name = 'LlmError';
		this.status = opts?.status;
		this.code = opts?.code;
		if (opts?.cause !== undefined) this.cause = opts.cause;
	}
}
