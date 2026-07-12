// Prevent the world from running in more than one context of the same browser
// (a second tab, or the language-stats World iframe + a standalone tab). Two
// sessions share the same identity/storage and collide in multiplayer.
// Scoped to this origin via BroadcastChannel, so it also spans iframes.
export function guardSingleWorld(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof BroadcastChannel === "undefined") return resolve(true);
    const bc = new BroadcastChannel("strndd-single-world");
    let active = false;
    let decided = false;

    bc.onmessage = (e) => {
      if (e.data === "ping" && active) {
        bc.postMessage("pong");
      } else if (e.data === "pong" && !decided) {
        decided = true;
        resolve(false);
      } else if (e.data === "left" && !active && decided) {
        window.location.reload();
      }
    };

    bc.postMessage("ping");
    setTimeout(() => {
      if (decided) return;
      decided = true;
      active = true;
      window.addEventListener("pagehide", () => {
        try {
          bc.postMessage("left");
        } catch {
          /* closing */
        }
      });
      resolve(true);
    }, 350);
  });
}
