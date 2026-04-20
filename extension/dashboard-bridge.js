// Sync signed-in dashboard user with extension storage.
// CSP-safe: injects an external script file (not inline).
(function syncDashboardSession() {
  const BRIDGE_MESSAGE = 'meet-recorder-dashboard-session';
  const PROBE_SCRIPT_ID = 'meet-recorder-dashboard-probe';

  function injectSessionProbe() {
    const existing = document.getElementById(PROBE_SCRIPT_ID);
    if (existing) existing.remove();

    const script = document.createElement('script');
    script.id = PROBE_SCRIPT_ID;
    script.src = chrome.runtime.getURL('dashboard-page-session.js');
    script.async = true;
    (document.documentElement || document.head || document.body).appendChild(script);
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;
    if (event.data?.type !== BRIDGE_MESSAGE) return;
    if (!event.data?.userId) return;

    chrome.runtime.sendMessage({
      type: 'dashboard-session',
      data: {
        userId: event.data.userId,
        email: event.data.email || null,
      },
    });
  });

  injectSessionProbe();
  setInterval(injectSessionProbe, 30000);
})();
