// Prevent the app from running in more than one window/tab of the same browser.
// (Two windows share the same login + local storage, which collides in the
// World/game.) Uses a BroadcastChannel: a new tab asks if one is already active;
// if so, it shows a blocking overlay instead of starting.

export function guardSingleInstance() {
  return new Promise((resolve) => {
    if (typeof BroadcastChannel === 'undefined') return resolve(true);
    const bc = new BroadcastChannel('ls-single-instance');
    let active = false;
    let decided = false;

    bc.onmessage = (e) => {
      if (e.data === 'ping' && active) {
        bc.postMessage('pong'); // I'm the active window
      } else if (e.data === 'pong' && !decided) {
        decided = true;
        block();
        resolve(false);
      } else if (e.data === 'left' && !active && decided) {
        // The active window closed — reload to take over.
        window.location.reload();
      }
    };

    bc.postMessage('ping');
    // No active window answered within the window -> we become the active one.
    setTimeout(() => {
      if (decided) return;
      decided = true;
      active = true;
      window.addEventListener('pagehide', () => { try { bc.postMessage('left'); } catch { /* closing */ } });
      resolve(true);
    }, 350);

    function block() {
      document.body.innerHTML = '';
      const overlay = document.createElement('div');
      overlay.className = 'single-overlay';
      overlay.innerHTML =
        '<div class="single-card">' +
        '<h1>Already open</h1>' +
        '<p>Language&nbsp;Stats is already open in another window of this browser. ' +
        'Using two at once collides in the World. Switch to that window, or close it and reload here.</p>' +
        '<button id="single-reload" class="btn">Reload this window</button>' +
        '</div>';
      document.body.appendChild(overlay);
      document.getElementById('single-reload').addEventListener('click', () => window.location.reload());
    }
  });
}
