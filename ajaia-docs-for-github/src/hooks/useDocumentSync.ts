import type { JSONContent } from '@tiptap/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DocumentDTO } from '../../shared/types';
import { api } from '../api/client';
import { ApiError } from '../api/http';

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'offline' | 'error' | 'conflict';

interface Changes {
  title?: string;
  content?: JSONContent;
}

const SAVE_DEBOUNCE_MS = 800;
const RETRY_DELAY_MS = 4000;
const hasChanges = (changes: Changes) => changes.title !== undefined || changes.content !== undefined;

interface Options {
  documentId: string;
  initialVersion: number;
  onSaved(doc: DocumentDTO): void;
}

/**
 * Debounced autosave with optimistic concurrency.
 *
 * - Changes are coalesced and sent at most one request at a time.
 * - Every save carries the version it was based on; if someone else saved
 *   first the API answers 409 and we surface a conflict instead of silently
 *   overwriting their work.
 * - Network/5xx failures keep the changes queued and retry automatically.
 */
export function useDocumentSync({ documentId, initialVersion, onSaved }: Options) {
  const version = useRef(initialVersion);
  const pending = useRef<Changes>({});
  const inFlight = useRef<Promise<void> | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const statusRef = useRef<SaveStatus>('saved');
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  const [status, setStatusState] = useState<SaveStatus>('saved');
  const [conflict, setConflict] = useState<DocumentDTO | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const setStatus = useCallback((next: SaveStatus) => {
    statusRef.current = next;
    setStatusState(next);
  }, []);

  const flush = useCallback(async (): Promise<void> => {
    window.clearTimeout(timer.current);
    if (inFlight.current) await inFlight.current;
    if (statusRef.current === 'conflict' || !hasChanges(pending.current)) return;

    const changes = pending.current;
    pending.current = {};
    setStatus('saving');

    const run = api.documents
      .update(documentId, { baseVersion: version.current, ...changes })
      .then((doc) => {
        version.current = doc.version;
        setErrorMessage(null);
        onSavedRef.current(doc);
        if (hasChanges(pending.current)) {
          setStatus('pending');
          timer.current = window.setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
        } else {
          setStatus('saved');
        }
      })
      .catch((error: unknown) => {
        // Put the unsent changes back, keeping anything typed since.
        pending.current = { ...changes, ...pending.current };
        if (error instanceof ApiError && error.code === 'VERSION_CONFLICT') {
          setConflict((error.details as { latest: DocumentDTO }).latest);
          setStatus('conflict');
        } else if (error instanceof ApiError && (error.isNetworkError || error.status >= 500)) {
          setStatus('offline');
          timer.current = window.setTimeout(() => void flush(), RETRY_DELAY_MS);
        } else {
          setErrorMessage(error instanceof ApiError ? error.message : 'Could not save changes.');
          setStatus('error');
        }
      })
      .finally(() => {
        inFlight.current = null;
      });

    inFlight.current = run;
    await run;
  }, [documentId, setStatus]);

  const queue = useCallback(
    (changes: Changes) => {
      pending.current = { ...pending.current, ...changes };
      if (statusRef.current === 'conflict') return;
      setStatus('pending');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
    },
    [flush, setStatus],
  );

  /** Discard local changes and adopt the version someone else saved. */
  const acceptTheirs = useCallback((): DocumentDTO | null => {
    const latest = conflict;
    if (!latest) return null;
    pending.current = {};
    version.current = latest.version;
    setConflict(null);
    setStatus('saved');
    return latest;
  }, [conflict, setStatus]);

  /** Save local changes over the latest version (an explicit, user-chosen overwrite). */
  const keepMine = useCallback(() => {
    if (!conflict) return;
    version.current = conflict.version;
    setConflict(null);
    setStatus('pending');
    void flush();
  }, [conflict, flush, setStatus]);

  /** A newer server version was loaded (polling) while there were no local edits. */
  const adoptRemoteVersion = useCallback((next: number) => {
    version.current = next;
  }, []);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (statusRef.current !== 'saved') event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      window.clearTimeout(timer.current);
      void flush(); // leaving the page: send whatever is still queued
    };
  }, [flush]);

  return {
    status,
    statusRef,
    conflict,
    errorMessage,
    queue,
    flush,
    acceptTheirs,
    keepMine,
    adoptRemoteVersion,
    currentVersion: () => version.current,
  };
}
