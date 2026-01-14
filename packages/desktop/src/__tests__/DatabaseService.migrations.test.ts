import { randomUUID } from 'node:crypto';
import { cleanupDatabase, createMockDatabase } from './helpers/mockDatabase';

describe('DatabaseService migrations', () => {
  it('ensures sessions has status_message and run_started_at', () => {
    const db = createMockDatabase();
    try {
      const project = db.createProject('Test Project', `/tmp/snowtree-test-${randomUUID()}`);
      const sessionId = randomUUID();

      db.createSession({
        id: sessionId,
        name: 'Test Session',
        initial_prompt: '',
        worktree_name: 'test-worktree',
        worktree_path: '/tmp',
        project_id: project.id,
      });

      expect(() => db.updateSession(sessionId, { status_message: 'hello' })).not.toThrow();
      expect(db.getSession(sessionId)?.status_message).toBe('hello');

      expect(() => db.updateSession(sessionId, { run_started_at: 'CURRENT_TIMESTAMP' })).not.toThrow();
      expect(db.getSession(sessionId)?.run_started_at).toBeTruthy();
    } finally {
      cleanupDatabase(db);
    }
  });
});

