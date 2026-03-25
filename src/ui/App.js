/**
 * App — main application controller that wires all modules together.
 * Handles initialization order, user gesture requirements, and mode switching.
 */
import { AudioEngine } from '../audio/AudioEngine.js';
import { Deck } from '../audio/Deck.js';
import { Crossfader } from '../audio/Crossfader.js';
import { MIDIController } from '../midi/MIDIController.js';
import { MIDIRouter } from '../midi/MIDIRouter.js';
import { LEDFeedback } from '../midi/LEDFeedback.js';
import { herculesMapping } from '../midi/hercules-mapping.js';
import { WaveformData } from '../visuals/WaveformData.js';
import { WaveformRenderer } from '../visuals/WaveformRenderer.js';
import { BPMDetector } from '../visuals/BPMDetector.js';
import { MixerState } from './MixerState.js';
import { MixerUI } from './MixerUI.js';
import { MixerBridge } from './MixerBridge.js';
import { AppShell } from './AppShell.js';
import { ViewManager } from './ViewManager.js';
import { LessonEngine } from '../lessons/LessonEngine.js';
import { PerformanceTips } from './PerformanceTips.js';
import { Toast } from './Toast.js';
import { ErrorOverlay } from './ErrorOverlay.js';
import { SettingsManager } from './SettingsManager.js';

export class App {
  constructor() {
    /** @type {AudioEngine | null} */
    this._engine = null;

    /** @type {MIDIController | null} */
    this._midiController = null;

    /** @type {MIDIRouter | null} */
    this._midiRouter = null;

    /** @type {LEDFeedback | null} */
    this._ledFeedback = null;

    /** @type {{ A: Deck, B: Deck } | null} */
    this._decks = null;

    /** @type {Crossfader | null} */
    this._crossfader = null;

    /** @type {MixerState | null} */
    this._mixerState = null;

    /** @type {MixerUI | null} */
    this._mixerUI = null;

    /** @type {MixerBridge | null} */
    this._mixerBridge = null;

    /** @type {{ A: WaveformRenderer, B: WaveformRenderer } | null} */
    this._waveformRenderers = null;

    /** @type {AppShell | null} */
    this._shell = null;

    /** @type {ViewManager | null} */
    this._viewManager = null;

    /** @type {LessonEngine | null} */
    this._lessonEngine = null;

    /** @type {PerformanceTips | null} */
    this._tips = null;

    /** @type {boolean} */
    this._audioResumed = false;
  }

  /**
   * Initialize the entire application.
   * @returns {Promise<void>}
   */
  async init() {
    // 1. Check browser support
    if (!this._checkBrowserSupport()) return;

    // 2. Create AudioEngine (stays suspended until user gesture)
    this._engine = AudioEngine.getInstance();

    // 3. Create MIDIController (optional — app works without it)
    this._midiController = new MIDIController();

    // 4. Create Decks and Crossfader
    const deckA = new Deck(this._engine, 'A');
    const deckB = new Deck(this._engine, 'B');
    this._decks = { A: deckA, B: deckB };
    this._crossfader = new Crossfader(this._engine);

    // 5. Connect deck outputs to crossfader inputs
    deckA.output.connect(this._crossfader.inputA);
    deckB.output.connect(this._crossfader.inputB);

    // 6. Create MixerState, MixerUI, MixerBridge
    this._mixerState = new MixerState();
    this._mixerUI = new MixerUI(this._mixerState);

    // 7. Init MIDI (truly non-blocking — don't await, let it resolve in background)
    this._initMIDI().catch(() => {});

    // 8. Create MixerBridge and wire it up
    this._mixerBridge = new MixerBridge(
      this._mixerState,
      this._decks,
      this._crossfader,
      this._midiRouter
    );

    // 9. Init MixerUI and MixerBridge
    this._mixerUI.init();
    this._mixerBridge.init();

    // 10. Create WaveformRenderers
    const canvasA = /** @type {HTMLCanvasElement} */ (document.getElementById('waveform-a'));
    const canvasB = /** @type {HTMLCanvasElement} */ (document.getElementById('waveform-b'));
    this._waveformRenderers = {
      A: new WaveformRenderer(canvasA, 'A'),
      B: new WaveformRenderer(canvasB, 'B'),
    };

    // 11. Create and init AppShell
    this._shell = new AppShell();
    this._shell.init();

    // 11b. Create and init ViewManager
    this._viewManager = new ViewManager();
    this._viewManager.init();

    // 12. Create LessonEngine
    this._lessonEngine = new LessonEngine(this._mixerState);

    // 13. Create PerformanceTips
    this._tips = new PerformanceTips(this._mixerState);

    // 14. Set up track loading (file inputs + drag-drop) and empty state
    this._setupTrackLoading();
    this._emptyStateEl = document.getElementById('practice-empty-state');
    this._setupDemoTracks();

    // 15. Set up the startup overlay for first user gesture
    this._setupStartupOverlay();

    // 16. Set up MIDI connection status updates
    this._setupMIDIStatusUpdates();

    // 17. Set up mode switching
    this._setupModeSwitching();

    // 18. Init LessonEngine
    this._lessonEngine.init();

    // 18a. Wire progress updates to refresh views
    this._setupProgressUpdates();

    // 18b. Wire session-complete event to show full-screen celebration
    this._setupSessionCompleteView();

    // 19. Wire cue button events from MixerUI to decks
    this._setupCueHandling();

    // 20. Update settings MIDI status
    this._setupSettingsMIDIStatus();

    // 21a. Init settings manager (theme, difficulty, session length)
    this._settingsManager = new SettingsManager();

    // 21. Save practice time on page unload
    window.addEventListener('beforeunload', () => {
      this._lessonEngine.progress.endSession();
    });

    // 22. Start time display update loop
    this._startTimeUpdates();

    console.log('onset initialized');
  }

