import type { IpcMain } from 'electron';
import type { AppServices } from './types';

export function registerGitHandlers(ipcMain: IpcMain, services: AppServices): void {
  const { sessionManager, gitDiffManager, gitExecutor } = services;

  ipcMain.handle('sessions:get-executions', async (_event, sessionId: string) => {
    try {
      const session = sessionManager.getSession(sessionId);
      if (!session?.worktreePath) return { success: false, error: 'Session worktree not found' };

      const baseBranch = session.baseBranch || 'main';
      const commits = await gitDiffManager.getCommitHistory(session.worktreePath, 50, baseBranch, sessionId);

      const executions = commits.map((commit, index) => ({
        id: index + 1,
        session_id: sessionId,
        execution_sequence: index + 1,
        after_commit_hash: commit.hash,
        parent_commit_hash: commit.parents[0] || null,
        commit_message: commit.message,
        timestamp: commit.date.toISOString(),
        stats_additions: commit.stats.additions,
        stats_deletions: commit.stats.deletions,
        stats_files_changed: commit.stats.filesChanged,
        author: commit.author,
        comparison_branch: baseBranch,
        history_source: 'git',
        history_limit_reached: commits.length === 50
      }));

      if (await gitDiffManager.hasChanges(session.worktreePath, sessionId)) {
        const uncommittedDiff = await gitDiffManager.captureWorkingDirectoryDiff(session.worktreePath, sessionId);
        executions.unshift({
          id: 0,
          session_id: sessionId,
          execution_sequence: 0,
          after_commit_hash: 'UNCOMMITTED',
          parent_commit_hash: null,
          commit_message: 'Uncommitted changes',
          timestamp: new Date().toISOString(),
          stats_additions: uncommittedDiff.stats.additions,
          stats_deletions: uncommittedDiff.stats.deletions,
          stats_files_changed: uncommittedDiff.stats.filesChanged,
          author: 'You',
          comparison_branch: baseBranch,
          history_source: 'git',
          history_limit_reached: commits.length === 50
        });
      }

      // Append the base branch HEAD commit (single commit) for context.
      // Keep this lightweight and avoid spamming Conversations (read operations are not recorded by default).
      const resolveBaseRef = async (): Promise<string | null> => {
        try {
          await gitExecutor.run({
            cwd: session.worktreePath!,
            argv: ['git', 'show-ref', '--verify', '--quiet', `refs/remotes/origin/${baseBranch}`],
            op: 'read',
            recordTimeline: false,
            meta: { source: 'ipc.git', operation: 'base-ref-probe', ref: `refs/remotes/origin/${baseBranch}` },
          });
          return `origin/${baseBranch}`;
        } catch {
          // ignore
        }
        try {
          await gitExecutor.run({
            cwd: session.worktreePath!,
            argv: ['git', 'show-ref', '--verify', '--quiet', `refs/heads/${baseBranch}`],
            op: 'read',
            recordTimeline: false,
            meta: { source: 'ipc.git', operation: 'base-ref-probe', ref: `refs/heads/${baseBranch}` },
          });
          return baseBranch;
        } catch {
          // ignore
        }
        try {
          await gitExecutor.run({
            cwd: session.worktreePath!,
            argv: ['git', 'rev-parse', '--verify', `${baseBranch}^{commit}`],
            op: 'read',
            recordTimeline: false,
            meta: { source: 'ipc.git', operation: 'base-ref-probe', ref: baseBranch },
          });
          return baseBranch;
        } catch {
          return null;
        }
      };

      const baseRef = await resolveBaseRef();
      if (baseRef) {
        try {
          const delimiter = '\x1f';
          const fmt = `%H${delimiter}%P${delimiter}%s${delimiter}%cI${delimiter}%an`;
          const { stdout } = await gitExecutor.run({
            cwd: session.worktreePath,
            argv: ['git', 'log', '-1', `--format=${fmt}`, baseRef],
            op: 'read',
            recordTimeline: false,
            meta: { source: 'ipc.git', operation: 'base-head', baseRef, baseBranch },
          });
          const line = stdout.trim();
          if (line) {
            const [hash, parentsRaw, subject, timestamp, author] = line.split(delimiter);
            if (hash) {
              executions.push({
                id: -1,
                session_id: sessionId,
                execution_sequence: -1,
                after_commit_hash: hash,
                parent_commit_hash: (parentsRaw || '').trim().split(/\s+/).filter(Boolean)[0] || null,
                commit_message: `[base/${baseBranch}] ${subject || ''}`.trim(),
                timestamp: timestamp || new Date().toISOString(),
                stats_additions: 0,
                stats_deletions: 0,
                stats_files_changed: 0,
                author: author || '',
                comparison_branch: baseBranch,
                history_source: 'git',
                history_limit_reached: commits.length === 50
              });
            }
          }
        } catch {
          // ignore
        }
      }

      return { success: true, data: executions };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to load executions' };
    }
  });

  ipcMain.handle('sessions:get-diff', async (_event, sessionId: string, target?: { kind?: unknown; hash?: unknown }) => {
    try {
      const session = sessionManager.getSession(sessionId);
      if (!session?.worktreePath) return { success: false, error: 'Session worktree not found' };

      const kind = typeof target?.kind === 'string' ? target.kind : 'working';
      if (kind === 'working') {
        const scopeRaw = (target as { scope?: unknown } | undefined)?.scope;
        const scope = (typeof scopeRaw === 'string' ? scopeRaw : 'all') as 'all' | 'staged' | 'unstaged' | 'untracked';

        if (scope === 'all') {
          const diff = await gitDiffManager.captureWorkingDirectoryDiff(session.worktreePath, sessionId);
          const workingTree = await gitDiffManager.getWorkingTreeGroups(session.worktreePath, sessionId);
          return { success: true, data: { ...diff, workingTree } };
        }

        if (scope === 'staged' || scope === 'unstaged' || scope === 'untracked') {
          const diff = await gitDiffManager.captureWorkingTreeDiff(session.worktreePath, scope, sessionId);
          return { success: true, data: diff };
        }

        return { success: false, error: `Unsupported working diff scope: ${scope}` };
      }

      if (kind === 'commit') {
        const hash = typeof target?.hash === 'string' ? target.hash.trim() : '';
        if (!hash) return { success: false, error: 'Commit hash is required' };

        const diff = await gitDiffManager.getCommitDiff(session.worktreePath, hash, sessionId);
        return { success: true, data: diff };
      }

      return { success: false, error: `Unsupported diff target: ${kind}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to load diff' };
    }
  });

  ipcMain.handle('sessions:get-git-commands', async (_event, sessionId: string) => {
    try {
      const session = sessionManager.getSession(sessionId);
      if (!session?.worktreePath) return { success: false, error: 'Session worktree not found' };

      const { stdout } = await gitExecutor.run({
        sessionId,
        cwd: session.worktreePath,
        argv: ['git', 'branch', '--show-current'],
        op: 'read',
        meta: { source: 'ipc.git', operation: 'current-branch' },
      });
      const currentBranch = stdout.trim();

      return { success: true, data: { currentBranch } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to load git commands' };
    }
  });
}
