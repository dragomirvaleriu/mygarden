import { WorkSession } from '../src/types';

export const calculateTotalDuration = (sessions: WorkSession[] | undefined): number => {
  if (!sessions) return 0;
  return sessions.reduce((total, session) => {
    if (session.start && session.end) {
      const start = session.start.toDate ? session.start.toDate() : new Date(session.start);
      const end = session.end.toDate ? session.end.toDate() : new Date(session.end);
      return total + (end.getTime() - start.getTime()) / (1000 * 60);
    }
    return total;
  }, 0);
};
