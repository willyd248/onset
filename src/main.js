import './styles/custom.css';

import { App } from './ui/App.js';
import { supabase } from './auth/supabase.js';
import { AuthManager } from './auth/AuthManager.js';
import { AuthModal } from './auth/AuthModal.js';
import { migrateLocalStorageToCloud } from './auth/migration.js';

// ── Dev mode (founder bypass) ─────────────────────────────────────────────
// Activate:  ?dev=<VITE_DEV_SECRET>   (persists in localStorage)
// Deactivate: ?dev=off
// Secret is injected at build time via VITE_DEV_SECRET env var — never hard-coded.
const _DEV_SECRET = import.meta.env.VITE_DEV_SECRET ?? '';
const _DEV_KEY = 'onset:dev';

try {
  const _p = new URLSearchParams(window.location.search);
  if (_p.get('dev') === _DEV_SECRET) {
    localStorage.setItem(_DEV_KEY, '1');
    _p.delete('dev');
    const _c = _p.toString();
    window.history.replaceState({}, '', window.location.pathname + (_c ? `?${_c}` : ''));
  } else if (_p.get('dev') === 'off') {
    localStorage.removeItem(_DEV_KEY);
    _p.delete('dev');
    const _c = _p.toString();
    window.history.replaceState({}, '', window.location.pathname + (_c ? `?${_c}` : ''));
  }
} catch { /* ignore */ }

/** True when founder dev bypass is active. Checked throughout the app. */
export const isDevMode = localStorage.getItem(_DEV_KEY) === '1';

if (isDevMode) {
  window.__ONSET_DEV__ = true;
}

/**
 * Bootstrap the app:
 *  1. Check for an existing Supabase session (or run OAuth redirect exchange)
 *  2. If no session, show sign-in / sign-up screen
 *  3. Migrate any localStorage data to cloud on first sign-in
 *  4. Initialize the main App and enable cloud sync
 *
 * Falls back to the original localStorage-only / email-gate flow when
 * Supabase env vars are not configured (development without a project, etc.)
 */
async function bootstrap() {
  // ── Dev mode: skip all auth gates, run as founder ──────────────────────────
  if (isDevMode) {
    const appEl = document.getElementById('app');
    if (appEl) appEl.style.display = '';
    const app = new App();
    await app.init();
    _injectDevBadge();
    return;
  }

  // ── No Supabase configured → legacy localStorage + email gate ─────────────
  if (!supabase) {
    const ACCESS_KEY = 'onset:access';
    const LANDING_URL = 'https://onsetdj.com';

    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('access') === '1') {
        localStorage.setItem(ACCESS_KEY, '1');
        params.delete('access');
        const clean = params.toString();
        window.history.replaceState({}, '', window.location.pathname + (clean ? `?${clean}` : ''));
      }
    } catch { /* ignore */ }

    if (localStorage.getItem(ACCESS_KEY) !== '1') {
      window.location.href = LANDING_URL;
      return;
    }

    const appEl = document.getElementById('app');
    if (appEl) appEl.style.display = '';
    const app = new App();
    await app.init();
    return;
  }

  // ── Supabase available — real auth flow ────────────────────────────────────
  const authManager = new AuthManager();

  let session;
  try {
    // Check for an existing session (also handles the Google OAuth redirect exchange)
    session = await authManager.getSession();

    if (!session) {
      // Hide app shell while auth is in progress
      const appEl = document.getElementById('app');
      if (appEl) appEl.style.display = 'none';

      // Show sign-in / sign-up screen
      const modal = new AuthModal(authManager);
      await modal.show();
      session = await authManager.getSession();
    }
  } catch (err) {
    _showAuthError(err, bootstrap);
    return;
  }

  if (!session) {
    // Modal closed without a valid session — show error with retry
    _showAuthError(new Error('Sign-in did not complete. Please try again.'), bootstrap);
    return;
  }

  // Show the app shell
  const appEl = document.getElementById('app');
  if (appEl) appEl.style.display = '';

  // One-time migration: copy localStorage data to cloud if cloud is empty
  await migrateLocalStorageToCloud(supabase, session.user.id);

  // Initialize app
  const app = new App();
  await app.init();

  // Enable cloud sync on all persistence layers
  await app.setCloudSync(supabase, session.user);

  // Wire up logout button (injected into profile view by index.html)
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => app.signOut(authManager));
  }

  // Handle auth state changes: token auto-refresh is handled by Supabase SDK.
  // On sign-out (from another tab, token expiry, etc.), reload to show auth screen.
  authManager.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      window.location.reload();
    }
  });
}

/** Small persistent badge so you always know dev mode is on. */
function _injectDevBadge() {
  const badge = document.createElement('div');
  badge.id = 'onset-dev-badge';
  badge.title = 'Dev mode active — ?dev=off to exit';
  badge.textContent = 'DEV';
  badge.style.cssText = [
    'position:fixed',
    'bottom:12px',
    'right:12px',
    'z-index:9999',
    'background:#2a6900',
    'color:#fff',
    'font:700 10px/1 monospace',
    'padding:3px 6px',
    'border-radius:4px',
    'opacity:0.7',
    'pointer-events:none',
    'user-select:none',
  ].join(';');
  document.body.appendChild(badge);
}

/** Show an auth error with a retry button so the user never sees a blank screen. */
function _showAuthError(err, retryFn) {
  const existing = document.getElementById('auth-error-screen');
  if (existing) existing.remove();

  const screen = document.createElement('div');
  screen.id = 'auth-error-screen';
  screen.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:9990',
    'display:flex', 'flex-direction:column', 'align-items:center', 'justify-content:center',
    'background:#f6f6f6', 'gap:16px', 'padding:24px', 'text-align:center',
  ].join(';');

  const icon = document.createElement('span');
  icon.className = 'material-symbols-outlined';
  icon.style.cssText = 'font-size:48px;color:#b02500';
  icon.textContent = 'wifi_off';

  const title = document.createElement('p');
  title.style.cssText = 'font:700 18px/1.3 "Plus Jakarta Sans",sans-serif;color:#2d2f2f;max-width:320px';
  title.textContent = 'Could not connect to sign-in service';

  const detail = document.createElement('p');
  detail.style.cssText = 'font:400 14px/1.5 "Plus Jakarta Sans",sans-serif;color:#5a5c5c;max-width:320px';
  detail.textContent = err?.message || 'Check your internet connection and try again.';

  const btn = document.createElement('button');
  btn.style.cssText = [
    'margin-top:8px', 'padding:12px 32px',
    'background:#2a6900', 'color:#fff',
    'border:none', 'border-radius:9999px',
    'font:700 14px "Plus Jakarta Sans",sans-serif',
    'cursor:pointer',
  ].join(';');
  btn.textContent = 'Retry';
  btn.addEventListener('click', () => {
    screen.remove();
    retryFn();
  });

  screen.append(icon, title, detail, btn);
  document.body.appendChild(screen);
}

// Entry point — DOM is ready since this module is loaded at end of <body>
bootstrap().catch(err => {
  _showAuthError(err, bootstrap);
});
