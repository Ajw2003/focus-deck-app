// Landing page behaviour: install button and per-device instructions.
// Background: docs/4-systems/pwa-shell.md#the-root-page
(function () {
  const btn = document.getElementById('install-btn');
  const note = document.getElementById('install-note');
  const tabs = Array.from(document.querySelectorAll('#install-tabs [role=tab]'));
  let deferredPrompt = null;

  function detectDevice() {
    const ua = navigator.userAgent || '';
    // iPadOS Safari reports a Mac UA, so touch support is the tell.
    const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
    if (/iPhone|iPad|iPod/.test(ua) || iPadOS) return 'ios';
    if (/Android/.test(ua)) return 'android';
    if (/Firefox\/|OPR\/|Opera/.test(ua)) return 'other';
    return 'desktop';
  }

  function selectTab(tab, focus) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectTab(tab, false));
    tab.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      let next = null;
      if (step) next = tabs[(i + step + tabs.length) % tabs.length];
      else if (e.key === 'Home') next = tabs[0];
      else if (e.key === 'End') next = tabs[tabs.length - 1];
      if (next) { e.preventDefault(); selectTab(next, true); }
    });
  });
  const device = detectDevice();
  selectTab(tabs.find((t) => t.dataset.device === device) || tabs[0], false);
  document.documentElement.dataset.device = device;

  function showInstructions() {
    const target = document.getElementById('install-title');
    target.scrollIntoView({ block: 'start' });
    target.focus({ preventScroll: true });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    btn.hidden = true;
    note.textContent = 'Focus Deck is installed. Look for it on your home screen or in your apps.';
  });

  btn.addEventListener('click', async () => {
    if (!deferredPrompt) { showInstructions(); return; }
    const p = deferredPrompt;
    deferredPrompt = null; // a prompt event can only be used once
    try {
      await p.prompt();
      const choice = await p.userChoice;
      if (choice.outcome !== 'accepted') note.textContent = 'No problem. You can install any time from the steps above.';
    } catch (err) {
      console.error('install: prompt() failed', err);
      showInstructions();
    }
  });
})();
