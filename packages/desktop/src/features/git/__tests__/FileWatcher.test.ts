import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { resolveGitDir } from '../FileWatcher';

describe('resolveGitDir', () => {
  it('returns .git when it is a directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'snowtree-fw-'));
    const git = join(root, '.git');
    mkdirSync(git, { recursive: true });
    expect(resolveGitDir(root)).toBe(git);
  });

  it('resolves gitdir from .git file (linked worktree)', () => {
    const root = mkdtempSync(join(tmpdir(), 'snowtree-fw-'));
    const actual = join(root, 'actual-gitdir');
    mkdirSync(actual, { recursive: true });
    writeFileSync(join(root, '.git'), `gitdir: ${actual}\n`, 'utf8');
    expect(resolveGitDir(root)).toBe(actual);
  });
});

