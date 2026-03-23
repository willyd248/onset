/**
 * ErrorOverlay — full-screen overlay for critical application errors.
 * Displays a user-friendly message with an option to reload.
 */
export class ErrorOverlay {
  /**
   * Show a critical error overlay.
   * @param {string} title — short error heading
   * @param {string} message — user-friendly description
   */
  static show(title, message) {
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

    const btn = document.createElement('button');
    btn.className = 'btn error-overlay__btn';
    btn.textContent = 'RELOAD';
    btn.addEventListener('click', () => {
      window.location.reload();
    });

    el.appendChild(titleEl);
    el.appendChild(msgEl);
    el.appendChild(btn);

    document.body.appendChild(el);

    // Animate in on next frame
    requestAnimationFrame(() => {
      el.classList.add('error-overlay--visible');
    });
  }
}
