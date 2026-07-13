// Groupifier intro splash controller. Plays once per browser session; auto-hides
// after the animation, or on click/tap to skip.
(function () {
  var splash = document.getElementById('intro-splash');
  if (!splash) return;
  if (sessionStorage.getItem('gf_intro_seen')) {
    splash.parentNode && splash.parentNode.removeChild(splash);
    return;
  }
  sessionStorage.setItem('gf_intro_seen', '1');
  var done = false;
  function hide() {
    if (done) return;
    done = true;
    splash.classList.add('intro-hide');
    setTimeout(function () {
      splash.parentNode && splash.parentNode.removeChild(splash);
    }, 700);
  }
  var t = setTimeout(hide, 2400);
  splash.addEventListener('click', function () { clearTimeout(t); hide(); });
})();
