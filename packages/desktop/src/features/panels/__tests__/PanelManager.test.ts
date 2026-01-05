import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PanelManager } from '../PanelManager';
import { createTestPanel } from '../../../__tests__/helpers/testFixtures';
import type { DatabaseService } from '../../../infrastructure/database/database';

vi.mock('../../../infrastructure/database', () => {
  const panels: Map<string, any> = new Map();

  const mockDb = {
    _panels: panels,
    getAllPanels: vi.fn(() => Array.from(panels.values())),
    getPanel: vi.fn((id: string) => panels.get(id)),
    createPanel: vi.fn((data: any) => {
      const panel = {
        id: data.id || 'test-panel-id',
        sessionId: data.sessionId,
        type: data.type,
        title: data.title,
        state: data.state || { isActive: false, hasBeenViewed: false, customState: {} },
        metadata: data.metadata || {
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          position: 0
        }
      };
      panels.set(panel.id, panel);
      return panel;
    }),
    createPanelAndSetActive: vi.fn((data: any) => {
      const panel = {
        id: data.id || 'test-panel-id',
        sessionId: data.sessionId,
        type: data.type,
        title: data.title,
        state: data.state ? { ...data.state, isActive: true } : { isActive: true, hasBeenViewed: false, customState: {} },
        metadata: data.metadata || {
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          position: 0
        }
      };
      Array.from(panels.values())
        .filter(p => p.sessionId === data.sessionId && p.id !== panel.id)
        .forEach(p => {
          p.state.isActive = false;
          panels.set(p.id, p);
        });
      panels.set(panel.id, panel);
      return panel;
    }),
    updatePanel: vi.fn((id: string, updates: any) => {
      const panel = panels.get(id);
      if (panel) {
        Object.assign(panel, updates);
      }
    }),
    deletePanel: vi.fn((id: string) => {
      panels.delete(id);
    }),
    getPanelsForSession: vi.fn((sessionId: string) => {
      return Array.from(panels.values()).filter(p => p.sessionId === sessionId);
    }),
    setActivePanel: vi.fn((sessionId: string, panelId: string | null) => {
      Array.from(panels.values())
        .filter(p => p.sessionId === sessionId)
        .forEach(p => {
          p.state.isActive = p.id === panelId;
          if (p.state.isActive) {
            p.metadata.lastActiveAt = new Date().toISOString();
          }
          panels.set(p.id, p);
        });
    }),
    getActivePanel: vi.fn((sessionId: string) => {
      return Array.from(panels.values()).find(p => p.sessionId === sessionId && p.state.isActive);
    }),
    deletePanelsForSession: vi.fn((sessionId: string) => {
      Array.from(panels.values())
        .filter(p => p.sessionId === sessionId)
        .forEach(p => panels.delete(p.id));
    }),
    _resetMock: () => panels.clear(),
  };

  return {
    databaseService: mockDb,
    DatabaseService: vi.fn(),
  };
});

import { databaseService } from '../../../infrastructure/database';

