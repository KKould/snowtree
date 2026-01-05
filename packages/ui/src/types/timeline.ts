export type TimelineEventKind =
  | 'chat.user'
  | 'chat.assistant'
  | 'cli.command'
  | 'git.command'
  | 'worktree.command';

export type TimelineEventStatus = 'started' | 'finished' | 'failed';

export interface TimelineEvent {
  id: number;
  session_id: string;
  seq: number;
  timestamp: string;
  kind: TimelineEventKind;
  status?: TimelineEventStatus;
  command?: string;
  cwd?: string;
  duration_ms?: number;
  exit_code?: number;
  panel_id?: string;
  tool?: string;
  meta?: Record<string, unknown>;
}
