/**
 * AuthModal — full-page sign-in / sign-up screen shown before the app loads.
 * Matches the Onset design system (Material Design 3, Plus Jakarta Sans).
 */
export class AuthModal {
  /**
   * @param {import('./AuthManager.js').AuthManager} authManager
   */
  constructor(authManager) {
    this._auth = authManager;
    /** @type {HTMLElement | null} */
    this._el = null;
    /** @type {'signin' | 'signup'} */
    this._mode = 'signin';
    /** @type {((result: { user: any }) => void) | null} */
    this._resolve = null;
  }

  /**
   * Show the modal and resolve when the user authenticates.
   * @returns {Promise<{ user: any }>}
   */
  show() {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this._render();
    });
  }

  hide() {
    if (this._el) {
      this._el.remove();
      this._el = null;
    }
  }

  // ── Rendering ─────────────────────────────────────────────────

  _render() {
    const el = document.createElement('div');
    el.id = 'auth-modal';
    el.innerHTML = this._getHTML();
    document.body.appendChild(el);
    this._el = el;
    this._bind();
  }

  _getHTML() {
    const isSignUp = this._mode === 'signup';
    return `
<div style="
  position:fixed; inset:0; z-index:9999;
  display:flex; align-items:center; justify-content:center;
  background:#f6f6f6; font-family:'Plus Jakarta Sans', sans-serif;
  padding:16px;
">
  <div style="width:100%; max-width:400px;">

    <!-- Logo -->
    <div style="text-align:center; margin-bottom:32px;">
      <div style="display:inline-flex; align-items:center; gap:10px; margin-bottom:6px;">
        <img src="/logo.svg" alt="onset" style="height:32px; width:32px;" onerror="this.style.display='none'">
        <span style="font-size:24px; font-weight:900; color:#2d2f2f; letter-spacing:-0.5px;">onset</span>
      </div>
      <p style="font-size:13px; color:#5a5c5c; font-weight:500; margin:0;">learn to DJ — save your progress forever</p>
    </div>

    <!-- Card -->
    <div style="
      background:#ffffff; border-radius:24px;
      padding:28px 28px 24px;
      box-shadow:0 20px 40px rgba(45,47,47,0.08);
    ">

      <!-- Mode tabs -->
      <div style="
        display:flex; gap:4px;
        background:#e7e8e8; border-radius:9999px;
        padding:4px; margin-bottom:24px;
      ">
        <button id="auth-tab-signin" data-tab="signin" style="
          flex:1; padding:10px; font-size:13px; font-weight:700;
          border:none; cursor:pointer; border-radius:9999px; transition:all 0.15s;
          font-family:'Plus Jakarta Sans', sans-serif;
          ${!isSignUp
            ? 'background:#ffffff; color:#2d2f2f; box-shadow:0 2px 8px rgba(0,0,0,0.08);'
            : 'background:transparent; color:#5a5c5c;'}
        ">Sign in</button>
        <button id="auth-tab-signup" data-tab="signup" style="
          flex:1; padding:10px; font-size:13px; font-weight:700;
          border:none; cursor:pointer; border-radius:9999px; transition:all 0.15s;
          font-family:'Plus Jakarta Sans', sans-serif;
          ${isSignUp
            ? 'background:#ffffff; color:#2d2f2f; box-shadow:0 2px 8px rgba(0,0,0,0.08);'
            : 'background:transparent; color:#5a5c5c;'}
        ">Create account</button>
      </div>

      <!-- Form -->
      <form id="auth-form">
        <div style="margin-bottom:14px;">
          <label style="display:block; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#5a5c5c; margin-bottom:6px;">Email</label>
          <input id="auth-email" type="email" required autocomplete="email"
            placeholder="you@example.com"
            style="
              width:100%; box-sizing:border-box;
              padding:13px 16px; border-radius:14px;
              background:#f0f1f1; border:none; outline:none;
              font-size:14px; font-family:'Plus Jakarta Sans', sans-serif;
              color:#2d2f2f; font-weight:500;
            "
          />
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#5a5c5c; margin-bottom:6px;">Password</label>
          <input id="auth-password" type="password" required
            autocomplete="${isSignUp ? 'new-password' : 'current-password'}"
            placeholder="${isSignUp ? 'Choose a password (8+ chars)' : 'Your password'}"
            ${isSignUp ? 'minlength="8"' : ''}
            style="
              width:100%; box-sizing:border-box;
              padding:13px 16px; border-radius:14px;
              background:#f0f1f1; border:none; outline:none;
              font-size:14px; font-family:'Plus Jakarta Sans', sans-serif;
              color:#2d2f2f; font-weight:500;
            "
          />
        </div>

        <!-- Error / success messages -->
        <div id="auth-error" style="
          display:none; font-size:13px; font-weight:500;
          color:#b02500; background:rgba(176,37,0,0.08);
          border-radius:12px; padding:12px 16px;
          margin-bottom:14px;
        "></div>
        <div id="auth-success" style="
          display:none; font-size:13px; font-weight:500;
          color:#2a6900; background:rgba(42,105,0,0.08);
          border-radius:12px; padding:12px 16px;
          margin-bottom:14px;
        "></div>

        <button id="auth-submit" type="submit" style="
          width:100%; padding:14px; border-radius:9999px;
          background:#2a6900; color:#d5ffb9;
          font-size:14px; font-weight:800;
          border:none; cursor:pointer;
          font-family:'Plus Jakarta Sans', sans-serif;
          transition:opacity 0.15s;
          box-shadow:0 8px 24px rgba(42,105,0,0.25);
        ">${isSignUp ? 'Create account' : 'Sign in'}</button>
      </form>

      <!-- Divider -->
      <div style="display:flex; align-items:center; gap:12px; margin:20px 0;">
        <div style="flex:1; height:1px; background:#e7e8e8;"></div>
        <span style="font-size:12px; color:#5a5c5c; font-weight:500;">or</span>
        <div style="flex:1; height:1px; background:#e7e8e8;"></div>
      </div>

      <!-- Google OAuth -->
      <button id="auth-google" type="button" style="
        width:100%; padding:13px 16px; border-radius:9999px;
        background:#f0f1f1; color:#2d2f2f;
        font-size:13px; font-weight:700;
        border:none; cursor:pointer;
        font-family:'Plus Jakarta Sans', sans-serif;
        display:flex; align-items:center; justify-content:center; gap:10px;
        transition:background 0.15s;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>

    </div>

    <p style="text-align:center; font-size:11px; color:#767777; margin-top:16px; font-weight:500;">
      Your progress is saved securely to your account.
    </p>
  </div>
</div>
    `.trim();
  }

  // ── Event Binding ─────────────────────────────────────────────

  _bind() {
    const el = this._el;

    // Tab switching — preserve email input
    el.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const email = el.querySelector('#auth-email')?.value || '';
        this._mode = /** @type {'signin' | 'signup'} */ (btn.dataset.tab);
        this.hide();
        this._render();
        // Restore email so user doesn't have to retype
        const emailInput = this._el?.querySelector('#auth-email');
        if (emailInput) emailInput.value = email;
      });
    });

    // Form submit
    el.querySelector('#auth-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this._handleSubmit();
    });

    // Hover effect on submit button
    const submitBtn = el.querySelector('#auth-submit');
    submitBtn.addEventListener('mouseenter', () => { submitBtn.style.opacity = '0.88'; });
    submitBtn.addEventListener('mouseleave', () => { submitBtn.style.opacity = '1'; });

    // Hover effect on google button
    const googleBtn = el.querySelector('#auth-google');
    googleBtn.addEventListener('mouseenter', () => { googleBtn.style.background = '#e1e3e3'; });
    googleBtn.addEventListener('mouseleave', () => { googleBtn.style.background = '#f0f1f1'; });

    // Google OAuth
    googleBtn.addEventListener('click', async () => {
      this._setError('');
      try {
        await this._auth.signInWithGoogle();
        // Page redirects to Google — no further action needed here
      } catch (err) {
        this._setError(err.message || 'Google sign-in failed.');
      }
    });

    // Focus first input
    el.querySelector('#auth-email')?.focus();
  }

  async _handleSubmit() {
    const el = this._el;
    const email = el.querySelector('#auth-email').value.trim();
    const password = el.querySelector('#auth-password').value;
    const submitBtn = el.querySelector('#auth-submit');
    const isSignUp = this._mode === 'signup';

    this._setError('');
    this._setSuccess('');
    submitBtn.disabled = true;
    submitBtn.textContent = '…';
    submitBtn.style.opacity = '0.6';

    try {
      if (isSignUp) {
        const { data } = await this._auth.signUpWithEmail(email, password);
        if (!data.session) {
          // Email confirmation required
          this._setSuccess('Check your email to confirm your account, then sign in.');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Create account';
          submitBtn.style.opacity = '1';
          return;
        }
      } else {
        await this._auth.signInWithEmail(email, password);
      }
      // Auth succeeded
      this.hide();
      this._resolve?.({ user: this._auth.user });
    } catch (err) {
      this._setError(this._friendlyError(err.message));
      submitBtn.disabled = false;
      submitBtn.textContent = isSignUp ? 'Create account' : 'Sign in';
      submitBtn.style.opacity = '1';
    }
  }

  _setError(msg) {
    const el = this._el?.querySelector('#auth-error');
    if (!el) return;
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
  }

  _setSuccess(msg) {
    const el = this._el?.querySelector('#auth-success');
    if (!el) return;
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
  }

  _friendlyError(msg = '') {
    if (msg.includes('Invalid login credentials')) return 'Incorrect email or password.';
    if (msg.includes('Email not confirmed')) return 'Please confirm your email first.';
    if (msg.includes('already registered')) return 'An account with this email already exists. Try signing in.';
    if (msg.includes('Password should')) return 'Password must be at least 8 characters.';
    return msg || 'Something went wrong. Please try again.';
  }
}
