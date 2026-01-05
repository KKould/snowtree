// Stub file - TODO: Implement proper config manager
export class ConfigManager {
  getGitRepoPath(): string {
    return process.cwd();
  }

  isVerbose(): boolean {
    return false;
  }
}
