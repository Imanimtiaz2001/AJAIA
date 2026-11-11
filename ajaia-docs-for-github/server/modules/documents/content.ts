import { getSchema, type JSONContent } from '@tiptap/core';
import { generateJSON } from '@tiptap/html/server';
import sanitizeHtml from 'sanitize-html';
import { createEditorExtensions, extractPlainText, isSafeHref } from '../../../shared/editor';
import { LIMITS } from '../../../shared/limits';
import { Errors } from '../../lib/errors';

const extensions = createEditorExtensions();
const schema = getSchema(extensions);

export interface NormalizedContent {
  content: JSONContent;
  text: string;
}

/**
 * Validates an editor document against the shared schema.
 * Rejects unknown node/mark types, malformed structure, unsafe links and
 * oversized bodies, so the database only ever holds renderable content.
 */
export function normalizeContent(input: unknown): NormalizedContent {
  if (JSON.stringify(input ?? null).length > LIMITS.contentMaxBytes) {
    throw Errors.payloadTooLarge('This document is too large to save (limit is about 1 MB).');
  }

  let node;
  try {
    node = schema.nodeFromJSON(input);
    node.check();
  } catch {
    throw Errors.badRequest('Document content is not valid.');
  }
  if (node.type.name !== 'doc') throw Errors.badRequest('Document content is not valid.');

  let unsafeLink = false;
  node.descendants((child) => {
    for (const mark of child.marks) {
      if (mark.type.name === 'link' && !isSafeHref(mark.attrs.href)) unsafeLink = true;
    }
    return !unsafeLink;
  });
  if (unsafeLink) throw Errors.badRequest('Links must use http, https or mailto.');

  const content = node.toJSON() as JSONContent;
  return { content, text: extractPlainText(content) };
}

/**
 * Allow-list sanitiser for HTML produced by importers. It runs before the
 * schema parser as defence in depth: scripts, styles, event handlers, images
 * and unknown tags never reach the document model.
 */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'del',
    'strike',
    'code',
    'pre',
    'ul',
    'ol',
    'li',
    'blockquote',
    'hr',
    'a',
  ],
  allowedAttributes: { a: ['href'], ol: ['start'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  disallowedTagsMode: 'discard',
  // Editor supports three heading levels; demote deeper ones instead of dropping them.
  transformTags: { h4: 'h3', h5: 'h3', h6: 'h3' },
};

export function htmlToContent(html: string): NormalizedContent {
  const clean = sanitizeHtml(html, SANITIZE_OPTIONS);
  const json = generateJSON(clean.trim() === '' ? '<p></p>' : clean, extensions);
  return normalizeContent(json);
}
