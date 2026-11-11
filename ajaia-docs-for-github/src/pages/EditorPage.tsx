import { useQuery } from '@tanstack/react-query';
import type { JSONContent } from '@tiptap/core';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import { AlertTriangle, ArrowLeft, Check, CloudOff, Eye, FileDown, Loader2, Share2, Users } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { createEditorExtensions } from '../../shared/editor';
import { LIMITS, SUPPORTED_IMPORTS_HINT } from '../../shared/limits';
import type { DocumentDTO } from '../../shared/types';
import { api } from '../api/client';
import { ApiError } from '../api/http';
import { AppHeader } from '../components/AppHeader';
import { FilePicker } from '../components/FilePicker';
import { LinkDialog } from '../components/editor/LinkDialog';
import { Toolbar } from '../components/editor/Toolbar';
import { ShareDialog } from '../components/ShareDialog';
import { useToast } from '../components/Toaster';
import { Avatar, RoleBadge, Spinner } from '../components/ui';
import { useDocumentSync, type SaveStatus } from '../hooks/useDocumentSync';
import { timeAgo } from '../lib/format';
import { NotFoundPage } from './NotFoundPage';

/** How often an open document checks for collaborators' changes. */
const POLL_INTERVAL_MS = 4000;

export function EditorPage() {
  const { id = '' } = useParams();
  const query = useQuery({
    queryKey: ['document', id],
    queryFn: ({ signal }) => api.documents.get(id, signal),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  if (query.isPending) {
    return (
      <div className="page">
        <AppHeader />
        <div className="documents__state">
          <Spinner />
        </div>
      </div>
    );
  }
  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <NotFoundPage
        message={notFound ? 'This document does not exist, or it has not been shared with you.' : query.error.message}
      />
    );
  }
  return <DocumentWorkspace key={id} initial={query.data} />;
}

/** Replace the editor's content with a newer server version while keeping the caret roughly in place. */
function replaceContent(editor: Editor, content: JSONContent) {
  const { from, to } = editor.state.selection;
  editor.commands.setContent(content, { emitUpdate: false });
  const max = editor.state.doc.content.size;
  editor.commands.setTextSelection({ from: Math.min(from, max), to: Math.min(to, max) });
}

