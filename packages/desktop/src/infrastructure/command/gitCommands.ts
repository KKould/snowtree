// Stub file - TODO: Implement git commands
export function createGitCommand(args: string[]): string {
  return `git ${args.join(' ')}`;
}

export function createWorktreeCommand(args: string[]): string {
  return `git worktree ${args.join(' ')}`;
}
