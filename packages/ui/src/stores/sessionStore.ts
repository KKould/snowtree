import { create } from 'zustand';
import type { GitStatus, Session } from '../types/session';

interface SessionStore {
  sessions: Session[];
  activeSessionId: string | null;
  gitStatusLoading: Set<string>;
  isLoaded: boolean;

  loadSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  updateSession: (session: Session) => void;
  deleteSession: (session: { id: string }) => void;
  setActiveSession: (sessionId: string | null) => void;
  updateSessionGitStatus: (sessionId: string, gitStatus: GitStatus) => void;
  setGitStatusLoading: (sessionId: string, loading: boolean) => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  gitStatusLoading: new Set(),
  isLoaded: false,

  loadSessions: (sessions) => set({ sessions, isLoaded: true }),

  addSession: (session) => set((state) => ({
    sessions: [session, ...state.sessions],
    activeSessionId: session.id
  })),

  updateSession: (updated) => set((state) => ({
    sessions: state.sessions.map((s) => (s.id === updated.id ? { ...s, ...updated } : s))
  })),

  deleteSession: (deleted) => set((state) => ({
    sessions: state.sessions.filter((s) => s.id !== deleted.id),
    activeSessionId: state.activeSessionId === deleted.id ? null : state.activeSessionId
  })),

  setActiveSession: (sessionId) => {
    set({ activeSessionId: sessionId });
    void window.electronAPI?.invoke('sessions:set-active-session', sessionId);
  },

  updateSessionGitStatus: (sessionId, gitStatus) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, gitStatus } : s))
    })),

  setGitStatusLoading: (sessionId, loading) => {
    const next = new Set(get().gitStatusLoading);
    if (loading) next.add(sessionId);
    else next.delete(sessionId);
    set({ gitStatusLoading: next });
  }
}));

