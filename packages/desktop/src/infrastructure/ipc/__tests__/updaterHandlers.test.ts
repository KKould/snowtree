import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IpcMain } from 'electron';
import { registerAppHandlers } from '../app';
import type { AppServices } from '../types';
import type { UpdateManager } from '../../../features/updater/UpdateManager';

// Mock IpcMain
class MockIpcMain {
  private handlers: Map<string, (event: unknown, ...args: unknown[]) => unknown> = new Map();

  handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown) {
    this.handlers.set(channel, listener);
  }

  // Helper method to simulate IPC calls
  async invoke(channel: string, ...args: unknown[]) {
    const handler = this.handlers.get(channel);
    if (!handler) {
      throw new Error(`No handler registered for channel: ${channel}`);
    }
    return handler({}, ...args);
  }

  clear() {
    this.handlers.clear();
  }
}

describe('Updater IPC Handlers', () => {
  let mockIpcMain: MockIpcMain;
  let mockUpdateManager: UpdateManager;
  let mockServices: AppServices;

  beforeEach(() => {
    mockIpcMain = new MockIpcMain();

    // Mock UpdateManager
    mockUpdateManager = {
      downloadUpdate: vi.fn().mockResolvedValue(undefined),
      quitAndInstall: vi.fn(),
    } as unknown as UpdateManager;

    // Mock AppServices
    mockServices = {
      updateManager: mockUpdateManager,
      app: {} as AppServices['app'],
      configManager: {} as AppServices['configManager'],
      databaseService: {} as AppServices['databaseService'],
      sessionManager: {} as AppServices['sessionManager'],
      worktreeManager: {} as AppServices['worktreeManager'],
      gitExecutor: {} as AppServices['gitExecutor'],
      claudeExecutor: {} as AppServices['claudeExecutor'],
      codexExecutor: {} as AppServices['codexExecutor'],
      gitDiffManager: {} as AppServices['gitDiffManager'],
      gitStatusManager: {} as AppServices['gitStatusManager'],
      executionTracker: {} as AppServices['executionTracker'],
      worktreeNameGenerator: {} as AppServices['worktreeNameGenerator'],
      taskQueue: null,
      getMainWindow: () => null,
    } as AppServices;

    // Register handlers
    registerAppHandlers(mockIpcMain as unknown as IpcMain, mockServices);
  });

  describe('updater:download', () => {
    it('should download update when UpdateManager is available', async () => {
      const result = await mockIpcMain.invoke('updater:download');

      expect(mockUpdateManager.downloadUpdate).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ success: true });
    });

    it('should handle download errors', async () => {
      const error = new Error('Download failed');
      (mockUpdateManager.downloadUpdate as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

      const result = await mockIpcMain.invoke('updater:download');

      expect(result).toEqual({
        success: false,
        error: 'Download failed',
      });
    });

    it('should return error when UpdateManager is not available', async () => {
      mockServices.updateManager = null;

      const result = await mockIpcMain.invoke('updater:download');

      expect(result).toEqual({
        success: false,
        error: 'UpdateManager not available',
      });
      expect(mockUpdateManager.downloadUpdate).not.toHaveBeenCalled();
    });

    it('should return error when UpdateManager is undefined', async () => {
      mockServices.updateManager = undefined;

      const result = await mockIpcMain.invoke('updater:download');

      expect(result).toEqual({
        success: false,
        error: 'UpdateManager not available',
      });
    });
  });

  describe('updater:install', () => {
    it('should quit and install when UpdateManager is available', async () => {
      const result = await mockIpcMain.invoke('updater:install');

      expect(mockUpdateManager.quitAndInstall).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ success: true });
    });

    it('should handle install errors', async () => {
      const error = new Error('Install failed');
      (mockUpdateManager.quitAndInstall as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
        throw error;
      });

      const result = await mockIpcMain.invoke('updater:install');

      expect(result).toEqual({
        success: false,
        error: 'Install failed',
      });
    });

    it('should return error when UpdateManager is not available', async () => {
      mockServices.updateManager = null;

      const result = await mockIpcMain.invoke('updater:install');

      expect(result).toEqual({
        success: false,
        error: 'UpdateManager not available',
      });
      expect(mockUpdateManager.quitAndInstall).not.toHaveBeenCalled();
    });

    it('should return error when UpdateManager is undefined', async () => {
      mockServices.updateManager = undefined;

      const result = await mockIpcMain.invoke('updater:install');

      expect(result).toEqual({
        success: false,
        error: 'UpdateManager not available',
      });
    });
  });

  describe('integration scenarios', () => {
    it('should handle multiple download requests', async () => {
      // First download
      const result1 = await mockIpcMain.invoke('updater:download');
      expect(result1).toEqual({ success: true });

      // Second download (e.g., user clicks again)
      const result2 = await mockIpcMain.invoke('updater:download');
      expect(result2).toEqual({ success: true });

      expect(mockUpdateManager.downloadUpdate).toHaveBeenCalledTimes(2);
    });

    it('should allow download then install workflow', async () => {
      // Download
      const downloadResult = await mockIpcMain.invoke('updater:download');
      expect(downloadResult).toEqual({ success: true });
      expect(mockUpdateManager.downloadUpdate).toHaveBeenCalled();

      // Install
      const installResult = await mockIpcMain.invoke('updater:install');
      expect(installResult).toEqual({ success: true });
      expect(mockUpdateManager.quitAndInstall).toHaveBeenCalled();
    });
  });
});
