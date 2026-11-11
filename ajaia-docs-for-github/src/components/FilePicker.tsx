import { useRef, type ReactNode } from 'react';
import { LIMITS, SUPPORTED_IMPORTS_HINT, SUPPORTED_IMPORT_EXTENSIONS } from '../../shared/limits';

interface FilePickerProps {
  onFile(file: File): void;
  onInvalid(message: string): void;
  disabled?: boolean;
  className?: string;
  title?: string;
  children: ReactNode;
}

/** Checks type and size in the browser for instant feedback; the API enforces the same rules. */
export function validateImportFile(file: File): string | null {
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!SUPPORTED_IMPORT_EXTENSIONS.includes(extension))
    return `Unsupported file type. Upload ${SUPPORTED_IMPORTS_HINT}.`;
  if (file.size > LIMITS.uploadMaxBytes) return 'That file is larger than the 2 MB limit.';
  if (file.size === 0) return 'This file is empty.';
  return null;
}

export function FilePicker({ onFile, onInvalid, disabled, className = 'button', title, children }: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        className={className}
        disabled={disabled}
        title={title}
        onClick={() => inputRef.current?.click()}
      >
        {children}
      </button>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={SUPPORTED_IMPORT_EXTENSIONS.join(',')}
        data-testid="file-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          const problem = validateImportFile(file);
          if (problem) onInvalid(problem);
          else onFile(file);
        }}
      />
    </>
  );
}
