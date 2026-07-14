// Only one window of this browser should be IN THE WORLD at a time (two share
// the same identity and collide in multiplayer). Called when a window enters the
// world (not on page load — browsing Terms/room-selection in two tabs is fine).
// The NEWEST window to enter wins; any window already in the world is evicted
// (leaves the room). Scoped to this origin via BroadcastChannel (spans iframes).
export function claimWorld(onEvicted: () => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const bc = new BroadcastChannel('strndd-single-world');
  // Timestamp of when THIS window entered the world; a strictly-newer entry wins.
  const birth = Date.now();
  bc.onmessage = (e: MessageEvent) => {
    const data = e.data as { type?: string; birth?: number } | undefined;
    if (data?.type === 'claim' && typeof data.birth === 'number' && data.birth > birth) {
      try {
        onEvicted();
      } finally {
        bc.close();
      }
    }
  };
  // Announce that this window is now the one in the world.
  try {
    bc.postMessage({ type: 'claim', birth });
  } catch {
    /* ignore */
  }
  return () => bc.close();
}
