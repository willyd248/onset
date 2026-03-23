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

    // Show the default view
    this.show('practice');
  }

  /**
   * Switch to a view.
   * @param {string} viewName
   */
  show(viewName) {
    if (!this._views.has(viewName)) return;

    this._activeView = viewName;

    // Hide all views
    for (const [name, el] of this._views) {
      if (name === viewName) {
        // Practice view uses grid layout internally
        el.style.display = name === 'practice' ? 'grid' : 'flex';
      } else {
        el.style.display = 'none';
      }
    }

    // Update nav button active states
    this._navButtons.forEach((btn) => {
      const btnView = btn.getAttribute('data-view');
      if (btnView === viewName) {
        btn.classList.add('nav-btn--active');
      } else {
        btn.classList.remove('nav-btn--active');
      }
    });

    // Fire resize so canvases recalculate dimensions when returning to practice
    if (viewName === 'practice') {
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
      });
    }

    this.dispatchEvent(new CustomEvent('view-changed', { detail: { view: viewName } }));
  }

  /** @returns {string} */
  get activeView() {
    return this._activeView;
  }
}
