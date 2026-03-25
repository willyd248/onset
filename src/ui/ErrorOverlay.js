/**
 * ErrorOverlay — full-screen overlay for critical application errors.
 * Displays a user-friendly message with an option to reload.
 */
export class ErrorOverlay {
  /**
   * Show an error overlay.
   * @param {string} title — short error heading
   * @param {string} message — user-friendly description
   * @param {object} [opts]
   * @param {boolean} [opts.dismissable=false] — if true, show a dismiss button instead of forcing reload
   */
  static show(title, message, opts = {}) {
    // Prevent duplicate overlays
    const existing = document.querySelector('.error-overlay');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.className = 'error-overlay';

    const titleEl = document.createElement('h2');
    titleEl.className = 'error-overlay__title';
    titleEl.textContent = title;

    const msgEl = document.createElement('p');
    msgEl.className = 'error-overlay__message';
    msgEl.textContent = message;

    el.appendChild(titleEl);
    el.appendChild(msgEl);

    if (opts.dismissable) {
      const dismissBtn = document.createElement('button');
      dismissBtn.className = 'btn error-overlay__btn';
      dismissBtn.textContent = 'DISMISS';
      dismissBtn.addEventListener('click', () => {
        el.classList.remove('error-overlay--visible');
        setTimeout(() => el.remove(), 150);
      });
      el.appendChild(dismissBtn);
    } else {
      const btn = document.createElement('button');
      btn.className = 'btn error-overlay__btn';
      btn.textContent = 'RELOAD';
      btn.addEventListener('click', () => {
        window.location.reload();
      });
      el.appendChild(btn);
    }

    document.body.appendChild(el);

    // Animate in on next frame
    requestAnimationFrame(() => {
      el.classList.add('error-overlay--visible');
    });
  }
}
