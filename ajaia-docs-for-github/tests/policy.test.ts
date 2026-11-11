import { describe, expect, it } from 'vitest';
import { extractPlainText } from '../shared/editor';
import { can, permissionsFor } from '../shared/permissions';

describe('access policy', () => {
  it.each([
    ['owner', { read: true, edit: true, share: true, delete: true }],
    ['editor', { read: true, edit: true, share: false, delete: false }],
    ['viewer', { read: true, edit: false, share: false, delete: false }],
  ] as const)('%s', (role, expected) => {
    for (const [action, allowed] of Object.entries(expected)) {
      expect(can(role, action as keyof typeof expected)).toBe(allowed);
    }
  });

  it('denies everything without a role', () => {
    expect(can(null, 'read')).toBe(false);
  });

  it('derives UI permissions from the same policy', () => {
    expect(permissionsFor('editor')).toEqual({ canEdit: true, canShare: false, canDelete: false });
  });
});

describe('plain-text preview', () => {
  it('separates blocks and line breaks with spaces and truncates', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', content: [{ type: 'text', text: 'Title' }] },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'a' }, { type: 'hardBreak' }, { type: 'text', text: 'b' }],
        },
      ],
    };
    expect(extractPlainText(doc)).toBe('Title a b');
    expect(extractPlainText(doc, 4)).toBe('Titl');
  });
});
