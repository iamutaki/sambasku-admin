import { useSyncExternalStore } from 'react';
import { sessionStore } from './session';

/** Hook reaktif ke session store (in-memory). Konsumsi di layout & komponen. */
export function useAuth() {
  const state = useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot, sessionStore.getSnapshot);

  return {
    isAuthenticated: state.accessToken !== null,
    accessToken: state.accessToken,
    user: state.user,
  };
}