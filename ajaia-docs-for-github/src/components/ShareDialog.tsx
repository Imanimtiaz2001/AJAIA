import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserMinus } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { ROLE_LABELS, SHARE_ROLES, type ShareRole } from '../../shared/permissions';
import type { DocumentDTO, ShareDTO } from '../../shared/types';
import { api, queryKeys } from '../api/client';
import { ApiError } from '../api/http';
import { useToast } from './Toaster';
import { Avatar, Modal, RoleBadge, Spinner } from './ui';

interface ShareDialogProps {
  doc: DocumentDTO;
  onClose(): void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ShareDialog({ doc, onClose }: ShareDialogProps) {
  const canManage = doc.permissions.canShare;
  const toast = useToast();
  const queryClient = useQueryClient();
  const listId = useId();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ShareRole>('editor');
  const [formError, setFormError] = useState<string | null>(null);

  const shares = useQuery({ queryKey: queryKeys.shares(doc.id), queryFn: () => api.shares.list(doc.id) });
  const directory = useQuery({ queryKey: queryKeys.users, queryFn: api.users.list, enabled: canManage });

  const applyShares = (next: ShareDTO[]) => {
    queryClient.setQueryData(queryKeys.shares(doc.id), next);
    void queryClient.invalidateQueries({ queryKey: queryKeys.allDocumentLists });
  };

  const grant = useMutation({
    mutationFn: (input: { email: string; role: ShareRole }) => api.shares.grant(doc.id, input.email, input.role),
    onSuccess: (next, input) => {
      applyShares(next);
      setEmail('');
      setFormError(null);
      toast.success(`Shared with ${input.email} (${ROLE_LABELS[input.role].toLowerCase()})`);
    },
    onError: (error) => setFormError(error instanceof ApiError ? error.message : 'Could not share the document.'),
  });

  const revoke = useMutation({
    mutationFn: (share: ShareDTO) => api.shares.revoke(doc.id, share.user.id),
    onSuccess: (next, share) => {
      applyShares(next);
      toast.success(`Removed ${share.user.name}`);
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not remove access.'),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = email.trim();
    if (!EMAIL_PATTERN.test(value)) {
      setFormError('Enter a valid email address.');
      return;
    }
    grant.mutate({ email: value, role });
  };

  const existing = new Set(shares.data?.map((s) => s.user.id));
  const suggestions = directory.data?.filter((u) => !existing.has(u.id) && u.id !== doc.owner.id) ?? [];

  return (
    <Modal title={`Share “${doc.title}”`} onClose={onClose}>
      {canManage ? (
        <form className="share-form" onSubmit={submit} noValidate>
          <input
            type="email"
            list={listId}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Add people by email"
            aria-label="Email address"
            autoComplete="off"
          />
          <datalist id={listId}>
            {suggestions.map((u) => (
              <option key={u.id} value={u.email}>
                {u.name}
              </option>
            ))}
          </datalist>
          <select value={role} onChange={(e) => setRole(e.target.value as ShareRole)} aria-label="Access level">
            {SHARE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <button className="button button--primary" type="submit" disabled={grant.isPending}>
            {grant.isPending ? <Spinner label="Sharing" /> : 'Share'}
          </button>
        </form>
      ) : (
        <p className="muted share-note">Only {doc.owner.name} can change who has access.</p>
      )}
      {formError && (
        <p className="form-error" role="alert">
          {formError}
        </p>
      )}
      {canManage && suggestions.length > 0 && (
        <p className="share-hint muted">Teammates: {suggestions.map((u) => u.email).join(', ')}</p>
      )}

      <h3 className="share-heading">People with access</h3>
      <ul className="people">
        <li className="person">
          <Avatar name={doc.owner.name} />
          <span className="person__text">
            <strong>{doc.owner.name}</strong>
            <span>{doc.owner.email}</span>
          </span>
          <RoleBadge role="owner" />
        </li>
        {shares.isPending && (
          <li className="person">
            <Spinner />
          </li>
        )}
        {shares.data?.map((share) => (
          <li className="person" key={share.user.id}>
            <Avatar name={share.user.name} />
            <span className="person__text">
              <strong>{share.user.name}</strong>
              <span>{share.user.email}</span>
            </span>
            {canManage ? (
              <>
                <select
                  value={share.role}
                  aria-label={`Access for ${share.user.name}`}
                  onChange={(e) => grant.mutate({ email: share.user.email, role: e.target.value as ShareRole })}
                >
                  {SHARE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
                <button
                  className="icon-button icon-button--ghost"
                  onClick={() => revoke.mutate(share)}
                  disabled={revoke.isPending}
                  aria-label={`Remove ${share.user.name}`}
                  title="Remove access"
                >
                  <UserMinus size={16} />
                </button>
              </>
            ) : (
              <RoleBadge role={share.role} />
            )}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