  // ── Browser Support ──────────────────────────────────────────

  /**
   * Check for required browser APIs.
   * @returns {boolean}
   */
  _checkBrowserSupport() {
    if (!window.AudioContext && !window.webkitAudioContext) {
      ErrorOverlay.show(
        'Audio not supported',
        'Your browser does not support the Web Audio API. Please use a recent version of Chrome, Firefox, or Edge.'
      );
      return false;
    }
    return true;
  }

  // ── MIDI Initialization ──────────────────────────────────────

  /** @private */
  async _initMIDI() {
    const wireUpRouter = () => {
      if (this._midiRouter) return; // already wired
      this._midiRouter = new MIDIRouter(this._midiController, herculesMapping);
      this._ledFeedback = new LEDFeedback(this._midiController);

      // Re-create bridge with the new router
      if (this._mixerBridge && this._decks && this._crossfader) {
        this._mixerBridge = new MixerBridge(
          this._mixerState,
          this._decks,
          this._crossfader,
          this._midiRouter
        );
        this._mixerBridge.init();
      }

      console.log('[onset] MIDI router wired to MixerBridge');
      console.log('[onset] Triple-click MIDI status to enable debug logging');
    };

    this._midiController.addEventListener('connected', () => wireUpRouter());

    this._midiController.addEventListener('disconnected', () => {
      this._midiRouter = null;
      this._ledFeedback = null;
    });

    this._midiController.addEventListener('error', () => {
      if (this._shell) this._shell.setConnectionStatus('no-midi');
    });

    this._midiController.addEventListener('permission-denied', () => {
      if (this._shell) this._shell.setConnectionStatus('no-midi');
    });

    await this._midiController.init();

    // If already connected after init, wire up immediately
    if (this._midiController.isConnected) {
      wireUpRouter();
    }
  }

  // ── Startup Overlay ──────────────────────────────────────────

  /** @private */
  _setupStartupOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'startup-overlay';
    overlay.id = 'startup-overlay';

    const content = document.createElement('div');
    content.className = 'startup-overlay__content';

    const title = document.createElement('h1');
    title.className = 'startup-overlay__title';
    title.textContent = 'onset';

    const subtitle = document.createElement('p');
    subtitle.className = 'startup-overlay__subtitle';
    subtitle.textContent = 'click anywhere to start';

    content.appendChild(title);
    content.appendChild(subtitle);
    overlay.appendChild(content);
    document.body.appendChild(overlay);

    // Animate in
    requestAnimationFrame(() => {
      overlay.classList.add('startup-overlay--visible');
    });

    const resumeAudio = async () => {
      if (this._audioResumed) return;
      this._audioResumed = true;

      // Always remove overlay first — never block UI regardless of audio state
      overlay.classList.remove('startup-overlay--visible');
      overlay.addEventListener('transitionend', () => {
        overlay.remove();
      }, { once: true });

      // Fallback removal (in case transitionend doesn't fire)
      setTimeout(() => {
        if (overlay.parentNode) overlay.remove();
      }, 500);

      // Remove listeners
      document.removeEventListener('click', resumeAudio);
      document.removeEventListener('keydown', resumeAudio);

      // Then try to init audio (non-blocking)
      try {
        await this._engine.init();
      } catch (err) {
        Toast.show('Audio system error — reload to try again');
      }
    };

