<script lang="ts">
	import { browser } from '$app/environment';
	import {
		Bold,
		Code,
		Code2,
		Heading1,
		Heading2,
		Heading3,
		Italic,
		Link,
		List,
		ListChecks,
		ListOrdered
	} from '@lucide/svelte';
	import { onDestroy, onMount } from 'svelte';
	import { Editor, type JSONContent } from '@tiptap/core';
	import LinkExtension from '@tiptap/extension-link';
	import { TaskItem, TaskList } from '@tiptap/extension-list';
	import StarterKit from '@tiptap/starter-kit';
	import type { RichTextDocument } from '$lib/server/validation/rich-text';
	import './edra/editor.css';
	import './edra/onedark.css';

	type Variant = 'notebook' | 'recap';

	let {
		document = null,
		editable = true,
		onChange,
		variant = 'notebook'
	}: {
		document?: RichTextDocument | null;
		editable?: boolean;
		onChange?: (document: RichTextDocument | null) => void;
		variant?: Variant;
	} = $props();

	let editor = $state<Editor | null>(null);
	let element = $state<HTMLElement>();

	const emptyDocument: RichTextDocument = {
		type: 'doc',
		content: [{ type: 'paragraph' }]
	};
	const toolbar = [
		{
			label: 'Heading 1',
			icon: Heading1,
			active: () => editor?.isActive('heading', { level: 1 }),
			run: () => editor?.chain().focus().toggleHeading({ level: 1 }).run()
		},
		{
			label: 'Heading 2',
			icon: Heading2,
			active: () => editor?.isActive('heading', { level: 2 }),
			run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run()
		},
		{
			label: 'Heading 3',
			icon: Heading3,
			active: () => editor?.isActive('heading', { level: 3 }),
			run: () => editor?.chain().focus().toggleHeading({ level: 3 }).run()
		},
		{
			label: 'Bold',
			icon: Bold,
			active: () => editor?.isActive('bold'),
			run: () => editor?.chain().focus().toggleBold().run()
		},
		{
			label: 'Italic',
			icon: Italic,
			active: () => editor?.isActive('italic'),
			run: () => editor?.chain().focus().toggleItalic().run()
		},
		{
			label: 'Inline code',
			icon: Code,
			active: () => editor?.isActive('code'),
			run: () => editor?.chain().focus().toggleCode().run()
		},
		{
			label: 'Bullet list',
			icon: List,
			active: () => editor?.isActive('bulletList'),
			run: () => editor?.chain().focus().toggleBulletList().run()
		},
		{
			label: 'Ordered list',
			icon: ListOrdered,
			active: () => editor?.isActive('orderedList'),
			run: () => editor?.chain().focus().toggleOrderedList().run()
		},
		{
			label: 'Task list',
			icon: ListChecks,
			active: () => editor?.isActive('taskList'),
			run: () => editor?.chain().focus().toggleTaskList().run()
		},
		{
			label: 'Code block',
			icon: Code2,
			active: () => editor?.isActive('codeBlock'),
			run: () => editor?.chain().focus().toggleCodeBlock().run()
		},
		{
			label: 'HTTPS link',
			icon: Link,
			active: () => editor?.isActive('link'),
			run: () => toggleLink()
		}
	];

	$effect(() => {
		editor?.setEditable(editable);
	});

	onMount(() => {
		if (!browser) return;
		editor = new Editor({
			element,
			content: document ?? emptyDocument,
			editable,
			extensions: [
				StarterKit.configure({
					heading: { levels: [1, 2, 3] },
					link: false
				}),
				TaskList,
				TaskItem.configure({ nested: true }),
				LinkExtension.configure({
					openOnClick: false,
					autolink: true,
					linkOnPaste: true,
					isAllowedUri: (url) => {
						try {
							return new URL(url).protocol === 'https:';
						} catch {
							return false;
						}
					},
					HTMLAttributes: {
						target: '_blank',
						rel: 'noopener noreferrer nofollow'
					}
				})
			],
			onUpdate: ({ editor }) => {
				onChange?.(normalizeDocument(editor.getJSON()));
			},
			editorProps: {
				handlePaste(view, event) {
					const text = event.clipboardData?.getData('text/plain');
					const match = text?.match(/^```([a-zA-Z0-9_-]+)?\n([\s\S]*?)\n?```$/);
					if (!match || !editor) return false;
					event.preventDefault();
					editor
						.chain()
						.focus()
						.insertContent({
							type: 'codeBlock',
							attrs: { language: match[1] ?? null },
							content: match[2] ? [{ type: 'text', text: match[2] }] : []
						})
						.run();
					return true;
				}
			}
		});
	});

	onDestroy(() => {
		editor?.destroy();
	});

	function normalizeDocument(value: JSONContent): RichTextDocument | null {
		const doc = value as RichTextDocument;
		if (
			!doc.content?.length ||
			doc.content.every(
				(node) => node.type === 'paragraph' && !node.content?.length
			)
		) {
			return null;
		}
		return doc;
	}

	function toggleLink() {
		if (!editor) return;
		if (editor.isActive('link')) {
			editor.chain().focus().unsetLink().run();
			return;
		}
		const href = window.prompt('HTTPS URL');
		if (!href) return;
		let url: URL;
		try {
			url = new URL(href);
		} catch {
			window.alert('Use a valid HTTPS URL.');
			return;
		}
		if (url.protocol !== 'https:') {
			window.alert('Only HTTPS links are allowed.');
			return;
		}
		editor.chain().focus().setLink({ href: url.toString() }).run();
	}
