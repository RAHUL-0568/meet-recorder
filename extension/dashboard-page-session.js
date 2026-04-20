// Runs in dashboard page context to read NextAuth session cookies.
(async function publishDashboardSession() {
  try {
    const response = await fetch('/api/auth/session', { credentials: 'include' });
    if (!response.ok) return;

    const session = await response.json();
    window.postMessage(
      {
        type: 'meet-recorder-dashboard-session',
        userId: session?.user?.id || null,
        email: session?.user?.email || null,
      },
      window.location.origin
    );
  } catch {
    // Ignore if session is unavailable.
  }
})();
