import { useEditorState, type Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { HEADING_LEVELS, type HeadingLevel } from '../../../shared/editor';

interface ToolbarProps {
  editor: Editor;
  onLink(): void;
  importSlot: ReactNode;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl+';

type Mark = 'bold' | 'italic' | 'underline' | 'strike';
const MARKS: { mark: Mark; icon: LucideIcon; label: string; shortcut: string }[] = [
  { mark: 'bold', icon: Bold, label: 'Bold', shortcut: `${mod}B` },
  { mark: 'italic', icon: Italic, label: 'Italic', shortcut: `${mod}I` },
  { mark: 'underline', icon: Underline, label: 'Underline', shortcut: `${mod}U` },
  { mark: 'strike', icon: Strikethrough, label: 'Strikethrough', shortcut: `${mod}Shift+S` },
];

const BLOCK_OPTIONS = [
  { value: 'paragraph', label: 'Normal text' },
  ...HEADING_LEVELS.map((level) => ({ value: `h${level}`, label: `Heading ${level}` })),
];

export function Toolbar({ editor, onLink, importSlot }: ToolbarProps) {
  // Re-render only when the formatting at the cursor changes, not on every keystroke.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      blockquote: e.isActive('blockquote'),
      link: e.isActive('link'),
      block: HEADING_LEVELS.find((level) => e.isActive('heading', { level })) ?? null,
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const chain = () => editor.chain().focus();
  const setBlock = (value: string) => {
    if (value === 'paragraph') chain().setParagraph().run();
    else
      chain()
        .setHeading({ level: Number(value.slice(1)) as HeadingLevel })
        .run();
  };

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      <ToolButton
        icon={Undo2}
        label={`Undo (${mod}Z)`}
        disabled={!state.canUndo}
        onClick={() => chain().undo().run()}
      />
      <ToolButton
        icon={Redo2}
        label={`Redo (${mod}Shift+Z)`}
        disabled={!state.canRedo}
        onClick={() => chain().redo().run()}
      />
      <Divider />
      <select
        className="toolbar__select"
        aria-label="Text style"
        value={state.block ? `h${state.block}` : 'paragraph'}
        onChange={(event) => setBlock(event.target.value)}
      >
        {BLOCK_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Divider />
      {MARKS.map(({ mark, icon, label, shortcut }) => (
        <ToolButton
          key={mark}
          icon={icon}
          label={`${label} (${shortcut})`}
          active={state[mark]}
          onClick={() => chain().toggleMark(mark).run()}
        />
      ))}
      <Divider />
      <ToolButton
        icon={List}
        label="Bulleted list"
        active={state.bulletList}
        onClick={() => chain().toggleBulletList().run()}
      />
      <ToolButton
        icon={ListOrdered}
        label="Numbered list"
        active={state.orderedList}
        onClick={() => chain().toggleOrderedList().run()}
      />
      <ToolButton
        icon={Quote}
        label="Quote"
        active={state.blockquote}
        onClick={() => chain().toggleBlockquote().run()}
      />
      <ToolButton icon={Link2} label="Link" active={state.link} onClick={onLink} />
      <Divider />
      <ToolButton
        icon={RemoveFormatting}
        label="Clear formatting"
        onClick={() => chain().unsetAllMarks().clearNodes().run()}
      />
      <span className="toolbar__spacer" />
      {importSlot}
    </div>
  );
}

interface ToolButtonProps {
  icon: LucideIcon;
  label: string;
  onClick(): void;
  active?: boolean;
  disabled?: boolean;
}

function ToolButton({ icon: Icon, label, onClick, active = false, disabled = false }: ToolButtonProps) {
  return (
    <button
      type="button"
      className={`tool ${active ? 'is-active' : ''}`}
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      // Keep the editor selection when clicking toolbar buttons.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <Icon size={17} strokeWidth={2.2} />
    </button>
  );
}

function Divider() {
  return <span className="toolbar__divider" aria-hidden="true" />;
}
