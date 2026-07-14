// Prevent the world from running in more than one context of the same browser
// (a second tab, or the language-stats World iframe + a standalone tab). Two
// sessions share the same identity/storage and collide in multiplayer.
// Scoped to this origin via BroadcastChannel, so it also spans iframes.
//
// The window that loses the race gets `takeOver()`: calling it claims the world
// for THIS window and makes the other window yield (it reloads into the blocked
// screen), so the user can pick whichever window they prefer.
export interface WorldGuard {
  active: boolean;
  takeOver?: () => void;
}

const CLAIM_KEY = "sw-claim";

export function guardSingleWorld(): Promise<WorldGuard> {
  return new Promise((resolve) => {
    if (typeof BroadcastChannel === "undefined") return resolve({ active: true });
    const bc = new BroadcastChannel("strndd-single-world");
    let active = false;
    let decided = false;

    const becomeActive = () => {
      active = true;
      window.addEventListener("pagehide", () => {
        try {
          bc.postMessage("left");
        } catch {
          /* closing */
        }
      });
    };

    bc.onmessage = (e) => {
      if (e.data === "ping" && active) {
        bc.postMessage("pong");
      } else if (e.data === "pong" && !decided) {
        decided = true;
        resolve({
          active: false,
          // Claim the world for this window: flag ourselves to win the reload
          // race, tell the current active window to yield, then reload.
          takeOver: () => {
            try {
              sessionStorage.setItem(CLAIM_KEY, "1");
            } catch {
              /* ignore */
            }
            try {
              bc.postMessage("takeover");
            } catch {
              /* ignore */
            }
            window.location.reload();
          },
        });
      } else if (e.data === "left" && !active && decided) {
        window.location.reload();
      } else if (e.data === "takeover" && active) {
        // Another window claimed the world — yield by reloading into the
        // blocked screen (it will pong us and we become the inactive one).
        active = false;
        window.location.reload();
      }
    };

    // Fast path: this load came from a takeOver() click — grab the world now so
    // we win the race against the yielding window's reload.
    let claimed = false;
    try {
      claimed = sessionStorage.getItem(CLAIM_KEY) === "1";
      if (claimed) sessionStorage.removeItem(CLAIM_KEY);
    } catch {
      /* ignore */
    }
    if (claimed) {
      decided = true;
      becomeActive();
      resolve({ active: true });
      return;
    }

    bc.postMessage("ping");
    setTimeout(() => {
      if (decided) return;
      decided = true;
      becomeActive();
      resolve({ active: true });
    }, 350);
  });
}
