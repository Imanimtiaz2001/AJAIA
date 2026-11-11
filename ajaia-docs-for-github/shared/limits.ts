export const LIMITS = {
  titleMaxLength: 200,
  /** Serialized JSON size of a document body. */
  contentMaxBytes: 1_000_000,
  uploadMaxBytes: 2 * 1024 * 1024,
} as const;

export const DEFAULT_DOCUMENT_TITLE = 'Untitled document';

/** File types accepted by the importer. Shown in the UI and enforced by the API. */
export const SUPPORTED_IMPORTS = [
  { extension: '.docx', label: 'Word (.docx)' },
  { extension: '.md', label: 'Markdown (.md)' },
  { extension: '.markdown', label: 'Markdown (.markdown)' },
  { extension: '.txt', label: 'Plain text (.txt)' },
] as const;

export const SUPPORTED_IMPORT_EXTENSIONS: readonly string[] = SUPPORTED_IMPORTS.map((t) => t.extension);
export const SUPPORTED_IMPORTS_HINT = '.docx, .md or .txt, up to 2 MB';
