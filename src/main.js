import './styles/custom.css';

import { App } from './ui/App.js';

// Email gate: check access before initializing the app
const ACCESS_KEY = 'onset:access';
const LANDING_URL = 'https://onsetdj.com';

function checkAccess() {
  try {
    const params = new URLSearchParams(window.location.search);

    // If arriving with ?access=1, store it and strip the param
    if (params.get('access') === '1') {
      localStorage.setItem(ACCESS_KEY, '1');
      params.delete('access');
      const clean = params.toString();
      const url = window.location.pathname + (clean ? `?${clean}` : '');
      window.history.replaceState({}, '', url);
      return true;
    }

    // Check localStorage
    if (localStorage.getItem(ACCESS_KEY) === '1') {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

if (!checkAccess()) {
  // Redirect to landing page
  window.location.href = LANDING_URL;
} else {
  const app = new App();

  document.addEventListener('DOMContentLoaded', () => {
    app.init().catch(err => {
      console.error('Failed to initialize onset:', err);
    });
  });
}
