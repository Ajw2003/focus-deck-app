// Sends people who already use Focus Deck straight to the app (docs/4-systems/pwa-shell.md#the-root-page).
// Returning users skip the landing page. "?about" is the escape: it lets them read it anyway.
(function () {
  if (new URLSearchParams(location.search).has('about')) return;
  // key written by app/js/state.js (STORAGE_KEY)
  const DATA_KEY = 'focusdeck-state-v1';
  function isInstalled() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  }
  function hasData() {
    try { return localStorage.getItem(DATA_KEY) !== null; } catch (e) { console.error('forward: localStorage unreadable', e); return false; }
  }
  if (isInstalled() || hasData()) location.replace('app/' + location.search + location.hash);
})();
