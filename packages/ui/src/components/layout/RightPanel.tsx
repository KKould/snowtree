import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { RefreshCw, ChevronDown, GitCommit, Copy, GitPullRequest } from 'lucide-react';
import { API } from '../../utils/api';
import { withTimeout } from '../../utils/withTimeout';
import type { FileChange, RightPanelProps } from './types';
import type { DiffTarget } from '../../types/diff';

// One Dark colors
const colors = {
  bg: {
    primary: 'var(--st-bg)',
    secondary: 'var(--st-surface)',
    hover: 'var(--st-hover)',
    selected: 'var(--st-selected)',
  },
  text: {
    primary: 'var(--st-text)',
    secondary: 'var(--st-text-muted)',
    muted: 'var(--st-text-faint)',
    added: 'var(--st-success)',
    deleted: 'var(--st-danger)',
    modified: 'var(--st-warning)',
    renamed: 'var(--st-accent)',
  },
  accent: 'var(--st-accent)',
  border: 'var(--st-border-variant)',
};

const stack = {
  line: 'color-mix(in srgb, var(--st-text-faint) 55%, transparent)',
  arrow: 'color-mix(in srgb, var(--st-text-faint) 82%, transparent)',
};

const StackConnector: React.FC<{ accent?: boolean }> = React.memo(({ accent }) => {
  const line = accent ? 'color-mix(in srgb, var(--st-accent) 55%, transparent)' : stack.line;
  const arrow = accent ? 'color-mix(in srgb, var(--st-accent) 82%, transparent)' : stack.arrow;
  const gradId = useMemo(() => `st-stack-grad-${Math.random().toString(16).slice(2)}`, []);

  return (
    <div className="relative flex-1 w-4 st-stack-connector">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 16 28" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={line} stopOpacity="0" />
            <stop offset="0.2" stopColor={line} stopOpacity="0.9" />
            <stop offset="0.8" stopColor={line} stopOpacity="0.9" />
            <stop offset="1" stopColor={line} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M8 0V28"
          stroke={`url(#${gradId})`}
          strokeWidth="1"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M6.25 13.75 L8 15.5 L9.75 13.75"
          fill="none"
          stroke={arrow}
          strokeWidth="1.15"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
});

StackConnector.displayName = 'StackConnector';

interface Commit {
  id: number;
  commit_message: string;
  timestamp: string;
  stats_additions: number;
  stats_deletions: number;
  stats_files_changed: number;
  after_commit_hash: string;
  parent_commit_hash?: string | null;
  author?: string;
}

interface FileItemProps {
  file: FileChange;
  onClick: () => void;
  isSelected: boolean;
}

const FileItem: React.FC<FileItemProps> = React.memo(({ file, onClick, isSelected }) => {
  const [isHovered, setIsHovered] = useState(false);

  const getTypeInfo = (type: FileChange['type']) => {
    switch (type) {
      case 'added': return { label: 'A', color: colors.text.added, bg: 'rgba(180, 250, 114, 0.15)' };
      case 'deleted': return { label: 'D', color: colors.text.deleted, bg: 'rgba(255, 130, 114, 0.15)' };
      case 'renamed': return { label: 'R', color: colors.text.renamed, bg: 'rgba(0, 194, 255, 0.15)' };
      default: return { label: 'M', color: colors.text.modified, bg: 'rgba(254, 253, 194, 0.15)' };
    }
  };

  const typeInfo = getTypeInfo(file.type);

  const getBgColor = () => {
    if (isSelected) return colors.bg.selected;
    if (isHovered) return colors.bg.hover;
    return 'transparent';
  };

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors duration-75"
      style={{
        backgroundColor: getBgColor(),
        borderLeft: isSelected ? `2px solid ${colors.accent}` : '2px solid transparent',
      }}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span
          className="font-mono text-[10px] font-semibold px-1 rounded"
          style={{ color: typeInfo.color, backgroundColor: typeInfo.bg }}
        >
          {typeInfo.label}
        </span>
        <span
          className="truncate"
          style={{ color: isSelected || isHovered ? colors.text.primary : colors.text.secondary }}
        >
          {file.path}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] flex-shrink-0 ml-2 font-mono">
        {file.additions > 0 && (
          <span style={{ color: colors.text.added }}>+{file.additions}</span>
        )}
        {file.deletions > 0 && (
          <span style={{ color: colors.text.deleted }}>-{file.deletions}</span>
        )}
      </div>
    </button>
  );
});

