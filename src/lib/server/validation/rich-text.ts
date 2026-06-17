import { z } from 'zod';

export type RichTextDocument = {
	type: 'doc';
	content?: RichTextNode[];
};

type RichTextNode = {
	type: string;
	attrs?: Record<string, unknown>;
	content?: RichTextNode[];
	text?: string;
	marks?: RichTextMark[];
};

type RichTextMark = {
	type: string;
	attrs?: Record<string, unknown>;
};

export const RICH_TEXT_LIMITS = {
	notebook: 50 * 1024,
	recap: 12 * 1024
} as const;

const allowedNodes = new Set([
	'doc',
	'paragraph',
	'text',
	'heading',
	'bulletList',
	'orderedList',
	'listItem',
	'taskList',
	'taskItem',
	'codeBlock',
	'hardBreak'
]);
const allowedMarks = new Set(['bold', 'italic', 'code', 'link']);

export function parseRichTextDocument(
	value: unknown,
	variant: keyof typeof RICH_TEXT_LIMITS
): RichTextDocument | null {
	if (value === null || value === undefined || value === '') return null;
	const raw = typeof value === 'string' ? value : JSON.stringify(value);
	if (raw.length > RICH_TEXT_LIMITS[variant]) {
		throw new Error('Rich text document is too large.');
	}
	let document: unknown;
	try {
		document = typeof value === 'string' ? JSON.parse(value) : value;
	} catch {
		throw new Error('Rich text document is malformed.');
	}
	validateNode(document, 'doc');
	const normalized = document as RichTextDocument;
	return isEmptyDocument(normalized) ? null : normalized;
}

export function serializeRichTextDocument(
	value: unknown,
	variant: keyof typeof RICH_TEXT_LIMITS
) {
	const document = parseRichTextDocument(value, variant);
	return document ? JSON.stringify(document) : null;
}

export const richTextDocumentSchema = (
	variant: keyof typeof RICH_TEXT_LIMITS
) =>
	z.unknown().transform((value, ctx) => {
		try {
			return parseRichTextDocument(value, variant);
		} catch (error) {
			ctx.addIssue({
				code: 'custom',
				message:
					error instanceof Error
						? error.message
						: 'Rich text document is invalid.'
			});
			return z.NEVER;
		}
	});

function validateNode(
	value: unknown,
	expectedType?: string
): asserts value is RichTextNode {
	if (!isPlainObject(value)) throw new Error('Rich text node is malformed.');
	const type = value.type;
	if (typeof type !== 'string' || !allowedNodes.has(type)) {
		throw new Error('Rich text contains unsupported content.');
	}
	if (expectedType && type !== expectedType) {
		throw new Error('Rich text document must be a doc node.');
	}

	const allowedKeys = new Set(['type', 'attrs', 'content', 'text', 'marks']);
	for (const key of Object.keys(value)) {
		if (!allowedKeys.has(key))
			throw new Error('Rich text contains unsupported attributes.');
	}

	if (type === 'text') {
		if (typeof value.text !== 'string')
			throw new Error('Text node is malformed.');
		if (value.content !== undefined)
			throw new Error('Text nodes cannot contain children.');
	} else if (value.text !== undefined) {
		throw new Error('Only text nodes can contain text.');
	}

	validateAttrs(type, value.attrs);
	if (value.content !== undefined) {
		if (!Array.isArray(value.content))
			throw new Error('Rich text content is malformed.');
		for (const child of value.content) validateNode(child);
	}
	if (value.marks !== undefined) {
		if (type !== 'text' || !Array.isArray(value.marks)) {
			throw new Error('Rich text marks are malformed.');
		}
		for (const mark of value.marks) validateMark(mark);
	}
}

function validateAttrs(type: string, attrs: unknown) {
	if (attrs === undefined) return;
	if (!isPlainObject(attrs))
		throw new Error('Rich text attributes are malformed.');
	const keys = Object.keys(attrs);
	if (type === 'heading') {
		if (keys.length !== 1 || ![1, 2, 3].includes(Number(attrs.level))) {
			throw new Error('Heading level is not supported.');
		}
		return;
	}
	if (type === 'codeBlock') {
		if (keys.some((key) => key !== 'language')) {
			throw new Error('Code block attributes are not supported.');
		}
		if (
			attrs.language !== undefined &&
			attrs.language !== null &&
			typeof attrs.language !== 'string'
		) {
			throw new Error('Code block language is malformed.');
		}
		return;
	}
	if (type === 'orderedList') {
		if (keys.some((key) => key !== 'start' && key !== 'type')) {
			throw new Error('Ordered list attributes are not supported.');
		}
		if (
			attrs.start !== undefined &&
			(!Number.isInteger(attrs.start) || Number(attrs.start) < 1)
		) {
			throw new Error('Ordered list start is malformed.');
		}
		return;
	}
	if (type === 'taskItem') {
		if (keys.length !== 1 || typeof attrs.checked !== 'boolean') {
			throw new Error('Task item attributes are malformed.');
		}
		return;
	}
	if (keys.length > 0)
		throw new Error('Rich text attributes are not supported.');
}

function validateMark(value: unknown): asserts value is RichTextMark {
	if (
		!isPlainObject(value) ||
		typeof value.type !== 'string' ||
		!allowedMarks.has(value.type)
	) {
		throw new Error('Rich text contains unsupported marks.');
	}
	const allowedKeys = new Set(['type', 'attrs']);
	for (const key of Object.keys(value)) {
		if (!allowedKeys.has(key)) throw new Error('Rich text mark is malformed.');
	}
	if (value.type !== 'link') {
		if (
			value.attrs !== undefined &&
			isPlainObject(value.attrs) &&
			Object.keys(value.attrs).length > 0
		) {
			throw new Error('Rich text mark attributes are not supported.');
		}
		return;
	}
	if (!isPlainObject(value.attrs) || typeof value.attrs.href !== 'string') {
		throw new Error('Link is malformed.');
	}
	const keys = Object.keys(value.attrs);
	if (keys.some((key) => !['href', 'target', 'rel', 'class'].includes(key))) {
		throw new Error('Link attributes are not supported.');
	}
	let url: URL;
	try {
		url = new URL(value.attrs.href);
	} catch {
		throw new Error('Link URL is malformed.');
	}
	if (url.protocol !== 'https:')
		throw new Error('Only HTTPS links are allowed.');
}

function isEmptyDocument(document: RichTextDocument) {
	const content = document.content ?? [];
	if (content.length === 0) return true;
	return content.every(
		(node) => node.type === 'paragraph' && !node.content?.length
	);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
