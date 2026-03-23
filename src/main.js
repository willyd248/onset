import './styles/main.css';
import './styles/topbar.css';
import './styles/waveform.css';
import './styles/mixer.css';
import './styles/lessons.css';

import { AppShell } from './ui/AppShell.js';

const shell = new AppShell();
shell.init();

console.log('onset initialized');
