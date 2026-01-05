import { DatabaseService } from '../../infrastructure/database/database';

/**
 * Create an in-memory database for testing
 * This ensures tests are isolated and don't affect real data
 */
export function createMockDatabase(): DatabaseService {
  const dbService = new DatabaseService(':memory:');
  dbService.initialize();
  return dbService;
}

/**
 * Clean up and close the database after tests
 */
export function cleanupDatabase(db: DatabaseService): void {
  db.close();
}
