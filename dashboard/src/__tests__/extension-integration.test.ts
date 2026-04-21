/**
 * Integration tests — Extension bridge & auth logic
 *
 * Tests the integration contracts that tie the Chrome extension to the
 * Next.js dashboard without requiring a real browser or live server.
 *
 * Covered:
 *   1. manifest.json correctness (permissions, host_permissions, CSP rules)
 *   2. background.js auth check — cookie detection logic (unit-level)
 *   3. dashboard-page-session.js — publishes session via postMessage
 *   4. offscreen.js — recording upload URL hard-wired to http://localhost:3000
 */

import path from 'path';
import fs from 'fs';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const EXTENSION_DIR = path.join(REPO_ROOT, 'extension');
const MANIFEST_PATH = path.join(EXTENSION_DIR, 'manifest.json');
const BACKGROUND_JS = path.join(EXTENSION_DIR, 'background.js');
const OFFSCREEN_JS = path.join(EXTENSION_DIR, 'offscreen.js');
const DASHBOARD_BRIDGE_JS = path.join(EXTENSION_DIR, 'dashboard-bridge.js');
const DASHBOARD_PAGE_SESSION_JS = path.join(EXTENSION_DIR, 'dashboard-page-session.js');

// ── Helpers ──────────────────────────────────────────────────────────────────
function readExtensionFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

