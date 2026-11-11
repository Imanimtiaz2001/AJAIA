import type { Editor } from '@tiptap/react';
import { useState, type FormEvent } from 'react';
import { isSafeHref } from '../../../shared/editor';
import { Modal } from '../ui';

const normalise = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

export function LinkDialog({ editor, onClose }: { editor: Editor; onClose(): void }) {
  const existing = (editor.getAttributes('link').href as string | undefined) ?? '';
  const [url, setUrl] = useState(existing);
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const href = normalise(url);
    const chain = editor.chain().focus().extendMarkRange('link');
    if (!href) {
      chain.unsetLink().run();
      onClose();
      return;
    }
    if (!isSafeHref(href)) {
      setError('Use an http, https or mailto link.');
      return;
    }
    if (editor.state.selection.empty && !editor.isActive('link')) {
      chain.insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run();
    } else {
      chain.setLink({ href }).run();
    }
    onClose();
  };

  return (
    <Modal title={existing ? 'Edit link' : 'Insert link'} onClose={onClose} width={440}>
      <form onSubmit={submit} className="stack">
        <label className="field">
          <span>URL</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="row row--end">
          {existing && (
            <button
              type="button"
              className="button"
              onClick={() => {
                editor.chain().focus().extendMarkRange('link').unsetLink().run();
                onClose();
              }}
            >
              Remove link
            </button>
          )}
          <button type="submit" className="button button--primary">
            Apply
          </button>
        </div>
      </form>
    </Modal>
  );
}
