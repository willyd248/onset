import './styles/custom.css';

import { App } from './ui/App.js';
import { supabase } from './auth/supabase.js';
import { AuthManager } from './auth/AuthManager.js';
import { AuthModal } from './auth/AuthModal.js';
import { migrateLocalStorageToCloud } from './auth/migration.js';

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

  // Check for an existing session (also handles the Google OAuth redirect exchange)
  let session = await authManager.getSession();

  if (!session) {
    // Hide app shell while auth is in progress
    const appEl = document.getElementById('app');
    if (appEl) appEl.style.display = 'none';

    // Show sign-in / sign-up screen
    const modal = new AuthModal(authManager);
    await modal.show();
    session = await authManager.getSession();
  }

  if (!session) {
    // Should never reach here, but guard anyway
    console.error('[onset] Auth completed but no session found');
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

// Entry point — DOM is ready since this module is loaded at end of <body>
bootstrap().catch(err => {
  console.error('[onset] Failed to initialize:', err);
});
