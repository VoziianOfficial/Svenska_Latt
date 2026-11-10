/* Uses app.js DICT/t and data-i18n, including language changes from the profile. */
(() => {
  'use strict';
  const buttons = [...document.querySelectorAll('[data-pwa-install]')];
  const dialog = document.getElementById('pwa-install-dialog');
  const standalone = window.matchMedia('(display-mode: standalone)');
  let deferredPrompt = null;
  let installed = false;
  let prompting = false;
  let opener = null;

  const isInstalled = () => installed || standalone.matches || navigator.standalone === true;
  function syncButtons() {
    buttons.forEach(button => {
      button.hidden = isInstalled();
      button.disabled = prompting;
    });
    if (isInstalled()) {
      deferredPrompt = null;
      if (dialog.open) dialog.close();
    }
  }

  function translateInstructions() {
    dialog.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const embedded = /FBAN|FBAV|Instagram|Telegram|Line\/|MicroMessenger|GSA\//i.test(ua);
    const safari = /Version\/[\d.]+.*Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Android/i.test(ua) && !embedded;
    const platform = ios ? (safari ? 'IOS' : 'IOSBrowser') : /Android/i.test(ua) ? 'Android' : safari ? 'Safari' : 'Desktop';
    dialog.setAttribute('data-platform', platform);
    document.getElementById('pwa-install-step-one').textContent = t(`pwa${platform}One`);
    document.getElementById('pwa-install-step-two').textContent = t(`pwa${platform}Two`);
    buttons.forEach(button => { button.querySelector('[data-i18n]').textContent = t('pwaInstall'); });
  }

  function showInstructions(button) {
    if (isInstalled()) return;
    opener = button;
    translateInstructions();
    if (!dialog.open) dialog.showModal();
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    if (!isInstalled()) deferredPrompt = event;
    syncButtons();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    syncButtons();
  });
  standalone.addEventListener('change', syncButtons);
  window.addEventListener('pageshow', syncButtons);

  buttons.forEach(button => button.addEventListener('click', async () => {
    if (isInstalled() || prompting) return;
    if (!deferredPrompt) { showInstructions(button); return; }
    const event = deferredPrompt;
    deferredPrompt = null; // A prompt event may be used only once, even if it fails.
    prompting = true;
    syncButtons();
    try {
      // Must run within this click's user activation, before any await.
      const result = await event.prompt();
      const choice = event.userChoice ? await event.userChoice : result;
      if (choice?.outcome !== 'accepted' && choice?.outcome !== 'dismissed') showInstructions(button);
      // Acceptance alone is not confirmation; appinstalled/standalone hides the UI.
    } catch (_) {
      showInstructions(button);
    } finally {
      prompting = false;
      syncButtons();
    }
  }));

  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  // Keep the learning screen's keyboard shortcuts out of this modal.
  dialog.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]')]
      .filter(el => !el.disabled && el.getClientRects().length);
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  dialog.addEventListener('close', () => {
    if (opener && !opener.hidden && opener.getClientRects().length) opener.focus();
  });
  new MutationObserver(translateInstructions).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  translateInstructions();
  syncButtons();
})();
