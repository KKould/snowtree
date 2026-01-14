import type { CIStatus } from './types';

/**
 * Fetch CI status for a session's PR
 * Returns null if no PR or no checks available
 */
export async function getCIStatus(sessionId: string): Promise<CIStatus | null> {
  if (!window.electronAPI?.sessions?.getCIStatus) {
    return null;
  }

  const result = await window.electronAPI.sessions.getCIStatus(sessionId);
  if (!result.success || !result.data) {
    return null;
  }

  return result.data as CIStatus;
}
