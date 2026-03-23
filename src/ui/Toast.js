/**
 * Toast — simple non-intrusive notification system.
 * Shows a message at the bottom of the screen that auto-dismisses.
 */
export class Toast {
  /**
   * Show a toast notification.
   * @param {string} message
   * @param {number} durationMs — how long to display (default 4000ms)
   */
  static show(message, durationMs = 4000) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;

    document.body.appendChild(el);

    // Trigger slide-up animation on next frame
    requestAnimationFrame(() => {
      el.classList.add('toast--visible');
    });

    setTimeout(() => {
      el.classList.remove('toast--visible');
      el.classList.add('toast--exiting');

      el.addEventListener('transitionend', () => {
        el.remove();
      }, { once: true });

      // Fallback removal if transitionend doesn't fire
      setTimeout(() => {
        if (el.parentNode) el.remove();
      }, 500);
    }, durationMs);
  }
}
