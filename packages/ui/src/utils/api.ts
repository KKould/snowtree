export interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
  command?: string;
}

const requireElectron = () => {
  if (typeof window === 'undefined' || !window.electronAPI) {
    throw new Error('Electron API not available');
  }
};

export class API {
  static sessions = {
    async getAll() {
      requireElectron();
      return window.electronAPI.sessions.getAll();
    },

    async get(sessionId: string) {
      requireElectron();
      return window.electronAPI.sessions.get(sessionId);
    },

    async create(request: { projectId: number; prompt: string; toolType: 'claude' | 'codex' | 'none' }) {
      requireElectron();
      return window.electronAPI.sessions.create(request);
    },

    async stop(sessionId: string) {
      requireElectron();
      return window.electronAPI.sessions.stop(sessionId);
    },

    async delete(sessionId: string) {
      requireElectron();
      return window.electronAPI.sessions.delete(sessionId);
    },

    async openWorktree(request: { projectId: number; worktreePath: string; branch?: string | null }) {
      requireElectron();
      return window.electronAPI.sessions.openWorktree(request);
    },

    async getTimeline(sessionId: string) {
      requireElectron();
      return window.electronAPI.sessions.getTimeline(sessionId);
    },

    async getExecutions(sessionId: string) {
      requireElectron();
      return window.electronAPI.sessions.getExecutions(sessionId);
    },

    async getDiff(sessionId: string, target: import('../types/diff').DiffTarget) {
      requireElectron();
      return window.electronAPI.sessions.getDiff(sessionId, target);
    },

    async getGitCommands(sessionId: string) {
      requireElectron();
      return window.electronAPI.sessions.getGitCommands(sessionId);
    },
  };

  static projects = {
    async getAll() {
      requireElectron();
      return window.electronAPI.projects.getAll();
    },

    async create(request: { name: string; path: string; active: boolean }) {
      requireElectron();
      return window.electronAPI.projects.create(request);
    },

    async delete(projectId: number) {
      requireElectron();
      return window.electronAPI.projects.delete(projectId);
    },

    async getWorktrees(projectId: number, sessionId?: string | null) {
      requireElectron();
      return window.electronAPI.projects.getWorktrees(projectId, sessionId);
    },

    async removeWorktree(projectId: number, worktreePath: string, sessionId?: string | null) {
      requireElectron();
      return window.electronAPI.projects.removeWorktree(projectId, worktreePath, sessionId);
    },

    async renameWorktree(projectId: number, worktreePath: string, nextName: string, sessionId?: string | null) {
      requireElectron();
      return window.electronAPI.projects.renameWorktree(projectId, worktreePath, nextName, sessionId);
    },
  };

  static dialog = {
    async openDirectory(options?: { title?: string; buttonLabel?: string }) {
      requireElectron();
      return window.electronAPI.dialog.openDirectory(options);
    },
  };

  static aiTools = {
    async getStatus(options?: { force?: boolean }) {
      requireElectron();
      return window.electronAPI.aiTools.getStatus(options);
    },
    async getSettings() {
      requireElectron();
      return window.electronAPI.aiTools.getSettings();
    },
  };
}