    document.addEventListener('click', resumeAudio);
    document.addEventListener('keydown', resumeAudio);
  }

  // ── Track Loading ────────────────────────────────────────────

  /** @private */
  _setupTrackLoading() {
    // File input changes from MixerUI
    this._mixerUI.addEventListener('load-track', (e) => {
      const { deck, file } = /** @type {CustomEvent} */ (e).detail;
      this._loadTrack(deck, file);
    });

    // No track loaded warning
    this._mixerUI.addEventListener('no-track', (e) => {
      const { deck } = /** @type {CustomEvent} */ (e).detail;
      Toast.show(`Load a track into Deck ${deck} first`);
    });

    // Drag-and-drop from AppShell drop zones
    document.addEventListener('track-drop', (e) => {
      const { deck, file } = /** @type {CustomEvent} */ (e).detail;
      const deckName = deck === 'a' ? 'A' : 'B';
      this._loadTrack(deckName, file);
    });
  }

  /**
   * Load a track into a deck and set up waveform rendering.
   * @param {'A' | 'B'} deckName
   * @param {File} file
   */
  /**
   * @param {'A' | 'B'} deckName
   * @param {File} file
   * @param {{ skipVisuals?: boolean }} [opts]
   */
  async _loadTrack(deckName, file, opts = {}) {
    const deck = this._decks[deckName];
    const renderer = this._waveformRenderers[deckName];
    const nameEl = document.getElementById(`track-name-${deckName.toLowerCase()}`);
    const trackName = file.name.replace(/\.[^/.]+$/, '');

    // Show loading state
    if (nameEl) nameEl.textContent = 'Loading...';

    try {
      // Load audio into deck
      await deck.loadTrack(file);

      // Mark track as loaded in state
      this._mixerState.set(deckName, 'hasTrack', true, 'audio');

      // Hide empty state, show waveform section
      if (this._emptyStateEl) this._emptyStateEl.hidden = true;
      const wfSection = document.getElementById('waveform-section');
      if (wfSection) wfSection.classList.remove('hidden');

      // Update track name in UI with tooltip for long names
      if (nameEl) {
        nameEl.textContent = trackName;
        nameEl.title = trackName;
      }

      // Generate waveform data and detect BPM (skip for demo tracks to avoid blocking)
      const buffer = deck._buffer;
      if (buffer && !opts.skipVisuals) {
        const bpmDeckName = deckName.toLowerCase();
        const scheduleDeferred = (fn) => {
          if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(fn, { timeout: 2000 });
          } else {
            setTimeout(fn, 200);
          }
        };

        scheduleDeferred(() => {
          try {
            const waveformData = new WaveformData(buffer);
            waveformData.generate();
            renderer.setData(waveformData);
            renderer.start(() => deck.currentTime);
          } catch { /* waveform is best-effort */ }
        });

        setTimeout(() => {
          scheduleDeferred(() => {
            try {
              const { bpm } = BPMDetector.detect(buffer);
              const bpmEl = document.getElementById(`track-bpm-${bpmDeckName}`);
              if (bpmEl) bpmEl.textContent = `${bpm} BPM`;
            } catch { /* BPM detection is best-effort */ }
          });
        }, 500);
      }

      // Restore hot cues for this track
      this._restoreHotCues(deckName, trackName);
    } catch (err) {
      if (nameEl) nameEl.textContent = 'no track loaded';
      const message = err.message?.startsWith('Unsupported file type')
        ? err.message
        : 'The audio file could not be decoded. Please try a different file (MP3, WAV, OGG, or FLAC).';
      ErrorOverlay.show('Could not load track', message);
    }
  }

  // ── Time Display Updates ────────────────────────────────────

  /** @private */
  _startTimeUpdates() {
    const timeEls = {
      A: document.getElementById('track-time-a'),
      B: document.getElementById('track-time-b'),
    };

    const formatTime = (seconds) => {
      if (!seconds || !isFinite(seconds)) return '0:00';
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const update = () => {
      for (const deckName of ['A', 'B']) {
        const deck = this._decks[deckName];
        const el = timeEls[deckName];
        if (!deck || !el) continue;
        const cur = formatTime(deck.currentTime);
        const dur = formatTime(deck.duration);
        el.textContent = `${cur} / ${dur}`;
      }
      requestAnimationFrame(update);
    };

    requestAnimationFrame(update);
  }

  // ── Demo Tracks ─────────────────────────────────────────────

  /** @private */
  _setupDemoTracks() {
    const btn = document.getElementById('demo-tracks-btn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Loading Deck A...';

      try {
        // Load sequentially to avoid two simultaneous heavy decodes
        await this._loadDemoTrack('A', '/assets/demo/track-a.mp3', 'Vox and Bells');
        btn.textContent = 'Loading Deck B...';
        await new Promise(r => setTimeout(r, 50));
        await this._loadDemoTrack('B', '/assets/demo/track-b.mp3', 'Through the Beat');
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Try with demo tracks';
        Toast.show('Could not load demo tracks');
      }
    });
  }

  /**
   * Fetch a demo track by URL and load it into a deck.
   * @param {'A' | 'B'} deckName
   * @param {string} url
   * @param {string} displayName
   */
  async _loadDemoTrack(deckName, url, displayName) {
    const response = await fetch(url);
    const blob = await response.blob();
    const file = new File([blob], `${displayName}.mp3`, { type: 'audio/mpeg' });
    await this._loadTrack(deckName, file);
  }

  // ── MIDI Status Updates ──────────────────────────────────────

  /** @private */
  _setupMIDIStatusUpdates() {
    if (!this._midiController) return;

    this._midiController.addEventListener('connected', () => {
      if (this._shell) {
        this._shell.setConnectionStatus('connected');
      }
      Toast.show('MIDI controller connected');
    });

    this._midiController.addEventListener('disconnected', () => {
      if (this._shell) {
        this._shell.setConnectionStatus('disconnected');
      }
      Toast.show('MIDI controller disconnected');
    });

    // Set initial status
    if (this._midiController.isConnected) {
      this._shell.setConnectionStatus('connected');
    }

    // MIDI debug toggle — triple-click on MIDI status indicator
    const midiStatusEl = document.getElementById('midi-status');
    if (midiStatusEl) {
      let clickCount = 0;
      let clickTimer = null;
      midiStatusEl.addEventListener('click', () => {
        clickCount++;
        if (clickTimer) clearTimeout(clickTimer);
        clickTimer = setTimeout(() => { clickCount = 0; }, 600);
        if (clickCount >= 3) {
          clickCount = 0;
          if (this._midiRouter) {
            const newState = !this._midiRouter.debug;
            this._midiRouter.setDebug(newState);
            Toast.show(newState ? 'MIDI debug ON — check console' : 'MIDI debug OFF');
          }
        }
      });
    }
  }

  // ── Mode Switching ───────────────────────────────────────────

  /** @private */
  _setupModeSwitching() {
    const lessonsBtn = document.getElementById('mode-lessons');
    const freeplayBtn = document.getElementById('mode-freeplay');

    lessonsBtn?.addEventListener('click', () => {
      this._enterLessonsMode();
    });

    freeplayBtn?.addEventListener('click', () => {
      this._enterFreePlayMode();
    });
  }

  /** @private */
  _enterLessonsMode() {
    this._lessonEngine.progress.endSession(); // close any free play session
    this._tips.stop();
    this._lessonEngine.startSession();
  }

  /** @private */
  _enterFreePlayMode() {
    this._lessonEngine.progress.startSession();
    this._tips.start();
  }

  // ── Session Complete View ─────────────────────────────────────

  /** @private */
  _setupSessionCompleteView() {
    if (!this._lessonEngine || !this._viewManager) return;

    this._lessonEngine.addEventListener('session-complete', (e) => {
      const stats = /** @type {CustomEvent} */ (e).detail;
      const el = document.getElementById('session-complete-content');
      if (el) {
        el.innerHTML = `
          <span class="material-symbols-outlined session-complete__icon" style="font-variation-settings: 'FILL' 1;">celebration</span>
          <h2 class="session-complete__title">Session Complete!</h2>
          <div class="session-complete__score">${stats.averageScore || 0}</div>
          <p class="session-complete__label">Average Score</p>
          <div class="session-complete__metrics">
            <div class="session-complete__metric">
              <span class="session-complete__metric-value">${stats.completed || 0}</span>
              <span class="session-complete__metric-label">Lessons</span>
            </div>
            <div class="session-complete__metric">
              <span class="session-complete__metric-value">${stats.total || 0}</span>
              <span class="session-complete__metric-label">Total</span>
            </div>
          </div>
          <div class="session-complete__actions">
            <button class="btn btn--deck-a" id="session-back-btn">Back to Practice</button>
          </div>
        `;

        const backBtn = document.getElementById('session-back-btn');
        if (backBtn) {
          backBtn.addEventListener('click', () => {
            this._viewManager.show('practice');
          }, { once: true });
        }
      }

      this._viewManager.show('session-complete');
    });
  }

  // ── Settings MIDI Status ────────────────────────────────────

  /** @private */
  _setupSettingsMIDIStatus() {
    if (!this._midiController) return;

    const updateSettings = () => {
      const statusEl = document.getElementById('settings-midi-status');
      const deviceEl = document.getElementById('settings-midi-device');
      if (statusEl) {
        statusEl.textContent = this._midiController.isConnected ? 'Connected' : 'Disconnected';
      }
      if (deviceEl && this._midiController.isConnected) {
        deviceEl.textContent = this._midiController.inputPort?.name || 'MIDI Controller';
      }
    };

    this._midiController.addEventListener('connected', updateSettings);
    this._midiController.addEventListener('disconnected', updateSettings);
    updateSettings();
  }

  // ── Progress Updates ─────────────────────────────────────────

  /** @private */
  _setupProgressUpdates() {
    const progress = this._lessonEngine.progress;

    // Refresh views on progress change
    progress.addEventListener('progress-updated', () => this._refreshAllViews());

    // Also refresh when navigating to these views
    this._viewManager.addEventListener('view-changed', (e) => {
      const view = /** @type {CustomEvent} */ (e).detail.view;
      if (view === 'learn' || view === 'stats' || view === 'profile') {
        this._refreshAllViews();
      }
    });

    // Initial refresh
    this._refreshAllViews();
  }

  /** @private */
  _refreshAllViews() {
    const summary = this._lessonEngine.progress.getSummary();
    this._refreshProfileView(summary);
    this._refreshStatsView(summary);
    this._refreshLearnView(summary);
    this._refreshStreakBadge(summary);
  }

  /** @private */
  _refreshProfileView(summary) {
    const levelEl = document.getElementById('profile-level');
    const xpEl = document.getElementById('profile-xp');
    const streakEl = document.getElementById('profile-streak');
    const lessonsEl = document.getElementById('profile-lessons');

    if (levelEl) levelEl.textContent = `Level ${summary.level} — ${summary.levelLabel}`;
    if (xpEl) xpEl.textContent = String(summary.totalXP);
    if (streakEl) streakEl.textContent = String(summary.currentStreak);
    if (lessonsEl) lessonsEl.textContent = String(summary.lessonsCompleted);
  }

  /** @private */
  _refreshStatsView(summary) {
    const lessonsEl = document.getElementById('stat-lessons');
    const timeEl = document.getElementById('stat-practice-time');
    const streakEl = document.getElementById('stat-current-streak');
    const bestEl = document.getElementById('stat-best-streak');

    if (lessonsEl) lessonsEl.textContent = String(summary.lessonsCompleted);
    if (timeEl) timeEl.textContent = summary.practiceHours < 1
      ? `${Math.round(summary.practiceHours * 60)}m`
      : `${summary.practiceHours}h`;
    if (streakEl) streakEl.textContent = String(summary.currentStreak);
    if (bestEl) bestEl.textContent = String(summary.bestStreak);

    // Skill balance bars
    const categories = ['basics', 'eq-mixing', 'beatmatching', 'transitions'];
    for (const cat of categories) {
      const el = document.getElementById(`skill-${cat}`);
      if (el) {
        const score = summary.categoryScores[cat] || 0;
        el.style.width = `${score}%`;
      }
    }
  }

  /** @private */
  _refreshLearnView(summary) {
    const completed = new Set(summary.completedLessonIds);
    const catalog = this._lessonEngine.library.getAll();

    // Build learn path from catalog data — ordered IDs, titles from catalog
    const orderedIds = [
      'basics-load-play', 'basics-eq-sweep', 'beatmatch-pitch',
      'transition-bass-swap', 'eq-mix-frequency-swap', 'beatmatch-phase',
    ];
    const learnPath = orderedIds.map(id => {
      const lesson = catalog.find(l => l.id === id);
      return { id, title: lesson?.title ?? id, desc: lesson?.description ?? '' };
    });

    const nodes = document.querySelectorAll('.learn-node');
    nodes.forEach((node, i) => {
      if (i >= learnPath.length) return;
      const entry = learnPath[i];
      const isComplete = completed.has(entry.id);

      // Check if prerequisites are met (previous lesson completed, or first lesson)
      const lesson = catalog.find(l => l.id === entry.id);
      const prereqsMet = lesson
        ? lesson.prerequisiteIds.every(pid => completed.has(pid))
        : i === 0;

      const isActive = !isComplete && prereqsMet;
      const isLocked = !isComplete && !prereqsMet;

      // Update classes
      node.classList.remove('learn-node--complete', 'learn-node--active', 'learn-node--locked');
      if (isComplete) node.classList.add('learn-node--complete');
      else if (isActive) node.classList.add('learn-node--active');
      else node.classList.add('learn-node--locked');

      // Update icon
      const iconContainer = node.querySelector('.learn-node__icon');
      if (iconContainer) {
        iconContainer.classList.remove('learn-node__icon--active', 'learn-node__icon--locked');
        const icon = iconContainer.querySelector('.material-symbols-outlined');
        if (icon) {
          if (isComplete) {
            icon.textContent = 'check_circle';
            icon.style.fontVariationSettings = "'FILL' 1";
          } else if (isActive) {
            iconContainer.classList.add('learn-node__icon--active');
            icon.textContent = 'headphones';
            icon.style.fontVariationSettings = '';
          } else {
            iconContainer.classList.add('learn-node__icon--locked');
            icon.textContent = 'lock';
            icon.style.fontVariationSettings = '';
          }
        }
      }

      // Update badge
      const badge = node.querySelector('.learn-node__badge');
      if (badge) {
        badge.classList.remove('learn-node__badge--complete', 'learn-node__badge--active', 'learn-node__badge--locked');
        if (isComplete) {
          badge.classList.add('learn-node__badge--complete');
          badge.textContent = 'Done';
        } else if (isActive) {
          badge.classList.add('learn-node__badge--active');
          badge.textContent = 'In Progress';
        } else {
          badge.classList.add('learn-node__badge--locked');
          badge.textContent = 'Locked';
        }
      }

      // Update clickability
      if (isLocked) {
        node.removeAttribute('role');
        node.removeAttribute('tabindex');
        node.removeAttribute('data-lesson');
      } else {
        node.setAttribute('role', 'button');
        node.setAttribute('tabindex', '0');
        node.setAttribute('data-lesson', entry.id);
      }
    });
  }

  /** @private */
  _refreshStreakBadge(summary) {
    const countEl = document.getElementById('streak-count');
    if (countEl) countEl.textContent = String(summary.currentStreak);
  }

  // ── Cue Handling ────────────────────────────────────────────

  /** @private */
  _setupCueHandling() {
    this._mixerUI.addEventListener('cue', (e) => {
      const { deck } = /** @type {CustomEvent} */ (e).detail;
      if (this._decks[deck]) {
        this._decks[deck].cue();
      }
    });

    // Save hot cues when they change
    this._mixerState.addEventListener('change', (e) => {
      const { deck, param } = /** @type {CustomEvent} */ (e).detail;
      if (param === 'hotCues' && (deck === 'A' || deck === 'B')) {
        const nameEl = document.getElementById(`track-name-${deck.toLowerCase()}`);
        if (nameEl && nameEl.textContent !== 'no track loaded' && nameEl.textContent !== 'Loading...') {
          this._saveHotCues(deck, nameEl.textContent);
        }
      }
    });
  }

  // ── Hot Cue Persistence ─────────────────────────────────────

  /** @private */
  _saveHotCues(deck, trackName) {
    try {
      const key = 'onset:hotcues';
      const data = JSON.parse(localStorage.getItem(key) || '{}');
      const cues = this._mixerState.get(deck, 'hotCues');
      data[trackName] = cues;
      localStorage.setItem(key, JSON.stringify(data));
    } catch { /* best-effort */ }
  }

  /** @private */
  _restoreHotCues(deck, trackName) {
    try {
      const key = 'onset:hotcues';
      const data = JSON.parse(localStorage.getItem(key) || '{}');
      const cues = data[trackName];
      if (cues && Array.isArray(cues)) {
        this._mixerState.set(deck, 'hotCues', cues, 'audio');
      }
    } catch { /* best-effort */ }
  }
}
