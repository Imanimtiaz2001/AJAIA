import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FilePlus2, FileText, FileUp, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SUPPORTED_IMPORTS_HINT } from '../../shared/limits';
import type { DocumentScope, DocumentSummaryDTO } from '../../shared/types';
import { api, queryKeys } from '../api/client';
import { ApiError } from '../api/http';
import { useCurrentUser } from '../auth/AuthProvider';
import { AppHeader } from '../components/AppHeader';
import { FilePicker } from '../components/FilePicker';
import { useToast } from '../components/Toaster';
import { Avatar, Modal, RoleBadge, Spinner } from '../components/ui';
import { timeAgo } from '../lib/format';

const TABS: { scope: DocumentScope; label: string; empty: string }[] = [
  { scope: 'all', label: 'All documents', empty: 'No documents yet. Create one or import a file to get started.' },
  { scope: 'owned', label: 'Owned by me', empty: 'You have not created any documents yet.' },
  { scope: 'shared', label: 'Shared with me', empty: 'Nothing has been shared with you yet.' },
];

const errorMessage = (error: unknown) => (error instanceof ApiError ? error.message : 'Something went wrong.');

export function DocumentsPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const scope = (TABS.find((t) => t.scope === params.get('tab'))?.scope ?? 'all') as DocumentScope;
  const [pendingDelete, setPendingDelete] = useState<DocumentSummaryDTO | null>(null);

  const documents = useQuery({ queryKey: queryKeys.documents(scope), queryFn: () => api.documents.list(scope) });

  const create = useMutation({
    mutationFn: () => api.documents.create(),
    onSuccess: (doc) => navigate(`/d/${doc.id}`, { state: { focusTitle: true } }),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const importFile = useMutation({
    mutationFn: (file: File) => api.imports.createDocument(file),
    onSuccess: (doc) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.allDocumentLists });
      toast.success(`Imported “${doc.title}”`);
      navigate(`/d/${doc.id}`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (doc: DocumentSummaryDTO) => api.documents.remove(doc.id),
    onSuccess: (_void, doc) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.allDocumentLists });
      toast.success(`Deleted “${doc.title}”`);
      setPendingDelete(null);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const activeTab = TABS.find((t) => t.scope === scope)!;
  const busy = create.isPending || importFile.isPending;

  return (
    <div className="page">
      <AppHeader />
      <main className="documents">
        <div className="documents__top">
          <div>
            <h1>Documents</h1>
            <p className="muted">Hi {user.name.split(' ')[0]}, pick up where you left off.</p>
          </div>
          <div className="documents__actions">
            <div className="import-control">
              <FilePicker
                className="button"
                disabled={busy}
                onFile={(file) => importFile.mutate(file)}
                onInvalid={(message) => toast.error(message)}
                title={`Import ${SUPPORTED_IMPORTS_HINT}`}
              >
                {importFile.isPending ? <Spinner label="Importing" /> : <FileUp size={16} />}
                Import file
              </FilePicker>
              <span className="import-control__hint">{SUPPORTED_IMPORTS_HINT}</span>
            </div>
            <button className="button button--primary" disabled={busy} onClick={() => create.mutate()}>
              {create.isPending ? <Spinner label="Creating" /> : <FilePlus2 size={16} />}
              New document
            </button>
          </div>
        </div>

        <nav className="tabs" aria-label="Filter documents">
          {TABS.map((tab) => (
            <button
              key={tab.scope}
              className={`tabs__tab ${tab.scope === scope ? 'is-active' : ''}`}
              aria-current={tab.scope === scope ? 'page' : undefined}
              onClick={() => setParams(tab.scope === 'all' ? {} : { tab: tab.scope })}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {documents.isPending ? (
          <div className="documents__state">
            <Spinner />
          </div>
        ) : documents.isError ? (
          <div className="documents__state">
            <p className="form-error">{errorMessage(documents.error)}</p>
            <button className="button" onClick={() => void documents.refetch()}>
              Try again
            </button>
          </div>
        ) : documents.data.length === 0 ? (
          <div className="documents__state empty">
            <FileText size={32} />
            <p>{activeTab.empty}</p>
          </div>
        ) : (
          <ul className="doc-list">
            {documents.data.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                isMine={doc.owner.id === user.id}
                onOpen={() => navigate(`/d/${doc.id}`)}
                onDelete={() => setPendingDelete(doc)}
              />
            ))}
          </ul>
        )}
      </main>

      {pendingDelete && (
        <Modal
          title="Delete document?"
          onClose={() => setPendingDelete(null)}
          width={420}
          footer={
            <>
              <button className="button" onClick={() => setPendingDelete(null)}>
                Cancel
              </button>
              <button
                className="button button--danger"
                disabled={remove.isPending}
                onClick={() => remove.mutate(pendingDelete)}
              >
                {remove.isPending ? <Spinner label="Deleting" /> : 'Delete'}
              </button>
            </>
          }
        >
          <p>“{pendingDelete.title}” will be deleted for you and everyone it is shared with. This cannot be undone.</p>
        </Modal>
      )}
    </div>
  );
}

interface DocumentRowProps {
  doc: DocumentSummaryDTO;
  isMine: boolean;
  onOpen(): void;
  onDelete(): void;
}

function DocumentRow({ doc, isMine, onOpen, onDelete }: DocumentRowProps) {
  return (
    <li className="doc-row">
      <button className="doc-row__main" onClick={onOpen}>
        <span className={`doc-row__icon ${isMine ? '' : 'doc-row__icon--shared'}`}>
          {isMine ? <FileText size={18} /> : <Users size={18} />}
        </span>
        <span className="doc-row__text">
          <span className="doc-row__title">{doc.title}</span>
          <span className="doc-row__snippet">{doc.snippet || 'Empty document'}</span>
        </span>
      </button>
      <span className="doc-row__owner">
        {isMine ? (
          <span className="doc-row__mine">
            Owned by you
            {doc.collaboratorCount > 0 && <span className="muted"> · shared with {doc.collaboratorCount}</span>}
          </span>
        ) : (
          <>
            <Avatar name={doc.owner.name} size={22} />
            <span>Shared by {doc.owner.name}</span>
          </>
        )}
      </span>
      <span className="doc-row__role">
        <RoleBadge role={doc.role} />
      </span>
      <span className="doc-row__time" title={new Date(doc.updatedAt).toLocaleString()}>
        {timeAgo(doc.updatedAt)}
        {doc.updatedBy && <span className="muted"> by {doc.updatedBy}</span>}
      </span>
      <span className="doc-row__menu">
        {isMine && (
          <button
            className="icon-button icon-button--ghost"
            onClick={onDelete}
            aria-label={`Delete ${doc.title}`}
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        )}
      </span>
    </li>
  );
}
