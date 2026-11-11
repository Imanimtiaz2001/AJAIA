import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ALICE, createTestContext, signIn, type Client, type TestContext } from './helpers';

let ctx: TestContext;
let alice: Client;

beforeAll(async () => {
  ctx = await createTestContext();
  alice = await signIn(ctx.app, ALICE);
});
afterAll(async () => {
  await ctx.db.close();
});

const upload = (path: string, body: Buffer | string, filename: string) =>
  alice.post(path).attach('file', Buffer.isBuffer(body) ? body : Buffer.from(body), filename);

describe('file import', () => {
  it('turns a Markdown file into a new, editable document', async () => {
    const md = '# Release notes\n\nWe shipped **sharing** and _imports_.\n\n- one\n- two\n\n<script>alert(1)</script>';
    const res = await upload('/api/imports/documents', md, 'release_notes.md');
    expect(res.status).toBe(201);

    const doc = res.body.document;
    expect(doc).toMatchObject({ title: 'Release notes', role: 'owner', version: 1 });
    const types = doc.content.content.map((n: { type: string }) => n.type);
    expect(types).toEqual(['heading', 'paragraph', 'bulletList']);
    expect(JSON.stringify(doc.content)).not.toContain('script');

    // It is a normal document: it shows up in the owner's list and can be edited.
    const list = await alice.get('/api/documents?scope=owned');
    expect(list.body.documents.map((d: { id: string }) => d.id)).toContain(doc.id);
  });

  it('keeps paragraphs and line breaks from plain text', async () => {
    const res = await upload('/api/imports/documents', 'First line\nsecond line\n\nNew paragraph', 'notes.txt');
    expect(res.status).toBe(201);
    const blocks = res.body.document.content.content;
    expect(blocks).toHaveLength(2);
    expect(blocks[0].content.map((n: { type: string }) => n.type)).toEqual(['text', 'hardBreak', 'text']);
  });

  it('converts a real .docx file, keeping headings, emphasis and lists', async () => {
    const docx = await readFile(new URL('./fixtures/sample.docx', import.meta.url));
    const res = await upload('/api/imports/documents', docx, 'Quarterly Review.docx');
    expect(res.status).toBe(201);
    const json = JSON.stringify(res.body.document.content);
    expect(res.body.document.title).toBe('Quarterly Review');
    expect(json).toContain('"type":"heading"');
    expect(json).toContain('"type":"bold"');
    expect(json).toContain('"type":"bulletList"');
  });

  it('converts without saving so a file can be inserted into an existing draft', async () => {
    const before = (await alice.get('/api/documents')).body.documents.length;
    const res = await upload('/api/imports/convert', '## Appendix', 'appendix.md');
    expect(res.status).toBe(200);
    expect(res.body.file.content.content[0]).toMatchObject({ type: 'heading', attrs: { level: 2 } });
    expect((await alice.get('/api/documents')).body.documents.length).toBe(before);
  });

  it('rejects unsupported, disguised, empty and oversized files with clear errors', async () => {
    const pdf = await upload('/api/imports/documents', '%PDF-1.7', 'report.pdf');
    expect(pdf.status).toBe(415);
    expect(pdf.body.error.message).toMatch(/\.docx, \.md or \.txt/);

    const fakeDocx = await upload('/api/imports/documents', 'plain text pretending', 'fake.docx');
    expect(fakeDocx.status).toBe(422);

    const empty = await upload('/api/imports/documents', '', 'empty.txt');
    expect(empty.status).toBe(422);

    const huge = await upload('/api/imports/documents', Buffer.alloc(2 * 1024 * 1024 + 1, 'a'), 'huge.txt');
    expect(huge.status).toBe(413);

    const binary = await upload('/api/imports/documents', Buffer.from([0xff, 0xfe, 0x00, 0xd8]), 'binary.txt');
    expect(binary.status).toBe(422);
  });

  it('falls back to a tidied file name when there is no top-level heading', async () => {
    const res = await upload('/api/imports/documents', 'just text', 'release_check-list.txt');
    expect(res.body.document.title).toBe('release check list');
  });

  it('keeps non-ASCII file names intact in the title', async () => {
    const res = await upload('/api/imports/documents', 'hello', 'Résumé – draft.txt');
    expect(res.body.document.title).toBe('Résumé – draft');
  });

  it('requires a file', async () => {
    const res = await alice.post('/api/imports/documents');
    expect(res.status).toBe(400);
  });
});
