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

export type PdfSectionNode = {
	title: string;
	level: number;
	startPage: number;
	endPage: number;
	text: string;
	children: PdfSectionNode[];
};

export type PdfPageText = {
	pageNumber: number;
	text: string;
};

export type ExtractedPdf = {
	tree: PdfSectionNode[];
	byPage: PdfPageText[];
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
