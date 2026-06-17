import { describe, expect, it } from 'vitest';
import { parseRichTextDocument } from '../../src/lib/server/validation/rich-text';

describe('rich text validation', () => {
	it('allows code block language attributes', () => {
		expect(
			parseRichTextDocument(
				{
					type: 'doc',
					content: [
						{
							type: 'codeBlock',
							attrs: { language: 'python' },
							content: [{ type: 'text', text: 'def f(): pass' }]
						}
					]
				},
				'notebook'
			)
		).not.toBeNull();
	});

	it('rejects math nodes until the editor can render them', () => {
		expect(() =>
			parseRichTextDocument(
				{
					type: 'doc',
					content: [{ type: 'inlineMath', attrs: { latex: 'x' } }]
				},
				'notebook'
			)
		).toThrow('unsupported content');
	});
});
