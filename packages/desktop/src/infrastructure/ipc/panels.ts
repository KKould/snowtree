import type { IpcMain } from 'electron';
import { panelManager } from '../../features/panels/PanelManager';
import type { CreatePanelRequest } from '@snowtree/core/types/panels';

export function registerPanelHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('panels:create', async (_event, request: CreatePanelRequest) => {
    try {
      const panel = await panelManager.createPanel(request);
      return { success: true, data: panel };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create panel' };
    }
  });

  ipcMain.handle('panels:list', async (_event, sessionId: string) => {
    try {
      const panels = panelManager.getPanelsForSession(sessionId);
      return { success: true, data: panels };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list panels' };
    }
  });
}
