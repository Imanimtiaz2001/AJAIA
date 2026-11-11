import StarterKit from '@tiptap/starter-kit';
import type { AnyExtension, JSONContent } from '@tiptap/core';

/**
 * Single source of truth for the document schema.
 *
 * The browser editor, the server-side content validator and the file importers
 * all build their ProseMirror schema from this list, so a document that the
 * server accepts is always one the editor can render (and vice versa).
 */
export const HEADING_LEVELS = [1, 2, 3] as const;
export type HeadingLevel = (typeof HEADING_LEVELS)[number];

export const ALLOWED_LINK_PROTOCOLS = ['http:', 'https:', 'mailto:'] as const;

export function isSafeHref(href: unknown): boolean {
  if (typeof href !== 'string' || href.trim() === '') return false;
  try {
    const url = new URL(href, 'https://placeholder.invalid');
    return (ALLOWED_LINK_PROTOCOLS as readonly string[]).includes(url.protocol);
  } catch {
    return false;
  }
}

export function createEditorExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [...HEADING_LEVELS] },
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        isAllowedUri: (url) => isSafeHref(url),
      },
    }),
  ];
}

export const EMPTY_DOCUMENT: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };

/** Plain-text projection of a document, used for list previews. */
export function extractPlainText(node: JSONContent | undefined, maxLength = 280): string {
  const parts: string[] = [];
  let length = 0;

  const visit = (current: JSONContent | undefined): void => {
    if (!current || length >= maxLength) return;
    if (current.type === 'text' && current.text) {
      parts.push(current.text);
      length += current.text.length;
      return;
    }
    current.content?.forEach(visit);
    // Block boundaries and hard breaks become a single space in the preview.
    if (parts.length > 0 && parts[parts.length - 1] !== ' ') {
      parts.push(' ');
      length += 1;
    }
  };

  visit(node);
  return parts.join('').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}