</script>

<div class={`rich-editor rich-editor-${variant}`}>
	{#if editable && editor}
		<div class="flex flex-wrap gap-1 border-b border-line bg-white/80 p-2">
			{#each toolbar as item (item.label)}
				{@const Icon = item.icon}
				<button
					type="button"
					class={`rounded border border-transparent p-2 text-muted hover:border-line hover:bg-white hover:text-ink ${item.active() ? 'border-line bg-white text-ink' : ''}`}
					title={item.label}
					aria-label={item.label}
					onclick={item.run}
				>
					<Icon size={16} aria-hidden="true" />
				</button>
			{/each}
		</div>
	{/if}
	<div
		class={`min-h-32 bg-white ${variant === 'notebook' ? 'min-h-72' : 'min-h-32'}`}
	>
		<div bind:this={element}></div>
	</div>
</div>

<style>
	.rich-editor {
		overflow: hidden;
		border: 1px solid var(--color-line);
		border-radius: 0.5rem;
		background: white;
	}

	.rich-editor :global(.ProseMirror) {
		min-height: inherit;
		padding: 0.875rem 1rem;
		outline: none;
		line-height: 1.65;
	}

	.rich-editor :global(.ProseMirror ul:not([data-type='taskList'])) {
		margin: 0.75rem 0;
		list-style: disc;
		padding-left: 1.5rem;
	}

	.rich-editor :global(.ProseMirror ol) {
		margin: 0.75rem 0;
		list-style: decimal;
		padding-left: 1.5rem;
	}

	.rich-editor :global(.ProseMirror li) {
		margin: 0.25rem 0;
	}

	.rich-editor :global(.ProseMirror ul[data-type='taskList']) {
		margin: 0.75rem 0;
		list-style: none;
		padding-left: 0;
	}

	.rich-editor :global(.ProseMirror ul[data-type='taskList'] li) {
		display: flex;
		gap: 0.5rem;
	}

	.rich-editor :global(.ProseMirror pre) {
		margin: 0.875rem 0;
		overflow-x: auto;
		border-radius: 0.5rem;
		background: #1f1b16;
		color: #f8f4ec;
		padding: 0.875rem 1rem;
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
			monospace;
		font-size: 0.9rem;
		line-height: 1.55;
	}

	.rich-editor :global(.ProseMirror pre code) {
		background: transparent;
		color: inherit;
		padding: 0;
	}

	.rich-editor :global(.ProseMirror code) {
		border-radius: 0.25rem;
		background: color-mix(in srgb, var(--color-line) 45%, white);
		padding: 0.1rem 0.3rem;
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
			monospace;
		font-size: 0.9em;
	}

	.rich-editor-recap :global(.ProseMirror) {
		min-height: 8rem;
	}

	.rich-editor-notebook :global(.ProseMirror) {
		min-height: 18rem;
	}
</style>