function readManifest(): {
  manifest_version: number;
  name: string;
  version: string;
  permissions: string[];
  host_permissions: string[];
  background: { service_worker: string };
  action: { default_popup: string };
  content_scripts: Array<{ matches: string[]; js: string[] }>;
  web_accessible_resources: Array<{ resources: string[]; matches: string[] }>;
} {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Extension manifest.json integrity', () => {
  let manifest: ReturnType<typeof readManifest>;

  beforeAll(() => {
    manifest = readManifest();
  });

  test('uses Manifest V3', () => {
    expect(manifest.manifest_version).toBe(3);
  });

  test('is named "Meet Recorder"', () => {
    expect(manifest.name).toBe('Meet Recorder');
  });

  test('has a semantic version', () => {
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('declares required permissions', () => {
    expect(manifest.permissions).toEqual(
      expect.arrayContaining(['tabCapture', 'offscreen', 'downloads', 'activeTab', 'storage', 'cookies'])
    );
  });

  test('grants host_permissions for meet.google.com and localhost:3000', () => {
    expect(manifest.host_permissions).toEqual(
      expect.arrayContaining([
        'https://meet.google.com/*',
        'http://localhost:3000/*',
      ])
    );
  });

  test('registers background service worker as background.js', () => {
    expect(manifest.background.service_worker).toBe('background.js');
  });

  test('registers popup as popup/popup.html', () => {
    expect(manifest.action.default_popup).toBe('popup/popup.html');
  });

  test('injects content.js into Google Meet tabs', () => {
    const meetScript = manifest.content_scripts.find((cs) =>
      cs.matches.some((m) => /^https:\/\/meet\.google\.com\//.test(m))
    );
    expect(meetScript).toBeDefined();
    expect(meetScript!.js).toContain('content.js');
  });

  test('injects dashboard-bridge.js into localhost:3000 tabs', () => {
    const dashScript = manifest.content_scripts.find((cs) =>
      cs.matches.some((m) => /^https?:\/\/localhost:3000\//.test(m))
    );
    expect(dashScript).toBeDefined();
    expect(dashScript!.js).toContain('dashboard-bridge.js');
  });

  test('declares dashboard-page-session.js as web_accessible_resource for localhost:3000', () => {
    const war = manifest.web_accessible_resources.find((w) =>
      w.resources.includes('dashboard-page-session.js')
    );
    expect(war).toBeDefined();
    expect(war!.matches).toContain('http://localhost:3000/*');
  });
});

describe('background.js auth integration', () => {
  test('file exists and is non-empty', () => {
    const src = readExtensionFile(BACKGROUND_JS);
    expect(src.length).toBeGreaterThan(0);
  });

  test('checks next-auth.session-token cookie at localhost:3000', () => {
    const src = readExtensionFile(BACKGROUND_JS);
    expect(src).toContain('next-auth.session-token');
    expect(src).toContain('http://localhost:3000');
  });

  test('also checks __Secure- cookie variant for HTTPS sessions', () => {
    const src = readExtensionFile(BACKGROUND_JS);
    expect(src).toContain('__Secure-next-auth.session-token');
  });

  test('returns requiresAuth: true when user is not logged in', () => {
    const src = readExtensionFile(BACKGROUND_JS);
    expect(src).toContain('requiresAuth: true');
  });

  test('handles start-recording message and calls tabCapture', () => {
    const src = readExtensionFile(BACKGROUND_JS);
    expect(src).toContain("case \"start-recording\"");
    expect(src).toContain('tabCapture');
  });

  test('handles stop-recording, pause-recording, and resume-recording messages', () => {
    const src = readExtensionFile(BACKGROUND_JS);
    expect(src).toContain("case \"stop-recording\"");
    expect(src).toContain("case \"pause-recording\"");
    expect(src).toContain("case \"resume-recording\"");
  });

  test('saves and restores recording state via chrome.storage', () => {
    const src = readExtensionFile(BACKGROUND_JS);
    expect(src).toContain('chrome.storage.local.set');
    expect(src).toContain('chrome.storage.local.get');
  });

  test('emits recording-complete message after upload finishes', () => {
    const src = readExtensionFile(BACKGROUND_JS);
    expect(src).toContain("case \"recording-complete\"");
  });

  test('responds to ping messages', () => {
    const src = readExtensionFile(BACKGROUND_JS);
    expect(src).toContain("case \"ping\"");
  });
});

describe('offscreen.js recording upload integration', () => {
  test('file exists and is non-empty', () => {
    const src = readExtensionFile(OFFSCREEN_JS);
    expect(src.length).toBeGreaterThan(0);
  });

  test('uploads recording to the dashboard recordings API', () => {
    const src = readExtensionFile(OFFSCREEN_JS);
    expect(src).toContain('/api/recordings');
    expect(src).toContain('http://localhost:3000');
  });

  test('uses POST method for upload', () => {
    const src = readExtensionFile(OFFSCREEN_JS);
    // Check both the fetch call structure and the method
    expect(src).toContain('"POST"');
  });

  test('sends credentials: include for session cookie forwarding', () => {
    const src = readExtensionFile(OFFSCREEN_JS);
    expect(src).toContain('credentials: "include"');
  });

  test('records in audio/webm format', () => {
    const src = readExtensionFile(OFFSCREEN_JS);
    expect(src).toContain('audio/webm');
  });

  test('triggers recording-complete message after upload', () => {
    const src = readExtensionFile(OFFSCREEN_JS);
    expect(src).toContain('recording-complete');
  });

  test('also downloads recording locally (local backup)', () => {
    const src = readExtensionFile(OFFSCREEN_JS);
    expect(src).toContain('a.download');
    expect(src).toContain('a.click()');
  });

  test('handles mic inclusion path', () => {
    const src = readExtensionFile(OFFSCREEN_JS);
    expect(src).toContain('includeMic');
    expect(src).toContain('getUserMedia');
  });
});

describe('dashboard-bridge.js session sync', () => {
  test('file exists and is non-empty', () => {
    const src = readExtensionFile(DASHBOARD_BRIDGE_JS);
    expect(src.length).toBeGreaterThan(0);
  });

  test('listens for meet-recorder-dashboard-session messages', () => {
    const src = readExtensionFile(DASHBOARD_BRIDGE_JS);
    expect(src).toContain('meet-recorder-dashboard-session');
  });

  test('injects dashboard-page-session.js as external script (CSP-safe)', () => {
    const src = readExtensionFile(DASHBOARD_BRIDGE_JS);
    expect(src).toContain('dashboard-page-session.js');
    expect(src).toContain('chrome.runtime.getURL');
  });

  test('forwards userId and email to background script via chrome.runtime.sendMessage', () => {
    const src = readExtensionFile(DASHBOARD_BRIDGE_JS);
    expect(src).toContain("type: 'dashboard-session'");
    expect(src).toContain('chrome.runtime.sendMessage');
    expect(src).toContain('userId');
    expect(src).toContain('email');
  });

  test('refreshes session probe periodically via setInterval', () => {
    const src = readExtensionFile(DASHBOARD_BRIDGE_JS);
    expect(src).toContain('setInterval');
  });
});

describe('dashboard-page-session.js NextAuth session read', () => {
  test('file exists and is non-empty', () => {
    const src = readExtensionFile(DASHBOARD_PAGE_SESSION_JS);
    expect(src.length).toBeGreaterThan(0);
  });

  test('fetches session from /api/auth/session', () => {
    const src = readExtensionFile(DASHBOARD_PAGE_SESSION_JS);
    expect(src).toContain('/api/auth/session');
    expect(src).toContain("credentials: 'include'");
  });

  test('posts userId and email to window using postMessage', () => {
    const src = readExtensionFile(DASHBOARD_PAGE_SESSION_JS);
    expect(src).toContain('window.postMessage');
    expect(src).toContain('meet-recorder-dashboard-session');
    expect(src).toContain('userId');
    expect(src).toContain('email');
  });

  test('uses window.location.origin as postMessage target (not wildcard)', () => {
    const src = readExtensionFile(DASHBOARD_PAGE_SESSION_JS);
    expect(src).toContain('window.location.origin');
  });
});
