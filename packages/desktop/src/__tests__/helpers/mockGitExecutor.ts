import { vi } from 'vitest';
import type { GitExecutor, GitRunResult } from '../../executors/git';

export function createMockGitExecutor(): GitExecutor {
  const mockRun = vi.fn().mockResolvedValue({
    commandDisplay: '',
    commandCopy: '',
    stdout: '',
    stderr: '',
    exitCode: 0,
    durationMs: 0,
    operationId: 'test-op-id',
  });

  return {
    run: mockRun,
  } as any;
}

const mockCommandMap = new Map<string, Partial<GitRunResult>>();

export function mockGitCommand(
  executor: GitExecutor,
  commandMatch: string | string[],
  output: Partial<GitRunResult>
): void {
  const matchArray = Array.isArray(commandMatch) ? commandMatch : [commandMatch];

  matchArray.forEach(cmd => {
    mockCommandMap.set(cmd, output);
  });

  (executor.run as ReturnType<typeof vi.fn>).mockImplementation((opts) => {
    const argsString = opts.argv ? opts.argv.join(' ') : '';

    for (const [cmd, cmdOutput] of mockCommandMap.entries()) {
      if (argsString.includes(cmd)) {
        return Promise.resolve({
          commandDisplay: argsString,
          commandCopy: argsString,
          stdout: '',
          stderr: '',
          exitCode: 0,
          durationMs: 0,
          operationId: 'test-op-id',
          ...cmdOutput,
        });
      }
    }

    return Promise.resolve({
      commandDisplay: argsString,
      commandCopy: argsString,
      stdout: '',
      stderr: '',
      exitCode: 0,
      durationMs: 0,
      operationId: 'test-op-id',
    });
  });
}

export function clearMockGitCommands(): void {
  mockCommandMap.clear();
}

export function createWorktreeMockImplementation(overrides: Record<string, (cmd: string) => Promise<Partial<GitRunResult>> | null> = {}) {
  return (opts: any) => {
    const cmd = opts.argv ? opts.argv.join(' ') : '';

    for (const [pattern, handler] of Object.entries(overrides)) {
      if (cmd.includes(pattern)) {
        const result = handler(cmd);
        if (result) return result;
      }
    }

    const defaultResult = {
      commandDisplay: cmd,
      commandCopy: cmd,
      stdout: '',
      stderr: '',
      exitCode: 0,
      durationMs: 0,
      operationId: 'test-op-id',
    };

    if (cmd.includes('rev-parse --is-inside-work-tree')) {
      return Promise.resolve({ ...defaultResult, stdout: 'true' });
    }
    if (cmd.includes('rev-parse HEAD')) {
      return Promise.resolve({ ...defaultResult, stdout: 'abc123def456' });
    }
    if (cmd.includes('remote get-url origin')) {
      return Promise.resolve({ ...defaultResult, stdout: 'git@github.com:user/repo.git' });
    }
    if (cmd.includes('fetch origin')) {
      return Promise.resolve({ ...defaultResult, stdout: '' });
    }
    if (cmd.includes('symbolic-ref') && cmd.includes('origin/HEAD')) {
      return Promise.resolve({ ...defaultResult, stdout: 'refs/remotes/origin/main' });
    }
    if (cmd.includes('show-ref --verify --quiet refs/heads')) {
      // Mimic GitExecutor behavior: non-zero exit code
      // Check if throwOnError is explicitly set
      const hasThrowOnError = opts && typeof opts.throwOnError !== 'undefined';
      const throwOnError = hasThrowOnError ? opts.throwOnError : true;

      if (throwOnError === false) {
        // When throwOnError is explicitly false, resolve with non-zero exitCode
        return Promise.resolve({ ...defaultResult, exitCode: 1, stderr: 'not found' });
      } else {
        // When throwOnError is true or undefined (default), reject like GitExecutor does
        return Promise.reject(new Error('not found'));
      }
    }
    if (cmd.includes('show-ref --verify') && cmd.includes('refs/remotes/origin/')) {
      return Promise.resolve({ ...defaultResult, stdout: 'abc123 refs/remotes/origin/main' });
    }
    if (cmd.includes('show-ref')) {
      return Promise.resolve({ ...defaultResult, stdout: '' });
    }
    if (cmd.includes('rev-parse --verify')) {
      return Promise.resolve({ ...defaultResult, stdout: 'abc123def456' });
    }
    if (cmd.includes('rev-parse origin/')) {
      return Promise.resolve({ ...defaultResult, stdout: 'abc123def456' });
    }
    if (cmd.includes('rev-parse --abbrev-ref HEAD')) {
      return Promise.resolve({ ...defaultResult, stdout: 'main' });
    }
    if (cmd.includes('worktree add')) {
      return Promise.resolve({ ...defaultResult, stdout: 'Preparing worktree' });
    }
    if (cmd.includes('worktree remove')) {
      return Promise.resolve({ ...defaultResult, stdout: 'removed' });
    }

    return Promise.resolve(defaultResult);
  };
}

export function setupDefaultWorktreeGitMocks(executor: GitExecutor): void {
  (executor.run as ReturnType<typeof vi.fn>).mockImplementation(createWorktreeMockImplementation());
}
