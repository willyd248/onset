import './styles/main.css';
import './styles/topbar.css';
import './styles/waveform.css';
import './styles/mixer.css';
import './styles/lessons.css';
import './styles/views.css';

import { App } from './ui/App.js';

const app = new App();

document.addEventListener('DOMContentLoaded', () => {
  app.init().catch(err => {
    console.error('Failed to initialize onset:', err);
  });
});