describe('PanelManager', () => {
  let panelManager: PanelManager;

  beforeEach(() => {
    vi.clearAllMocks();
    (databaseService as any)._resetMock();
    (databaseService.getAllPanels as any).mockReturnValue([]);
    panelManager = new PanelManager();
  });

  describe('initialize', () => {
    it('should load panels from database', () => {
      const panel = {
        id: 'init-panel-1',
        sessionId: 'test-session',
        type: 'claude' as const,
        title: 'Test Panel',
        state: {
          isActive: true,
          hasBeenViewed: false,
          customState: {},
        },
        metadata: {
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          position: 0,
        },
      };

      (databaseService as any)._panels.set('init-panel-1', panel);
      (databaseService.getAllPanels as any).mockReturnValue([panel]);

      const newPanelManager = new PanelManager();
      newPanelManager.initialize();

      const retrieved = newPanelManager.getPanel(panel.id);
      expect(retrieved).toBeDefined();

      (databaseService as any)._panels.delete('init-panel-1');
    });

    it('should reset stale running states', () => {
      const panel = {
        id: 'stale-panel-1',
        sessionId: 'test-session',
        type: 'logs' as const,
        title: 'Test Logs',
        state: {
          isActive: true,
          hasBeenViewed: false,
          customState: {
            isRunning: true,
            processId: 12345,
          },
        },
        metadata: {
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          position: 0,
        },
      };

      (databaseService as any)._panels.set('stale-panel-1', panel);
      (databaseService.getAllPanels as any).mockReturnValue([panel]);

      const newPanelManager = new PanelManager();
      newPanelManager.initialize();

      expect(databaseService.updatePanel).toHaveBeenCalled();
      const retrieved = newPanelManager.getPanel(panel.id);
      expect(retrieved.state?.customState?.isRunning).toBe(false);

      (databaseService as any)._panels.delete('stale-panel-1');
    });
  });

  describe('createPanel', () => {
    beforeEach(() => {
      panelManager.initialize();
    });

    it('should create panel with generated ID', async () => {
      const panel = await panelManager.createPanel({
        sessionId: 'test-session',
        type: 'claude',
        title: 'Test Panel',
      });

      expect(panel.id).toBeDefined();
      expect(panel.id).toMatch(/^[a-f0-9-]{36}$/);
    });

    it('should set panel as active by default', async () => {
      const panel = await panelManager.createPanel({
        sessionId: 'test-session',
        type: 'claude',
        title: 'Test Panel',
      });

      expect(panel.state.isActive).toBe(true);
    });

    it('should generate auto title when not provided', async () => {
      const panel = await panelManager.createPanel({
        sessionId: 'test-session',
        type: 'claude',
      });

      expect(panel.title).toContain('Claude');
    });

    it('should use custom title when provided', async () => {
      const panel = await panelManager.createPanel({
        sessionId: 'test-session',
        type: 'claude',
        title: 'Custom Panel',
      });

      expect(panel.title).toBe('Custom Panel');
    });

    it('should deactivate other panels in same session', async () => {
      const first = await panelManager.createPanel({
        sessionId: 'test-session',
        type: 'claude',
        title: 'First Panel',
      });

      const second = await panelManager.createPanel({
        sessionId: 'test-session',
        type: 'claude',
        title: 'Second Panel',
      });

      const updated = panelManager.getPanel(first.id);
      expect(updated.state.isActive).toBe(false);
      expect(second.state.isActive).toBe(true);
    });

    it('should set creation timestamp', async () => {
      const before = new Date();
      const panel = await panelManager.createPanel({
        sessionId: 'test-session',
        type: 'claude',
        title: 'Test',
      });
      const after = new Date();

      const createdAt = new Date(panel.metadata.createdAt);
      expect(createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('getPanel', () => {
    beforeEach(() => {
      panelManager.initialize();
    });

    it('should retrieve created panel', async () => {
      const created = await panelManager.createPanel({
        sessionId: 'test-session',
        type: 'claude',
        title: 'Test',
      });

      const retrieved = panelManager.getPanel(created.id);

      expect(retrieved.id).toBe(created.id);
      expect(retrieved.title).toBe('Test');
    });

    it('should return undefined for non-existent panel', () => {
      const panel = panelManager.getPanel('non-existent');
      expect(panel).toBeUndefined();
    });

    it('should parse JSON state correctly', async () => {
      const panel = await panelManager.createPanel({
        sessionId: 'test-session',
        type: 'claude',
        title: 'Test',
      });

      await panelManager.updatePanel(panel.id, {
        state: {
          customState: { key: 'value' },
        },
      });

      const retrieved = panelManager.getPanel(panel.id);
      expect(retrieved.state?.customState).toEqual({ key: 'value' });
    });

    it('should handle invalid JSON state gracefully', () => {
      const invalidJsonPanel = {
        id: 'invalid-json-panel',
        sessionId: 'test-session',
        type: 'claude' as const,
        title: 'Test',
        state: 'invalid-json' as any,
        metadata: {
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          position: 0
        }
      };

      (databaseService as any)._panels.set('invalid-json-panel', invalidJsonPanel);
      (databaseService.getAllPanels as any).mockReturnValue([invalidJsonPanel]);

      panelManager.initialize();
      const retrieved = panelManager.getPanel('invalid-json-panel');
      expect(retrieved.state).toEqual({ isActive: false, hasBeenViewed: false, customState: {} });

      (databaseService as any)._panels.delete('invalid-json-panel');
    });
  });

  describe('getPanelsForSession', () => {
    beforeEach(() => {
      panelManager.initialize();
    });

    it('should return panels for specific session', async () => {
      await panelManager.createPanel({
        sessionId: 'session-1',
        type: 'claude',
        title: 'Panel 1',
      });

      await panelManager.createPanel({
        sessionId: 'session-2',
        type: 'claude',
        title: 'Panel 2',
      });

      const panels = panelManager.getPanelsForSession('session-1');

      expect(panels).toHaveLength(1);
      expect(panels[0].sessionId).toBe('session-1');
    });

    it('should return empty array for session with no panels', () => {
      const panels = panelManager.getPanelsForSession('non-existent');
      expect(panels).toEqual([]);
    });

    it('should return all panels for session', async () => {
      await panelManager.createPanel({
        sessionId: 'test-session',
        type: 'claude',
        title: 'Panel 1',
      });

      await panelManager.createPanel({
        sessionId: 'test-session',
        type: 'logs',
        title: 'Panel 2',
      });

      const panels = panelManager.getPanelsForSession('test-session');
      expect(panels).toHaveLength(2);
    });
  });

  describe('updatePanel', () => {
    beforeEach(() => {
      panelManager.initialize();
    });

    it('should update panel properties', async () => {
      const panel = await panelManager.createPanel({
        sessionId: 'test-session',
        type: 'claude',
        title: 'Original Title',
      });

      await panelManager.updatePanel(panel.id, {
        title: 'Updated Title',
      });

      const updated = panelManager.getPanel(panel.id);
      expect(updated.title).toBe('Updated Title');
    });

    it('should update panel state', async () => {
      const panel = await panelManager.createPanel({
        sessionId: 'test-session',
        type: 'claude',
        title: 'Test',
      });

      await panelManager.updatePanel(panel.id, {
        state: {
          customState: { status: 'running' },
        },
      });

      const updated = panelManager.getPanel(panel.id);
      expect(updated.state?.customState?.status).toBe('running');
    });

    it('should update metadata', async () => {
      const panel = await panelManager.createPanel({
        sessionId: 'test-session',
        type: 'claude',
        title: 'Test',
      });

      await panelManager.updatePanel(panel.id, {
        metadata: { model: 'claude-3-opus' },
      });

      const updated = panelManager.getPanel(panel.id);
      expect(updated.metadata?.model).toBe('claude-3-opus');
    });
  });

  describe('deletePanel', () => {
    beforeEach(() => {
      panelManager.initialize();
    });

    it('should delete panel from cache and database', async () => {
      const panel = await panelManager.createPanel({
        sessionId: 'test-session',
        type: 'claude',
        title: 'Test',
      });

      const panelId = panel.id;
      await panelManager.deletePanel(panelId);

      expect(databaseService.deletePanel).toHaveBeenCalledWith(panelId);
      const retrieved = panelManager.getPanel(panelId);
      expect(retrieved).toBeUndefined();
    });

    it('should not delete permanent panel', async () => {
      const panel = await panelManager.createPanel({
        sessionId: 'test-session',
        type: 'claude',
        title: 'Test',
      });

      await panelManager.updatePanel(panel.id, {
        metadata: { ...panel.metadata, permanent: true }
      });

      await panelManager.deletePanel(panel.id);

      expect(panelManager.getPanel(panel.id)).toBeDefined();
    });

    it('should activate another panel when deleting active panel', async () => {
      const first = await panelManager.createPanel({
        sessionId: 'test-session',
        type: 'claude',
        title: 'First',
      });

      const second = await panelManager.createPanel({
        sessionId: 'test-session',
        type: 'logs',
        title: 'Second',
      });

      await panelManager.deletePanel(second.id);

      const updated = panelManager.getPanel(first.id);
      expect(updated.state.isActive).toBe(true);
    });
  });

  describe('setActivePanel', () => {
    beforeEach(() => {
      panelManager.initialize();
    });

    it('should activate specified panel', async () => {
      const first = await panelManager.createPanel({
        sessionId: 'test-session',
        type: 'claude',
        title: 'First',
      });

      const second = await panelManager.createPanel({
        sessionId: 'test-session',
        type: 'logs',
        title: 'Second',
      });

      await panelManager.setActivePanel('test-session', first.id);

      expect(panelManager.getPanel(first.id).state.isActive).toBe(true);
      expect(panelManager.getPanel(second.id).state.isActive).toBe(false);
    });

    it('should deactivate other panels in same session', async () => {
      const first = await panelManager.createPanel({
        sessionId: 'test-session',
        type: 'claude',
        title: 'First',
      });

      const second = await panelManager.createPanel({
        sessionId: 'test-session',
        type: 'logs',
        title: 'Second',
      });

      const third = await panelManager.createPanel({
        sessionId: 'test-session',
        type: 'claude',
        title: 'Third',
      });

      await panelManager.setActivePanel('test-session', first.id);

      expect(panelManager.getPanel(first.id).state.isActive).toBe(true);
      expect(panelManager.getPanel(second.id).state.isActive).toBe(false);
      expect(panelManager.getPanel(third.id).state.isActive).toBe(false);
    });

    it('should not affect panels in other sessions', async () => {
      const session1Panel = await panelManager.createPanel({
        sessionId: 'session-1',
        type: 'claude',
        title: 'Session 1',
      });

      const session2Panel = await panelManager.createPanel({
        sessionId: 'session-2',
        type: 'claude',
        title: 'Session 2',
      });

      await panelManager.setActivePanel('session-1', session1Panel.id);

      expect(panelManager.getPanel(session1Panel.id).state.isActive).toBe(true);
      expect(panelManager.getPanel(session2Panel.id).state.isActive).toBe(true);
    });
  });

  describe('cleanupSessionPanels', () => {
    beforeEach(() => {
      panelManager.initialize();
    });

    it('should delete all panels for session', async () => {
      await panelManager.createPanel({
        sessionId: 'test-session',
        type: 'claude',
        title: 'Panel 1',
      });

      await panelManager.createPanel({
        sessionId: 'test-session',
        type: 'logs',
        title: 'Panel 2',
      });

      await panelManager.cleanupSessionPanels('test-session');

      const panels = panelManager.getPanelsForSession('test-session');
      expect(panels).toHaveLength(0);
    });

    it('should not affect panels in other sessions', async () => {
      await panelManager.createPanel({
        sessionId: 'session-1',
        type: 'claude',
        title: 'Session 1 Panel',
      });

      await panelManager.createPanel({
        sessionId: 'session-2',
        type: 'claude',
        title: 'Session 2 Panel',
      });

      await panelManager.cleanupSessionPanels('session-1');

      const session2Panels = panelManager.getPanelsForSession('session-2');
      expect(session2Panels).toHaveLength(1);
    });

    it('should remove panels from cache', async () => {
      const panel = await panelManager.createPanel({
        sessionId: 'test-session',
        type: 'claude',
        title: 'Test',
      });

      const panelId = panel.id;
      await panelManager.cleanupSessionPanels('test-session');

      const retrieved = panelManager.getPanel(panelId);
      expect(retrieved).toBeUndefined();
    });
  });
});
