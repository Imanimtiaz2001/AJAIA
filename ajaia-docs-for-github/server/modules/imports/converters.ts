import { extname } from 'node:path';
import type { JSONContent } from '@tiptap/core';
import mammoth from 'mammoth';
import { marked } from 'marked';
import { LIMITS, SUPPORTED_IMPORTS_HINT, SUPPORTED_IMPORT_EXTENSIONS } from '../../../shared/limits';
import { Errors } from '../../lib/errors';
import { htmlToContent, type NormalizedContent } from '../documents/content';

export interface UploadedFile {
  originalName: string;
  buffer: Buffer;
}

export interface ConvertedFile extends NormalizedContent {
  title: string;
}

/** Strategy per file type. Supporting a new format means adding one entry here. */
interface Converter {
  extensions: readonly string[];
  toHtml(buffer: Buffer): Promise<string>;
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function decodeUtf8(buffer: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^﻿/, '');
  } catch {
    throw Errors.unreadableFile('This file is not UTF-8 text. Save it as UTF-8 and try again.');
  }
}

const plainText: Converter = {
  extensions: ['.txt'],
  async toHtml(buffer) {
    // Blank lines separate paragraphs; single newlines become line breaks.
    return decodeUtf8(buffer)
      .replace(/\r\n?/g, '\n')
      .split(/\n{2,}/)
      .filter((block) => block.trim() !== '')
      .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
      .join('');
  },
};

const markdown: Converter = {
  extensions: ['.md', '.markdown'],
  async toHtml(buffer) {
    return marked.parse(decodeUtf8(buffer), { gfm: true, async: false });
  },
};

const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

const docx: Converter = {
  extensions: ['.docx'],
  async toHtml(buffer) {
    if (!buffer.subarray(0, 4).equals(ZIP_MAGIC)) {
      throw Errors.unreadableFile('This does not look like a valid .docx file.');
    }
    try {
      const { value } = await mammoth.convertToHtml({ buffer });
      return value;
    } catch {
      throw Errors.unreadableFile('We could not read this .docx file. It may be corrupted or password protected.');
    }
  },
};

const CONVERTERS: readonly Converter[] = [plainText, markdown, docx];

/** Prefer the document's own top-level heading; fall back to a tidied file name. */
function titleFor(fileName: string, content: JSONContent): string {
  const firstBlock = content.content?.[0];
  const heading =
    firstBlock?.type === 'heading' && firstBlock.attrs?.level === 1
      ? (firstBlock.content ?? [])
          .map((node) => node.text ?? '')
          .join('')
          .trim()
      : '';
  const fromName = fileName
    .slice(0, fileName.length - extname(fileName).length)
    .replace(/[_-]+/g, ' ')
    .trim();
  return (heading || fromName || 'Imported document').slice(0, LIMITS.titleMaxLength);
}

export async function convertUpload(file: UploadedFile | undefined): Promise<ConvertedFile> {
  if (!file) throw Errors.badRequest('Choose a file to upload.');
  const extension = extname(file.originalName).toLowerCase();
  const converter = CONVERTERS.find((c) => c.extensions.includes(extension));
  if (!converter || !SUPPORTED_IMPORT_EXTENSIONS.includes(extension)) {
    throw Errors.unsupportedFileType(`Unsupported file type. Upload ${SUPPORTED_IMPORTS_HINT}.`);
  }
  if (file.buffer.length === 0) throw Errors.unreadableFile('This file is empty.');

  const normalized = htmlToContent(await converter.toHtml(file.buffer));
  return { title: titleFor(file.originalName, normalized.content), ...normalized };
}
