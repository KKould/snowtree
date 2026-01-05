import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitExecutor } from '../GitExecutor';
import type { SessionManager } from '../../../features/session/SessionManager';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

vi.mock('child_process');
vi.mock('../../../infrastructure/command/shellPath', () => ({
  getShellPath: () => '/usr/local/bin:/usr/bin:/bin',
}));

class MockProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = vi.fn();
}

describe('GitExecutor', () => {
  let gitExecutor: GitExecutor;
  let mockSessionManager: SessionManager;
  let mockProcess: MockProcess;

  beforeEach(() => {
    mockProcess = new MockProcess();
    vi.mocked(spawn).mockReturnValue(mockProcess as any);

    mockSessionManager = {
      addTimelineEvent: vi.fn().mockReturnValue({ id: 1 }),
    } as any;

    gitExecutor = new GitExecutor(mockSessionManager);
  });

  describe('run', () => {
    it('should execute git command successfully', async () => {
      const promise = gitExecutor.run({
        cwd: '/tmp/project',
        argv: ['git', 'status'],
      });

      mockProcess.stdout.emit('data', 'On branch main');
      mockProcess.emit('close', 0);

      const result = await promise;

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('On branch main');
      expect(result.commandDisplay).toBe('git status');
    });

    it('should throw error if argv is empty', async () => {
      await expect(
        gitExecutor.run({
          cwd: '/tmp/project',
          argv: [],
        })
      ).rejects.toThrow('GitExecutor.run requires argv');
    });

    it('should collect stdout and stderr', async () => {
      const promise = gitExecutor.run({
        cwd: '/tmp/project',
        argv: ['git', 'log'],
      });

      mockProcess.stdout.emit('data', 'commit abc123\n');
      mockProcess.stdout.emit('data', 'Author: Test\n');
      mockProcess.stderr.emit('data', 'warning: something\n');
      mockProcess.emit('close', 0);

      const result = await promise;

      expect(result.stdout).toBe('commit abc123\nAuthor: Test\n');
      expect(result.stderr).toBe('warning: something\n');
    });

    it('should reject on non-zero exit code', async () => {
      const promise = gitExecutor.run({
        cwd: '/tmp/project',
        argv: ['git', 'checkout', 'nonexistent'],
      });

      mockProcess.stderr.emit('data', 'error: branch not found');
      mockProcess.emit('close', 1);

      await expect(promise).rejects.toThrow();
    });

    it('should treat as success if output matches pattern', async () => {
      const promise = gitExecutor.run({
        cwd: '/tmp/project',
        argv: ['git', 'push'],
        treatAsSuccessIfOutputIncludes: ['Everything up-to-date'],
      });

      mockProcess.stderr.emit('data', 'Everything up-to-date');
      mockProcess.emit('close', 1);

      const result = await promise;

      expect(result.exitCode).toBe(0);
    });

    it('should check pattern in both stdout and stderr', async () => {
      const promise = gitExecutor.run({
        cwd: '/tmp/project',
        argv: ['git', 'push'],
        treatAsSuccessIfOutputIncludes: ['up-to-date'],
      });

      mockProcess.stdout.emit('data', 'Everything up-to-date');
      mockProcess.emit('close', 1);

      const result = await promise;

      expect(result.exitCode).toBe(0);
    });

    it('should generate unique operation ID', async () => {
      const promise1 = gitExecutor.run({
        cwd: '/tmp/project',
        argv: ['git', 'status'],
      });

      mockProcess.emit('close', 0);
      const result1 = await promise1;

      mockProcess = new MockProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as any);

      const promise2 = gitExecutor.run({
        cwd: '/tmp/project',
        argv: ['git', 'status'],
      });

      mockProcess.emit('close', 0);
      const result2 = await promise2;

      expect(result1.operationId).toBeDefined();
      expect(result2.operationId).toBeDefined();
      expect(result1.operationId).not.toBe(result2.operationId);
    });

    it('should calculate duration', async () => {
      const promise = gitExecutor.run({
        cwd: '/tmp/project',
        argv: ['git', 'status'],
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      mockProcess.emit('close', 0);

      const result = await promise;

      expect(result.durationMs).toBeGreaterThan(0);
    });

    it('should use default timeout of 120 seconds', async () => {
      const promise = gitExecutor.run({
        cwd: '/tmp/project',
        argv: ['git', 'fetch'],
      });

      expect(spawn).toHaveBeenCalledWith(
        'git',
        ['fetch'],
        expect.objectContaining({ cwd: '/tmp/project' })
      );

      mockProcess.emit('close', 0);
      await promise;
    });

    it('should use custom timeout when provided', async () => {
      const promise = gitExecutor.run({
        cwd: '/tmp/project',
        argv: ['git', 'fetch'],
        timeoutMs: 5000,
      });

      mockProcess.emit('close', 0);
      await promise;
    });

    it('should kill process on timeout', async () => {
      vi.useFakeTimers();

      const promise = gitExecutor.run({
        cwd: '/tmp/project',
        argv: ['git', 'clone', 'large-repo'],
        timeoutMs: 1000,
      });

      vi.advanceTimersByTime(1000);

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');

      vi.useRealTimers();
      mockProcess.emit('close', null);

      await expect(promise).resolves.toBeDefined();
    });

    it('should handle process error event', async () => {
      const promise = gitExecutor.run({
        cwd: '/tmp/project',
        argv: ['nonexistent-command'],
      });

      mockProcess.emit('error', new Error('Command not found'));

      await expect(promise).rejects.toThrow('Command not found');
    });

    it('should format command for display', async () => {
      const promise = gitExecutor.run({
        cwd: '/tmp/project',
        argv: ['git', 'commit', '-m', 'feat: add feature'],
      });

      mockProcess.emit('close', 0);
      const result = await promise;

      expect(result.commandDisplay).toContain('git commit -m');
    });

    it('should escape special characters in commandCopy', async () => {
      const promise = gitExecutor.run({
        cwd: '/tmp/project',
        argv: ['git', 'commit', '-m', 'message with spaces'],
      });

      mockProcess.emit('close', 0);
      const result = await promise;

      expect(result.commandCopy).toContain("'message with spaces'");
    });

    it('should set environment variables', async () => {
      gitExecutor.run({
        cwd: '/tmp/project',
        argv: ['git', 'status'],
      });

      expect(spawn).toHaveBeenCalledWith(
        'git',
        ['status'],
        expect.objectContaining({
          env: expect.objectContaining({
            NO_COLOR: '1',
            FORCE_COLOR: '0',
          }),
        })
      );

      mockProcess.emit('close', 0);
    });
  });

  describe('timeline recording', () => {
    it('should record timeline for write operations with sessionId', async () => {
      const promise = gitExecutor.run({
        sessionId: 'test-session',
        cwd: '/tmp/project',
        argv: ['git', 'commit', '-m', 'test'],
        op: 'write',
      });

      mockProcess.emit('close', 0);
      await promise;

      expect(mockSessionManager.addTimelineEvent).toHaveBeenCalledTimes(2);
      expect(mockSessionManager.addTimelineEvent).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'started' })
      );
      expect(mockSessionManager.addTimelineEvent).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'finished' })
      );
    });

    it('should not record timeline for read operations by default', async () => {
      const promise = gitExecutor.run({
        sessionId: 'test-session',
        cwd: '/tmp/project',
        argv: ['git', 'status'],
        op: 'read',
      });

      mockProcess.emit('close', 0);
      await promise;

      expect(mockSessionManager.addTimelineEvent).not.toHaveBeenCalled();
    });

    it('should record timeline when explicitly requested', async () => {
      const promise = gitExecutor.run({
        sessionId: 'test-session',
        cwd: '/tmp/project',
        argv: ['git', 'status'],
        recordTimeline: true,
      });

      mockProcess.emit('close', 0);
      await promise;

      expect(mockSessionManager.addTimelineEvent).toHaveBeenCalled();
    });

    it('should not record timeline without sessionId', async () => {
      const promise = gitExecutor.run({
        cwd: '/tmp/project',
        argv: ['git', 'commit', '-m', 'test'],
        op: 'write',
      });

      mockProcess.emit('close', 0);
      await promise;

      expect(mockSessionManager.addTimelineEvent).not.toHaveBeenCalled();
    });

    it('should record failed status on error', async () => {
      const promise = gitExecutor.run({
        sessionId: 'test-session',
        cwd: '/tmp/project',
        argv: ['git', 'push'],
        op: 'write',
      });

      mockProcess.stderr.emit('data', 'error: failed to push');
      mockProcess.emit('close', 1);

      await expect(promise).rejects.toThrow();

      expect(mockSessionManager.addTimelineEvent).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' })
      );
    });

    it('should include duration in timeline event', async () => {
      const promise = gitExecutor.run({
        sessionId: 'test-session',
        cwd: '/tmp/project',
        argv: ['git', 'commit', '-m', 'test'],
        op: 'write',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      mockProcess.emit('close', 0);

      await promise;

      expect(mockSessionManager.addTimelineEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'finished',
          duration_ms: expect.any(Number),
        })
      );
    });

    it('should include exit code in timeline event', async () => {
      const promise = gitExecutor.run({
        sessionId: 'test-session',
        cwd: '/tmp/project',
        argv: ['git', 'commit', '-m', 'test'],
        op: 'write',
      });

      mockProcess.emit('close', 0);
      await promise;

      expect(mockSessionManager.addTimelineEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'finished',
          exit_code: 0,
        })
      );
    });

    it('should use provided kind in timeline event', async () => {
      const promise = gitExecutor.run({
        sessionId: 'test-session',
        cwd: '/tmp/project',
        argv: ['git', 'worktree', 'add', 'feature'],
        kind: 'worktree.command',
        op: 'write',
      });

      mockProcess.emit('close', 0);
      await promise;

      expect(mockSessionManager.addTimelineEvent).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'worktree.command' })
      );
    });

    it('should default to git.command kind', async () => {
      const promise = gitExecutor.run({
        sessionId: 'test-session',
        cwd: '/tmp/project',
        argv: ['git', 'commit', '-m', 'test'],
        op: 'write',
      });

      mockProcess.emit('close', 0);
      await promise;

      expect(mockSessionManager.addTimelineEvent).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'git.command' })
      );
    });

    it('should include meta in timeline event', async () => {
      const promise = gitExecutor.run({
        sessionId: 'test-session',
        cwd: '/tmp/project',
        argv: ['git', 'commit', '-m', 'test'],
        op: 'write',
        meta: { branch: 'main' },
      });

      mockProcess.emit('close', 0);
      await promise;

      expect(mockSessionManager.addTimelineEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({ branch: 'main' }),
        })
      );
    });
  });
});