function DocumentWorkspace({ initial }: { initial: DocumentDTO }) {
  const toast = useToast();
  const location = useLocation();
  const [meta, setMeta] = useState<DocumentDTO>(initial);
  const [title, setTitle] = useState(initial.title);
  const [dialog, setDialog] = useState<'share' | 'link' | null>(null);
  const [revoked, setRevoked] = useState(false);
  const [remoteNotice, setRemoteNotice] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const canEdit = meta.permissions.canEdit && !revoked;

  const sync = useDocumentSync({
    documentId: initial.id,
    initialVersion: initial.version,
    onSaved: (doc) => setMeta(doc),
  });
  const queueRef = useRef(sync.queue);
  queueRef.current = sync.queue;

  const editor = useEditor({
    extensions: [
      ...createEditorExtensions(),
      Placeholder.configure({ placeholder: 'Start writing, or import a file from the toolbar…' }),
      CharacterCount,
    ],
    content: initial.content,
    editable: initial.permissions.canEdit,
    editorProps: { attributes: { class: 'prose', 'aria-label': 'Document body', spellcheck: 'true' } },
    onUpdate: ({ editor: e }) => queueRef.current({ content: e.getJSON() }),
  });

  useEffect(() => {
    editor.setEditable(canEdit);
  }, [editor, canEdit]);

  // Brand-new documents open with the title selected, ready to rename.
  useEffect(() => {
    if ((location.state as { focusTitle?: boolean } | null)?.focusTitle) titleRef.current?.select();
  }, [location.state]);

  // Ctrl/Cmd+S saves immediately instead of opening the browser's save dialog.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void sync.flush();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sync]);

  // Lightweight collaboration: pick up other people's saves while we have nothing unsaved.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (document.hidden || sync.statusRef.current !== 'saved') return;
      try {
        const latest = await api.documents.get(initial.id);
        if (cancelled) return;
        setMeta((current) => ({ ...latest, content: current.content }));
        if (latest.version > sync.currentVersion() && sync.statusRef.current === 'saved') {
          sync.adoptRemoteVersion(latest.version);
          replaceContent(editor, latest.content);
          if (document.activeElement !== titleRef.current) setTitle(latest.title);
          setRemoteNotice(`Updated by ${latest.updatedBy ?? 'a collaborator'}`);
          window.setTimeout(() => !cancelled && setRemoteNotice(null), 5000);
        }
      } catch (error) {
        if (!cancelled && error instanceof ApiError && error.status === 404) setRevoked(true);
      }
    };
    const timer = window.setInterval(() => void tick(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, initial.id]);

  const loadTheirs = () => {
    const latest = sync.acceptTheirs();
    if (!latest) return;
    replaceContent(editor, latest.content);
    setTitle(latest.title);
    setMeta(latest);
  };

  const insertFile = useCallback(
    async (file: File) => {
      setImporting(true);
      try {
        const converted = await api.imports.convert(file);
        editor
          .chain()
          .focus()
          .insertContent(converted.content.content ?? [])
          .run();
        toast.success(`Inserted “${file.name}”`);
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : 'Could not import that file.');
      } finally {
        setImporting(false);
      }
    },
    [editor, toast],
  );

  // Subscribes to editor transactions so the count stays live while typing.
  const words = useEditorState({ editor, selector: ({ editor: e }) => e.storage.characterCount?.words?.() ?? 0 });

  return (
    <div className="page page--editor">
      <AppHeader>
        <div className="doc-header">
          <Link to="/" className="icon-button" aria-label="Back to documents" title="Back to documents">
            <ArrowLeft size={18} />
          </Link>
          <input
            ref={titleRef}
            className="doc-header__title"
            value={title}
            maxLength={LIMITS.titleMaxLength}
            readOnly={!canEdit}
            aria-label="Document title"
            placeholder="Untitled document"
            onChange={(event) => {
              setTitle(event.target.value);
              sync.queue({ title: event.target.value });
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                editor.commands.focus('start');
              }
            }}
          />
          <SaveIndicator status={canEdit ? sync.status : 'readonly'} error={sync.errorMessage} notice={remoteNotice} />
        </div>
      </AppHeader>

      <div className="editor-sticky">
        <div className="editor-bar">
          <div className="editor-bar__meta">
            {meta.role === 'owner' ? (
              <span className="muted">You own this document</span>
            ) : (
              <span className="owner-chip">
                <Avatar name={meta.owner.name} size={22} /> Owned by {meta.owner.name}
              </span>
            )}
            <RoleBadge role={meta.role} />
          </div>
          <button className="button button--primary" onClick={() => setDialog('share')} disabled={revoked}>
            {meta.permissions.canShare ? <Share2 size={16} /> : <Users size={16} />}
            {meta.permissions.canShare ? 'Share' : 'People'}
          </button>
        </div>

        {canEdit && (
          <Toolbar
            editor={editor}
            onLink={() => setDialog('link')}
            importSlot={
              <FilePicker
                className="button button--small"
                disabled={importing}
                title={`Insert ${SUPPORTED_IMPORTS_HINT} at the cursor`}
                onFile={(file) => void insertFile(file)}
                onInvalid={(message) => toast.error(message)}
              >
                {importing ? <Spinner label="Importing" /> : <FileDown size={15} />}
                Insert file
              </FilePicker>
            }
          />
        )}

        {sync.conflict && (
          <div className="banner banner--warning" role="alert">
            <AlertTriangle size={18} />
            <span>
              <strong>{sync.conflict.updatedBy ?? 'Someone'}</strong> saved a newer version while you were editing. Your
              latest changes are not saved yet.
            </span>
            <button className="button button--small" onClick={loadTheirs}>
              Load their version
            </button>
            <button className="button button--small button--primary" onClick={sync.keepMine}>
              Keep my changes
            </button>
          </div>
        )}
        {revoked && (
          <div className="banner banner--danger" role="alert">
            <AlertTriangle size={18} />
            <span>Your access to this document was removed. </span>
            <Link to="/" className="button button--small">
              Back to documents
            </Link>
          </div>
        )}
        {!meta.permissions.canEdit && !revoked && (
          <div className="banner banner--info">
            <Eye size={18} />
            <span>
              You have view-only access. Ask {meta.owner.name} for edit access. Changes others make appear here
              automatically.
            </span>
          </div>
        )}
      </div>

      <main className="canvas" onClick={(e) => e.target === e.currentTarget && editor.commands.focus('end')}>
        <article className={`paper ${canEdit ? '' : 'paper--readonly'}`}>
          <EditorContent editor={editor} />
        </article>
      </main>

      <footer className="status-bar">
        <span>
          {words} {words === 1 ? 'word' : 'words'}
        </span>
        <span title={new Date(meta.updatedAt).toLocaleString()}>
          Last edited {timeAgo(meta.updatedAt)}
          {meta.updatedBy ? ` by ${meta.updatedBy}` : ''}
        </span>
      </footer>

      {dialog === 'share' && <ShareDialog doc={meta} onClose={() => setDialog(null)} />}
      {dialog === 'link' && <LinkDialog editor={editor} onClose={() => setDialog(null)} />}
    </div>
  );
}

function SaveIndicator({
  status,
  error,
  notice,
}: {
  status: SaveStatus | 'readonly';
  error: string | null;
  notice: string | null;
}) {
  if (notice && (status === 'saved' || status === 'readonly')) {
    return (
      <span className="save-state save-state--remote">
        <Users size={14} /> {notice}
      </span>
    );
  }
  const view: Record<SaveStatus | 'readonly', { icon: ReactNode; text: string; tone: string }> = {
    saved: { icon: <Check size={14} />, text: 'All changes saved', tone: 'ok' },
    pending: { icon: <span className="dot" />, text: 'Unsaved changes', tone: 'muted' },
    saving: { icon: <Loader2 size={14} className="spin" />, text: 'Saving…', tone: 'muted' },
    offline: { icon: <CloudOff size={14} />, text: 'Offline, retrying…', tone: 'warn' },
    error: { icon: <AlertTriangle size={14} />, text: error ?? 'Could not save', tone: 'danger' },
    conflict: { icon: <AlertTriangle size={14} />, text: 'Not saved: newer version exists', tone: 'warn' },
    readonly: { icon: <Eye size={14} />, text: 'View only', tone: 'muted' },
  };
  const { icon, text, tone } = view[status];
  return (
    <span className={`save-state save-state--${tone}`} aria-live="polite" data-testid="save-state">
      {icon} {text}
    </span>
  );
}