FileItem.displayName = 'FileItem';

interface CommitItemProps {
  commit: Commit;
  isSelected: boolean;
  badge?: string;
  onClick: () => void;
  onCommitUncommittedChanges?: () => void;
  isCommitDisabled?: boolean;
}

const CommitItem: React.FC<CommitItemProps> = React.memo(({
  commit,
  isSelected,
  badge,
  onClick,
  onCommitUncommittedChanges,
  isCommitDisabled
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const isUncommitted = commit.id === 0;
  const shortHash = isUncommitted ? '' : commit.after_commit_hash.substring(0, 7);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    if (sameDay) {
      return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date);
    }
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  };

  const handleCopyHash = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!commit.after_commit_hash) return;

    try {
      await navigator.clipboard.writeText(commit.after_commit_hash);
    } catch (err) {
      console.error('Failed to copy hash:', err);
    }
  }, [commit.after_commit_hash]);

  const handleCommitClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onCommitUncommittedChanges?.();
  }, [onCommitUncommittedChanges]);

  const getBgColor = () => {
    if (isSelected) return colors.bg.selected;
    if (isHovered) return colors.bg.hover;
    return 'transparent';
  };

  return (
    <div
      className="w-full flex items-stretch gap-2 px-3 py-2 text-xs text-left transition-colors duration-75 select-none"
      style={{
        backgroundColor: getBgColor(),
        borderLeft: isSelected ? `2px solid ${colors.accent}` : '2px solid transparent',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex-1 min-w-0 flex items-start gap-2 outline-none focus:ring-1 focus:ring-blue-500/40 rounded"
        aria-label={`Select commit ${isUncommitted ? 'uncommitted changes' : shortHash}`}
      >
        <div
          className="mt-0.5"
          style={{ color: isUncommitted ? colors.text.modified : colors.text.muted }}
        >
          <GitCommit className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span
              className="flex-1 min-w-0 truncate font-medium"
              style={{ color: isUncommitted ? colors.text.modified : (isSelected || isHovered ? colors.text.primary : colors.text.secondary) }}
            >
              {isUncommitted ? 'Working Tree' : commit.commit_message}
            </span>
            {badge && (
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded lowercase"
                style={{ backgroundColor: colors.bg.hover, color: colors.text.muted }}
                title={badge}
              >
                {badge.toLowerCase()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-[10px]" style={{ color: colors.text.muted }}>
            {shortHash && (
              <span className="font-mono">{shortHash}</span>
            )}
            <span className="font-mono">{formatTime(commit.timestamp)}</span>
            <span style={{ color: colors.text.added }}>+{commit.stats_additions}</span>
            <span style={{ color: colors.text.deleted }}>-{commit.stats_deletions}</span>
          </div>
        </div>
      </button>

      {shortHash && (
        <button
          type="button"
          onClick={handleCopyHash}
          className="flex-shrink-0 self-start p-1.5 rounded transition-all duration-75 st-hoverable st-focus-ring"
          title="Copy commit hash"
        >
          <Copy className="w-3.5 h-3.5" style={{ color: colors.text.muted }} />
        </button>
      )}

      {isUncommitted && onCommitUncommittedChanges && (
        <button
          type="button"
          onClick={handleCommitClick}
          disabled={isCommitDisabled}
          className="flex-shrink-0 self-start flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-all duration-75 st-hoverable st-focus-ring disabled:opacity-40"
          style={{ color: colors.accent }}
          title="Ask the session CLI to create a git commit"
        >
          <GitCommit className="w-3 h-3" />
          Commit
        </button>
      )}
    </div>
  );
});

CommitItem.displayName = 'CommitItem';

type WorkingTreeScope = 'all' | 'staged' | 'unstaged' | 'untracked';

const WorkingGroupHeader: React.FC<{
  label: string;
  count: number;
  additions: number;
  deletions: number;
  expanded: boolean;
  onToggle: () => void;
}> = ({ label, count, additions, deletions, expanded, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    className="w-full flex items-center justify-between px-3 py-2 text-xs transition-all duration-75 st-hoverable st-focus-ring"
    style={{ color: colors.text.secondary, borderBottom: `1px solid ${colors.border}` }}
  >
    <div className="flex items-center gap-2 min-w-0">
      <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? '' : '-rotate-90'}`} style={{ color: colors.text.muted }} />
      <span className="font-medium">{label}</span>
      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: colors.bg.hover, color: colors.text.muted }}>
        {count}
      </span>
    </div>
    <div className="flex items-center gap-2 text-[10px] font-mono">
      <span style={{ color: colors.text.added }}>+{additions}</span>
      <span style={{ color: colors.text.deleted }}>-{deletions}</span>
    </div>
  </button>
);

export const RightPanel: React.FC<RightPanelProps> = React.memo(({
  session,
  onFileClick,
  onCommitUncommittedChanges,
  isCommitDisabled,
  onCommitClick,
  onPushPR,
  isPushPRDisabled
}) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFileScope, setSelectedFileScope] = useState<WorkingTreeScope | 'commit' | null>(null);
  const [isCommitsExpanded, setIsCommitsExpanded] = useState(true);
  const [isChangesExpanded, setIsChangesExpanded] = useState(true);

  const [commits, setCommits] = useState<Commit[]>([]);
  const [selectedCommitHash, setSelectedCommitHash] = useState<string | null>(null);
  const [selectedIsUncommitted, setSelectedIsUncommitted] = useState(false);
  const [files, setFiles] = useState<FileChange[]>([]);
  const [workingTree, setWorkingTree] = useState<{ staged: FileChange[]; unstaged: FileChange[]; untracked: FileChange[] } | null>(null);
  const [workingExpanded, setWorkingExpanded] = useState<{ staged: boolean; unstaged: boolean; untracked: boolean }>({
    staged: true,
    unstaged: true,
    untracked: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshingHistory, setIsRefreshingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const requestIdRef = useRef(0);
  const historyRequestIdRef = useRef(0);
  const refreshTimerRef = useRef<number | null>(null);
  const selectedCommitHashRef = useRef<string | null>(null);
  const selectedIsUncommittedRef = useRef(false);

  useEffect(() => {
    selectedCommitHashRef.current = selectedCommitHash;
    selectedIsUncommittedRef.current = selectedIsUncommitted;
  }, [selectedCommitHash, selectedIsUncommitted]);

  const selectedTarget = useMemo<DiffTarget | null>(() => {
    if (selectedIsUncommitted) return { kind: 'working', scope: 'all' };
    if (!selectedCommitHash) return null;
    return { kind: 'commit', hash: selectedCommitHash };
  }, [selectedIsUncommitted, selectedCommitHash]);

  // Fetch commits for the session
  const fetchCommits = useCallback(async (selectFirst = false) => {
    if (!session.id) return;
    const requestId = ++historyRequestIdRef.current;
    setIsRefreshingHistory(true);

    try {
      const response = await API.sessions.getExecutions(session.id);
      if (requestId !== historyRequestIdRef.current) return;

      if (response.success && response.data) {
        setError(null);
        const next = response.data as Commit[];
        setCommits(next);

        const hasUncommitted = next.some((c) => c.id === 0);
        const firstSessionCommit = next.find((c) => c.id > 0) || null;
        const baseCommit = next.find((c) => c.id === -1) || null;
        if (selectFirst) {
          if (hasUncommitted) {
            setSelectedIsUncommitted(true);
            setSelectedCommitHash(null);
          } else {
            setSelectedIsUncommitted(false);
            setSelectedCommitHash((firstSessionCommit || baseCommit)?.after_commit_hash || null);
          }
          return;
        }

        // Keep selection stable across refreshes (selection is by hash, not list index).
        if (selectedIsUncommittedRef.current) {
          if (!hasUncommitted) {
            setSelectedIsUncommitted(false);
            setSelectedCommitHash((firstSessionCommit || baseCommit)?.after_commit_hash || null);
          }
          return;
        }

        const currentHash = selectedCommitHashRef.current;
        if (currentHash) {
          const stillThere = next.some((c) => c.id !== 0 && c.after_commit_hash === currentHash);
          if (!stillThere) {
            if (hasUncommitted) {
              setSelectedIsUncommitted(true);
              setSelectedCommitHash(null);
            } else {
              setSelectedCommitHash((firstSessionCommit || baseCommit)?.after_commit_hash || null);
            }
          }
        } else if (hasUncommitted) {
          // If we had nothing selected yet, prefer working tree.
          setSelectedIsUncommitted(true);
        } else {
          setSelectedCommitHash((firstSessionCommit || baseCommit)?.after_commit_hash || null);
        }
        return;
      }

      // Failed to load history: surface error and avoid leaking previous session's data.
      const message = response.error || 'Failed to load history';
      setError(message);
      if (selectFirst) {
        setCommits([]);
        setSelectedCommitHash(null);
        setSelectedIsUncommitted(false);
      }
    } catch (err) {
      if (requestId !== historyRequestIdRef.current) return;
      const message = err instanceof Error ? err.message : 'Failed to load history';
      setError(message);
      if (selectFirst) {
        setCommits([]);
        setSelectedCommitHash(null);
        setSelectedIsUncommitted(false);
      }
    } finally {
      if (requestId === historyRequestIdRef.current) {
        setIsRefreshingHistory(false);
      }
    }
  }, [session.id]);

  // Fetch files for the selected commit
  const fetchFiles = useCallback(async () => {
    if (loadingRef.current || !session.id || !selectedTarget) return;

    const requestId = ++requestIdRef.current;
    loadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      if (selectedTarget.kind === 'working') {
        const response = await withTimeout(
          API.sessions.getDiff(session.id, { kind: 'working', scope: 'all' }),
          15_000,
          'Load working tree'
        );
        if (requestId !== requestIdRef.current) return;
        if (response.success && response.data) {
          const wt = (response.data as { workingTree?: unknown }).workingTree as
            | { staged: FileChange[]; unstaged: FileChange[]; untracked: FileChange[] }
            | undefined;
          setFiles([]);
          setWorkingTree(wt || { staged: [], unstaged: [], untracked: [] });
          return;
        }
        setFiles([]);
        setWorkingTree({ staged: [], unstaged: [], untracked: [] });
        setError(response.error || 'Failed to load working tree');
        return;
      }

      const response = await withTimeout(
        API.sessions.getDiff(session.id, selectedTarget),
        15_000,
        'Load changes'
      );
      if (requestId !== requestIdRef.current) return;
      if (response.success && response.data) {
        const diffText = response.data.diff || '';
        const parsedFiles: FileChange[] = [];

        const fileMatches = diffText.match(/diff --git[\s\S]*?(?=diff --git|$)/g);
        if (fileMatches) {
          for (const fileContent of fileMatches) {
            const fileNameMatch = fileContent.match(/diff --git a\/(.*?) b\/(.*?)(?:\n|$)/);
            if (!fileNameMatch) continue;

            const newFileName = fileNameMatch[2] || fileNameMatch[1] || '';

            let type: FileChange['type'] = 'modified';
            if (fileContent.includes('new file mode')) {
              type = 'added';
            } else if (fileContent.includes('deleted file mode')) {
              type = 'deleted';
            } else if (fileContent.includes('rename from')) {
              type = 'renamed';
            }

            const additions = (fileContent.match(/^\+[^+]/gm) || []).length;
            const deletions = (fileContent.match(/^-[^-]/gm) || []).length;

            parsedFiles.push({
              path: newFileName,
              additions,
              deletions,
              type
            });
          }
        }

        if (parsedFiles.length > 0) {
          setFiles(parsedFiles);
          return;
        }

        // Fallback: if diff parsing fails, still render a file list from backend data
        const changedFiles = Array.isArray((response.data as { changedFiles?: unknown }).changedFiles)
          ? ((response.data as { changedFiles?: unknown }).changedFiles as unknown[]).filter((v): v is string => typeof v === 'string')
          : [];
        setFiles(changedFiles.map((path) => ({ path, additions: 0, deletions: 0, type: 'modified' })));
      } else {
        const message = response.error || 'Failed to load changes';
        const isStaleRefError =
          selectedTarget.kind === 'commit' &&
          /commit not found|bad object|unknown revision|invalid object name|ambiguous argument/i.test(message);
        if (isStaleRefError) {
          // A commit can disappear after rebase/force-push; refresh History and keep UI clean.
          fetchCommits(false);
          return;
        }
        setError(message);
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load changes');
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
        loadingRef.current = false;
      }
    }
  }, [session.id, selectedTarget, fetchCommits]);

  // Fetch commits when session changes
  useEffect(() => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    setCommits([]);
    setSelectedCommitHash(null);
    setSelectedIsUncommitted(false);
    setFiles([]);
    setWorkingTree(null);
    setSelectedFileScope(null);
    setWorkingExpanded({ staged: true, unstaged: true, untracked: true });
    setError(null);
    requestIdRef.current++;
    loadingRef.current = false;
    setIsLoading(false);
    if (session.id) {
      fetchCommits(true);
    }
  }, [session.id, fetchCommits]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, []);

  // Fetch files when selected commit changes
  useEffect(() => {
    if (selectedTarget) {
      fetchFiles();
    }
  }, [selectedTarget, fetchFiles]);

  // NOTE: Do not refresh History from the global git-status event; it can create
  // a feedback loop (git commands update index -> watcher triggers refresh -> UI refreshes again).

  const scheduleRefresh = useCallback(() => {
    if (!session.id) return;
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      fetchCommits(false);
      if (selectedIsUncommitted) {
        fetchFiles();
      }
    }, 650);
  }, [session.id, fetchCommits, fetchFiles, selectedIsUncommitted]);

  // Refresh once after a run completes (running -> waiting/error/etc).
  const prevStatusRef = useRef(session.status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = session.status;
    if (!session.id) return;
    const wasRunning = prev === 'running' || prev === 'initializing';
    const nowRunning = session.status === 'running' || session.status === 'initializing';
    if (wasRunning && !nowRunning) {
      scheduleRefresh();
    }
  }, [session.id, session.status, scheduleRefresh]);

  // Refresh when git state actually changes (not on every poll).
  // Only refresh on stable, state-changing signals. `state`/`lastChecked` can churn even when nothing
  // meaningful changed (e.g. transient errors or polling), which would cause refresh loops.
  const gitSig = [
    String(Number(session.gitStatus?.ahead ?? 0)),
    String(Number(session.gitStatus?.behind ?? 0)),
    String(Boolean(session.gitStatus?.hasUncommittedChanges)),
    String(Boolean(session.gitStatus?.hasUntrackedFiles)),
  ].join('|');
  const prevGitSigRef = useRef(gitSig);
  useEffect(() => {
    if (!session.id) return;
    if (prevGitSigRef.current === gitSig) return;
    prevGitSigRef.current = gitSig;
    scheduleRefresh();
  }, [session.id, gitSig, scheduleRefresh]);

  // Refresh after agent-run git commands that can change History/WT state.
  useEffect(() => {
    if (!session.id) return;
    const unsub = window.electronAPI?.events?.onTimelineEvent?.((data) => {
      if (!data || data.sessionId !== session.id) return;
      const e = data.event as { kind?: unknown; status?: unknown; command?: unknown; meta?: unknown } | undefined;
      if (!e) return;
      if (e.kind !== 'git.command') return;
      if (e.status !== 'finished' && e.status !== 'failed') return;
      const meta = (e.meta || {}) as Record<string, unknown>;
      if (meta.source !== 'agent') return;
      const cmd = typeof e.command === 'string' ? e.command.trim() : '';
      if (!cmd) return;
      if (!/^(git|gh)\b/.test(cmd)) return;

      // Only refresh for state-changing commands (avoid status/diff loops).
      const affectsHistory = /^(git\s+(add|commit|reset|checkout|switch|merge|rebase|cherry-pick|revert|stash|am|apply|rm|mv|tag)\b|gh\s+pr\s+create\b)/.test(cmd);
      if (!affectsHistory) return;
      scheduleRefresh();
    });
    return () => { if (unsub) unsub(); };
  }, [session.id, scheduleRefresh]);

  const handleCommitFileClick = useCallback((file: FileChange) => {
    setSelectedFile(file.path);
    setSelectedFileScope('commit');
    if (!selectedTarget) return;
    onFileClick(file.path, selectedTarget, files);
  }, [onFileClick, selectedTarget, files]);

  const handleWorkingFileClick = useCallback((scope: Exclude<WorkingTreeScope, 'all'>, file: FileChange, groupFiles: FileChange[]) => {
    setSelectedFile(file.path);
    setSelectedFileScope(scope);
    onFileClick(file.path, { kind: 'working', scope }, groupFiles);
  }, [onFileClick]);

  const handleCommitSelect = useCallback((commit: Commit) => {
    setSelectedFile(null);
    setSelectedFileScope(null);
    if (commit.id === 0) {
      setSelectedIsUncommitted(true);
      setSelectedCommitHash(null);
      onCommitClick?.({ kind: 'working', scope: 'all' }, []);
      return;
    }
    setSelectedIsUncommitted(false);
    setSelectedCommitHash(commit.after_commit_hash);
    onCommitClick?.({ kind: 'commit', hash: commit.after_commit_hash }, []);
  }, [onCommitClick]);

  const handleRefresh = useCallback(() => {
    fetchCommits(false);
    fetchFiles();
  }, [fetchCommits, fetchFiles]);

  const totalCommits = commits.length;
  const totalChanges = selectedIsUncommitted
    ? (workingTree?.staged.length || 0) + (workingTree?.unstaged.length || 0) + (workingTree?.untracked.length || 0)
    : files.length;
  const uncommitted = commits.find((c) => c.id === 0) || null;
  const baseCommit = commits.find((c) => c.id === -1) || null;
  const sessionCommits = commits.filter((c) => c.id > 0);
  const headHash = sessionCommits[0]?.after_commit_hash || null;
  const selectedCommit = selectedIsUncommitted
    ? commits.find((c) => c.id === 0)
    : selectedCommitHash
      ? commits.find((c) => c.id !== 0 && c.after_commit_hash === selectedCommitHash)
      : null;

  return (
    <div
      className="h-full flex flex-col"
      style={{
        backgroundColor: colors.bg.primary,
        borderLeft: `1px solid ${colors.border}`,
      }}
    >
      {/* Commits section */}
      <div
        className="flex-shrink-0"
        style={{ borderBottom: `1px solid ${colors.border}` }}
      >
        <div
          className="flex items-center justify-between px-3 py-2"
          style={{ backgroundColor: colors.bg.secondary }}
        >
          <button
            type="button"
            onClick={() => setIsCommitsExpanded(!isCommitsExpanded)}
            className="flex items-center gap-1.5 text-xs font-medium transition-all duration-75 px-1.5 py-0.5 -ml-1.5 rounded st-hoverable st-focus-ring"
            style={{ color: colors.text.secondary }}
          >
            <ChevronDown
              className={`w-3 h-3 transition-transform ${isCommitsExpanded ? '' : '-rotate-90'}`}
              style={{ color: colors.text.muted }}
            />
            <span>Commits</span>
            {uncommitted && (
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: colors.text.modified }}
                title="Working tree has changes"
              />
            )}
          </button>
          <div className="flex items-center gap-1">
            {onPushPR && (
              <button
                type="button"
                onClick={onPushPR}
                disabled={isPushPRDisabled || isLoading || isRefreshingHistory}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-all duration-75 st-hoverable st-focus-ring disabled:opacity-40"
                style={{ color: colors.accent }}
                title="Push to remote PR (create PR if missing)"
              >
                <GitPullRequest className="w-3 h-3" />
                Remote PR
              </button>
            )}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading || isRefreshingHistory}
              className="p-1.5 rounded transition-all duration-75 st-hoverable st-focus-ring disabled:opacity-40"
              title="Refresh"
            >
              <RefreshCw
                className={`w-3 h-3 ${isLoading || isRefreshingHistory ? 'animate-spin' : ''}`}
                style={{ color: colors.text.muted }}
              />
            </button>
          </div>
        </div>

        {isCommitsExpanded && (
          <div className="max-h-48 overflow-y-auto">
            {totalCommits === 0 ? (
              <div
                className="flex items-center justify-center py-6 text-xs"
                style={{ color: colors.text.muted }}
              >
                No commits
              </div>
            ) : (
              <div>
                {uncommitted && (
                  <div className="flex">
                    <div className="w-5 flex flex-col items-center pt-3">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: selectedIsUncommitted ? colors.accent : colors.text.modified,
                          boxShadow: selectedIsUncommitted ? `0 0 0 3px color-mix(in srgb, ${colors.accent} 18%, transparent)` : 'none',
                        }}
                      />
                      {(sessionCommits.length > 0 || baseCommit) && (
                        <StackConnector accent={selectedIsUncommitted} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <CommitItem
                        commit={uncommitted}
                        isSelected={selectedIsUncommitted}
                        onClick={() => handleCommitSelect(uncommitted)}
                        onCommitUncommittedChanges={onCommitUncommittedChanges}
                        isCommitDisabled={isCommitDisabled}
                      />
                    </div>
                  </div>
                )}

                {sessionCommits.map((commit, idx) => {
                  const isSelected = selectedCommitHash === commit.after_commit_hash && !selectedIsUncommitted;
                  const isLastSession = idx === sessionCommits.length - 1;
                  const isHead = headHash === commit.after_commit_hash;
                  return (
                    <div key={commit.after_commit_hash} className="flex">
                      <div className="w-5 flex flex-col items-center pt-3">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{
                            backgroundColor: isSelected ? colors.accent : colors.text.muted,
                            boxShadow: isSelected ? `0 0 0 3px color-mix(in srgb, ${colors.accent} 18%, transparent)` : 'none',
                          }}
                        />
                        {(!isLastSession || baseCommit) && (
                          <StackConnector accent={isSelected} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <CommitItem
                          commit={commit}
                          isSelected={isSelected}
                          badge={isHead ? 'HEAD' : undefined}
                          onClick={() => handleCommitSelect(commit)}
                        />
                      </div>
                    </div>
                  );
                })}

                {baseCommit && (
                  <div className="flex">
                    <div className="w-5 flex flex-col items-center pt-3">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: 'transparent',
                          border: `1px solid ${colors.border}`,
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CommitItem
                        commit={baseCommit}
                        isSelected={selectedCommitHash === baseCommit.after_commit_hash && !selectedIsUncommitted}
                        badge="BASE"
                        onClick={() => handleCommitSelect(baseCommit)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Changes section */}
      <div className="flex-1 flex flex-col min-h-0">
        <div
          className="flex items-center justify-between px-3 py-2"
          style={{
            backgroundColor: colors.bg.secondary,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <button
            type="button"
            onClick={() => setIsChangesExpanded(!isChangesExpanded)}
            className="flex items-center gap-1.5 text-xs font-medium transition-all duration-75 px-1.5 py-0.5 -ml-1.5 rounded st-hoverable st-focus-ring"
            style={{ color: colors.text.secondary }}
          >
            <ChevronDown
              className={`w-3 h-3 transition-transform ${isChangesExpanded ? '' : '-rotate-90'}`}
              style={{ color: colors.text.muted }}
            />
            <span>Changes</span>
            {totalChanges > 0 && (
              <span
                className="ml-1 px-1.5 py-0.5 text-[10px] rounded font-mono"
                style={{ backgroundColor: colors.bg.hover, color: colors.text.muted }}
              >
                {totalChanges}
              </span>
            )}
          </button>
          {selectedCommit && (
            <span
              className="text-[10px] font-mono truncate max-w-[100px]"
              style={{ color: selectedCommit.id === 0 ? colors.text.modified : colors.accent }}
              title={selectedCommit.commit_message}
            >
              {selectedCommit.id === 0 ? 'Working Tree' : selectedCommit.after_commit_hash.substring(0, 7)}
            </span>
          )}
        </div>

        <div
          className={`flex-1 overflow-y-auto transition-all origin-top ${
            isChangesExpanded ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-0 h-0'
          }`}
          style={{ transitionDuration: '150ms' }}
        >
          {isLoading && (selectedIsUncommitted ? !workingTree : files.length === 0) ? (
            <div
              className="flex flex-col items-center justify-center py-8 gap-2"
              style={{ color: colors.text.muted }}
            >
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Loading...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <span className="text-xs" style={{ color: colors.text.deleted }}>{error}</span>
              <button
                type="button"
                onClick={handleRefresh}
                className="text-xs px-3 py-1 rounded transition-all duration-75 st-hoverable st-focus-ring"
                style={{ backgroundColor: colors.bg.hover, color: colors.text.secondary }}
              >
                Retry
              </button>
            </div>
          ) : selectedIsUncommitted ? (
            (!workingTree || (workingTree.staged.length + workingTree.unstaged.length + workingTree.untracked.length) === 0) ? (
              <div
                className="flex items-center justify-center py-8 text-xs"
                style={{ color: colors.text.muted }}
              >
                {!selectedTarget ? 'Select a commit' : 'Working tree clean'}
              </div>
            ) : (
              <div className="py-1">
                {(['staged', 'unstaged', 'untracked'] as const).map((group) => {
                  const label = group === 'staged' ? 'Staged' : group === 'unstaged' ? 'Unstaged' : 'Untracked';
                  const list = workingTree[group];
                  const additions = list.reduce((sum, f) => sum + (f.additions || 0), 0);
                  const deletions = list.reduce((sum, f) => sum + (f.deletions || 0), 0);
                  const expanded = workingExpanded[group];
                  const toggle = () => setWorkingExpanded((prev) => ({ ...prev, [group]: !prev[group] }));
                  return (
                    <div key={group}>
                      <WorkingGroupHeader
                        label={label}
                        count={list.length}
                        additions={additions}
                        deletions={deletions}
                        expanded={expanded}
                        onToggle={toggle}
                      />
                      {expanded && (
                        <div>
                          {list.length === 0 ? (
                            <div className="px-3 py-2 text-xs" style={{ color: colors.text.muted }}>No changes</div>
                          ) : (
                            list.map((file) => (
                              <FileItem
                                key={`${group}:${file.path}`}
                                file={file}
                                onClick={() => handleWorkingFileClick(group, file, list)}
                                isSelected={selectedFile === file.path && selectedFileScope === group}
                              />
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : files.length === 0 ? (
            <div
              className="flex items-center justify-center py-8 text-xs"
              style={{ color: colors.text.muted }}
            >
              {!selectedTarget ? 'Select a commit' : 'No changes'}
            </div>
          ) : (
            <div className="py-1">
              {files.map((file) => (
                <FileItem
                  key={file.path}
                  file={file}
                  onClick={() => handleCommitFileClick(file)}
                  isSelected={selectedFile === file.path && selectedFileScope === 'commit'}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

RightPanel.displayName = 'RightPanel';

export default RightPanel;
