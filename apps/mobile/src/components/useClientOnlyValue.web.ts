import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

// `useSyncExternalStore` returns the server snapshot during static rendering and
// hydration, then the client snapshot — so web renders `server` first, `client` after.
export function useClientOnlyValue<S, C>(server: S, client: C): S | C {
  return useSyncExternalStore<S | C>(
    subscribe,
    () => client,
    () => server,
  );
}
