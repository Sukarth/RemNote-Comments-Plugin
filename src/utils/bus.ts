type Handler = (payload?: any) => void;

/**
 * Creates a cross-tab communication bus using either BroadcastChannel (if supported)
 * or localStorage events as a fallback. Allows subscribing to, emitting, and unsubscribing
 * from custom event types across browser tabs/windows.
 *
 * @param channelName - The name of the communication channel. Defaults to 'remnote-comments-bus'.
 * @returns An object with methods:
 *   - `on(type, fn)`: Subscribe to an event type.
 *   - `off(type, fn)`: Unsubscribe from an event type.
 *   - `emit(type, payload)`: Emit an event with optional payload.
 *   - `close()`: Clean up resources and listeners.
 *
 * @example
 * ```typescript
 * const bus = createBus('my-channel');
 * bus.on('message', (payload) => console.log(payload));
 * bus.emit('message', { text: 'Hello!' });
 * bus.close();
 * ```
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel BroadcastChannel}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event StorageEvent}
 */
export function createBus(channelName = 'remnote-comments-bus') {
  const supportsBC = typeof (window as any).BroadcastChannel !== 'undefined';
  const handlers = new Map<string, Set<Handler>>();
  const genId = () => Math.random().toString(36).slice(2);

  if (supportsBC) {
    const bc = new BroadcastChannel(channelName);
    bc.onmessage = (ev) => {
      const { type, payload } = ev.data || {};
      const set = handlers.get(type);
      if (set) for (const h of set) h(payload);
    };
    return {
      on(type: string, fn: Handler) {
        if (!handlers.has(type)) handlers.set(type, new Set());
        handlers.get(type)!.add(fn);
      },
      off(type: string, fn: Handler) {
        handlers.get(type)?.delete(fn);
      },
      emit(type: string, payload?: any) {
        bc.postMessage({ type, payload });
      },
      close() { bc.close(); },
    };
  }

  // Fallback using localStorage "storage" event
  const key = `__${channelName}`;
  const listener = (e: StorageEvent) => {
    if (e.key !== key || !e.newValue) return;
    try {
      const msg = JSON.parse(e.newValue);
      const set = handlers.get(msg.type);
      if (set) for (const h of set) h(msg.payload);
    } catch {}
  };
  window.addEventListener('storage', listener);

  return {
    on(type: string, fn: Handler) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type)!.add(fn);
    },
    off(type: string, fn: Handler) {
      handlers.get(type)?.delete(fn);
    },
    emit(type: string, payload?: any) {
      const msg = JSON.stringify({ id: genId(), type, payload, t: Date.now() });
      localStorage.setItem(key, msg);
      // remove to reduce clutter and retrigger future events
      setTimeout(() => localStorage.removeItem(key), 0);
    },
    close() {
      window.removeEventListener('storage', listener);
    },
  };
}