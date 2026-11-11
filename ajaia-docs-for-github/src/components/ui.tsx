import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ROLE_LABELS, type Role } from '../../shared/permissions';
import { avatarHue, initials } from '../lib/format';

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="logo" aria-label="Ajaia Docs">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <rect x="4" y="2" width="22" height="28" rx="4" fill="var(--accent)" />
        <path d="M19 2v6a3 3 0 0 0 3 3h4" fill="none" stroke="var(--accent-ink)" strokeWidth="2" />
        <path d="M9 15h12M9 19.5h12M9 24h7" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="logo__word">
        Ajaia <strong>Docs</strong>
      </span>
    </span>
  );
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span
      className="avatar"
      title={name}
      style={{ width: size, height: size, fontSize: size * 0.4, ['--hue' as string]: avatarHue(name) }}
    >
      {initials(name)}
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  return <span className={`badge badge--${role}`}>{ROLE_LABELS[role]}</span>;
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <span className="spinner" role="progressbar" aria-label={label} />;
}

interface ModalProps {
  title: string;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

/** Accessible dialog: focus moves in on open, Escape and backdrop click close it. */
export function Modal({ title, onClose, children, footer, width = 520 }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const firstField = panelRef.current?.querySelector<HTMLElement>(
      'input, select, textarea, button:not(.modal__close)',
    );
    (firstField ?? panelRef.current)?.focus();
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
        tabIndex={-1}
        style={{ maxWidth: width }}
      >
        <header className="modal__header">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-button icon-button--ghost modal__close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__footer">{footer}</footer>}
      </div>
    </div>
  );
}
