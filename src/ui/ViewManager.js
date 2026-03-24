/**
 * ViewManager — handles switching between top-level views.
 * Shows one view at a time by toggling display.
 */
export class ViewManager extends EventTarget {
  constructor() {
    super();

    /** @type {Map<string, HTMLElement>} */
    this._views = new Map();

    /** @type {string} */
    this._activeView = 'practice';

    /** @type {NodeListOf<HTMLElement>} */
    this._navButtons = document.querySelectorAll('#main-nav .nav-btn');
  }

  init() {
    // Register all view containers
    const viewIds = ['practice', 'learn', 'stats', 'profile', 'settings', 'session-complete'];
    for (const id of viewIds) {
      const el = document.getElementById(`view-${id}`);
      if (el) {
        this._views.set(id, el);
      }
    }

    // Bind nav button clicks
    this._navButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const viewName = btn.getAttribute('data-view');
        if (viewName) {
          this.show(viewName);
        }
      });
    });

    // Bind learn-node clicks and keyboard to navigate to practice
    document.querySelectorAll('.learn-node[data-lesson]').forEach((node) => {
      const handler = () => {
        if (node.classList.contains('learn-node--locked')) return;
        this.show('practice');
      };
      node.addEventListener('click', handler);
      node.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handler();
        }
      });
    });

    // Show the default view
    this.show('practice');
  }

  /**
   * Switch to a view with a fade transition.
   * @param {string} viewName
   */
  show(viewName) {
    if (!this._views.has(viewName)) return;
    if (viewName === this._activeView && this._initialized) return;

    const outgoing = this._views.get(this._activeView);
    const incoming = this._views.get(viewName);
    this._activeView = viewName;

    // Update nav button active states immediately
    this._navButtons.forEach((btn) => {
      const btnView = btn.getAttribute('data-view');
      if (btnView === viewName) {
        btn.classList.add('nav-btn--active');
      } else {
        btn.classList.remove('nav-btn--active');
      }
    });

    // First call (init) — no animation, just show
    if (!this._initialized) {
      this._initialized = true;
      for (const [name, el] of this._views) {
        if (name === viewName) {
          el.style.display = name === 'practice' ? 'grid' : 'flex';
          el.classList.add('view--visible');
        } else {
          el.style.display = 'none';
          el.classList.remove('view--visible');
        }
      }
      this.dispatchEvent(new CustomEvent('view-changed', { detail: { view: viewName } }));
      return;
    }

    // Fade out the current view
    if (outgoing) {
      outgoing.classList.remove('view--visible');
    }

    // After fade-out, swap display and fade in
    setTimeout(() => {
      for (const [name, el] of this._views) {
        if (name === viewName) {
          el.style.display = name === 'practice' ? 'grid' : 'flex';
          // Force a reflow before adding visible class so the transition fires
          void el.offsetHeight;
          el.classList.add('view--visible');
        } else {
          el.style.display = 'none';
          el.classList.remove('view--visible');
        }
      }

      // Fire resize so canvases recalculate dimensions when returning to practice
      if (viewName === 'practice') {
        requestAnimationFrame(() => {
          window.dispatchEvent(new Event('resize'));
        });
      }

      this.dispatchEvent(new CustomEvent('view-changed', { detail: { view: viewName } }));
    }, 150); // matches the CSS transition duration
  }

  /** @returns {string} */
  get activeView() {
    return this._activeView;
  }
}
