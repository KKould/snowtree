import type { Session, SessionOutput } from '@snowtree/core/types/session';
import type { ToolPanel } from '@snowtree/core/types/panels';

/**
 * Create a test session with sensible defaults
 * Can be overridden with partial session data
 */
export const createTestSession = (overrides?: Partial<Session>): Session => ({
  id: 'test-session-id',
  name: 'Test Session',
  worktreePath: '/tmp/test-worktree',
  prompt: 'Test prompt',
  status: 'ready',
  createdAt: new Date(),
  lastActivity: new Date(),
  output: [],
  jsonMessages: [],
  isRunning: false,
  toolType: 'claude',
  ...overrides,
});

/**
 * Create test session output
 */
export const createTestSessionOutput = (
  overrides?: Partial<SessionOutput>
): SessionOutput => ({
  id: 0,
  session_id: 'test-session-id',
  type: 'stdout',
  data: 'Test output',
  timestamp: new Date().toISOString(),
  ...overrides,
});

/**
 * Create a test panel
 */
export const createTestPanel = (overrides?: Partial<ToolPanel>): ToolPanel => ({
  id: 'test-panel-id',
  sessionId: 'test-session-id',
  type: 'claude',
  title: 'Test Panel',
  state: {
    isActive: false,
  },
  metadata: {
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    position: 0,
    permanent: false,
  },
  ...overrides,
});

/**
 * Create test project data
 */
export const createTestProject = (overrides?: any) => ({
  id: 1,
  name: 'Test Project',
  path: '/tmp/test-project',
  created_at: new Date().toISOString(),
  ...overrides,
});
