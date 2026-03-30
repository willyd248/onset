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

    /** @type {import('@supabase/supabase-js').SupabaseClient | null} */
    this._supabase = null;

    /** @type {string | null} */
    this._userId = null;

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
        this._mixerBridge.destroy();
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

      // Hide empty state overlay
      if (this._emptyStateEl) this._emptyStateEl.hidden = true;

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
      ErrorOverlay.show('Could not load track', message, { dismissable: true });
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

    const syncBpmEl = document.getElementById('sync-bpm');
    const syncTimeEl = document.getElementById('sync-time');

    // Track whether the time update loop should be running
    this._timeUpdateActive = true;

    // Pause/resume the loop when views change
    this._viewManager.addEventListener('view-changed', (e) => {
      const view = /** @type {CustomEvent} */ (e).detail.view;
      if (view === 'practice') {
        this._timeUpdateActive = true;
        requestAnimationFrame(update);
      } else {
        this._timeUpdateActive = false;
      }
    });

    const update = () => {
      if (!this._timeUpdateActive) return;

      for (const deckName of ['A', 'B']) {
        const deck = this._decks[deckName];
        const el = timeEls[deckName];
        if (!deck || !el) continue;
        const cur = formatTime(deck.currentTime);
        const dur = formatTime(deck.duration);
        el.textContent = `${cur} / ${dur}`;
      }

      // Update sync bar: show BPM and time of the currently playing deck (or A by default)
      if (syncBpmEl || syncTimeEl) {
        const activeDeck = this._decks.B?.isPlaying ? 'B' : 'A';
        const deck = this._decks[activeDeck];
        if (syncBpmEl) {
          const bpmEl = document.getElementById(`track-bpm-${activeDeck.toLowerCase()}`);
          syncBpmEl.textContent = bpmEl?.textContent || '--- BPM';
        }
        if (syncTimeEl && deck) {
          const cur = formatTime(deck.currentTime);
          const dur = formatTime(deck.duration);
          syncTimeEl.textContent = `${cur} / ${dur}`;
        }
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

    const originalHTML = btn.innerHTML;
    const setLoading = (msg) => {
      btn.innerHTML = `<span class="loading-spinner loading-spinner--sm" style="border-top-color:#fff;border-color:rgba(255,255,255,0.3);border-top-color:#fff;"></span><span>${msg}</span>`;
    };

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      setLoading('Loading Deck A…');

      try {
        // Load sequentially to avoid two simultaneous heavy decodes
        await this._loadDemoTrack('A', '/assets/demo/track-a.mp3', 'Vox and Bells');
        setLoading('Loading Deck B…');
        await new Promise(r => setTimeout(r, 50));
        await this._loadDemoTrack('B', '/assets/demo/track-b.mp3', 'Through the Beat');
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
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
    await this._loadTrack(deckName, file, { skipVisuals: true });

    // Generate fast peaks-only waveform for demo tracks (skip expensive frequency/BPM analysis)
    const deck = this._decks[deckName];
    const renderer = this._waveformRenderers[deckName];
    if (deck?._buffer && renderer) {
      setTimeout(() => {
        try {
          const waveformData = new WaveformData(deck._buffer);
          waveformData.generatePeaksOnly();
          renderer.setData(waveformData);
          renderer.start(() => deck.currentTime);
        } catch { /* waveform is best-effort */ }
      }, 100);
    }
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
          <div class="relative text-center mb-4 w-full max-w-sm">
            <div class="absolute -top-6 left-1/4 animate-bounce text-secondary text-xl"><span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1;">auto_awesome</span></div>
            <div class="absolute -top-4 right-1/4 animate-pulse text-[#fec700] text-2xl"><span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1;">celebration</span></div>
            <h2 class="session-complete__title mb-3">Session Mastered!</h2>
            <div style="display:flex; justify-content:center; gap:8px; margin-bottom:20px;">
              <span class="material-symbols-outlined" style="font-size:40px; color:#fec700; filter:drop-shadow(0 0 8px rgba(254,199,0,0.4)); font-variation-settings:'FILL' 1;">star</span>
              <span class="material-symbols-outlined" style="font-size:52px; color:#fec700; filter:drop-shadow(0 0 8px rgba(254,199,0,0.4)); margin-top:-12px; font-variation-settings:'FILL' 1;">star</span>
              <span class="material-symbols-outlined" style="font-size:40px; color:#fec700; filter:drop-shadow(0 0 8px rgba(254,199,0,0.4)); font-variation-settings:'FILL' 1;">star</span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px;">
              <div style="background:var(--primary-container); border-radius:12px; padding:16px; display:flex; flex-direction:column; align-items:center;">
                <span style="font-weight:900; font-size:22px; color:var(--on-primary-container);">+${(stats.completed || 0) * 20} XP</span>
                <span style="font-weight:700; font-size:9px; text-transform:uppercase; letter-spacing:0.15em; color:var(--on-primary-container); opacity:0.7; margin-top:4px;">Experience</span>
              </div>
              <div style="background:var(--tertiary-container); border-radius:12px; padding:16px; display:flex; flex-direction:column; align-items:center;">
                <span style="font-weight:900; font-size:22px; color:var(--on-tertiary-container);">${stats.completed || 0}/${stats.total || 0}</span>
                <span style="font-weight:700; font-size:9px; text-transform:uppercase; letter-spacing:0.15em; color:var(--on-tertiary-container); opacity:0.7; margin-top:4px;">Lessons</span>
              </div>
            </div>
          </div>
          <div style="background:white; border-radius:12px; padding:20px; margin-bottom:20px; width:100%; max-width:320px; text-align:center;">
            <p style="font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:0.15em; color:var(--on-surface-variant); margin-bottom:12px;">Performance</p>
            <div class="session-complete__score">${stats.averageScore || 0}</div>
            <p class="session-complete__label">Average Score</p>
          </div>
          <div class="session-complete__actions" style="flex-direction:column; width:100%; max-width:320px;">
            <button style="background:var(--primary); color:var(--on-primary); width:100%; padding:16px; border-radius:12px; font-weight:900; font-size:16px; border:none; cursor:pointer; box-shadow:0 6px 0 #1a4700; transition:all 0.1s;" id="session-back-btn">Continue Practicing</button>
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
      const dotEl = document.getElementById('settings-midi-dot');
      const isConnected = this._midiController.isConnected;
      if (statusEl) {
        statusEl.textContent = isConnected ? 'Connected' : 'Disconnected';
      }
      if (deviceEl && isConnected) {
        deviceEl.textContent = this._midiController.inputPort?.name || 'MIDI Controller';
      }
      if (dotEl) {
        dotEl.style.background = isConnected ? '#2a6900' : '#b02500';
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

      // Stop waveform renderers when leaving practice view, restart when returning
      if (this._waveformRenderers) {
        if (view === 'practice') {
          this._waveformRenderers.A.restart();
          this._waveformRenderers.B.restart();
        } else {
          this._waveformRenderers.A.stop();
          this._waveformRenderers.B.stop();
        }
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

    // Level progress bar
    const levelProgressEl = document.getElementById('profile-level-progress');
    if (levelProgressEl) {
      const levelInfo = this._lessonEngine.progress.getLevel();
      const xpIntoLevel = summary.totalXP - levelInfo.xp;
      const xpNeeded = levelInfo.nextLevelXP - levelInfo.xp;
      const pct = xpNeeded > 0 && isFinite(xpNeeded)
        ? Math.min(100, Math.round((xpIntoLevel / xpNeeded) * 100))
        : 100;
      levelProgressEl.style.width = `${pct}%`;
    }
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

    const pathNodes = document.querySelectorAll('.learn-path-node');
    pathNodes.forEach((wrapper, i) => {
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

      // Update inner .learn-node classes
      const circle = wrapper.querySelector('.learn-node');
      if (circle) {
        circle.classList.remove('learn-node--complete', 'learn-node--active', 'learn-node--locked', 'learn-node--milestone');
        if (isComplete) circle.classList.add('learn-node--complete');
        else if (isActive) circle.classList.add('learn-node--active');
        else circle.classList.add('learn-node--locked');
      }

      // Update icon text content
      const icon = wrapper.querySelector('.material-symbols-outlined');
      if (icon) {
        if (isComplete) {
          icon.textContent = 'check';
          icon.style.fontVariationSettings = "'FILL' 1";
        } else if (isActive) {
          icon.textContent = 'music_note';
          icon.style.fontVariationSettings = "'FILL' 1";
        } else {
          icon.textContent = 'lock';
          icon.style.fontVariationSettings = '';
        }
      }

      // Add/remove START button for the active node
      const existingBtn = wrapper.querySelector('button');
      if (isActive && !existingBtn) {
        const btn = document.createElement('button');
        btn.className = 'mt-3 bg-primary text-white text-xs font-extrabold uppercase tracking-wider px-6 py-2 rounded-full shadow-[0_4px_0_#1a4700] active:translate-y-0.5 active:shadow-[0_2px_0_#1a4700] transition-all';
        btn.textContent = 'Start';
        wrapper.appendChild(btn);
      } else if (!isActive && existingBtn) {
        existingBtn.remove();
      }

      // Update clickability on the wrapper
      if (isLocked) {
        wrapper.removeAttribute('role');
        wrapper.removeAttribute('tabindex');
        wrapper.removeAttribute('data-lesson');
      } else {
        wrapper.setAttribute('role', 'button');
        wrapper.setAttribute('tabindex', '0');
        wrapper.setAttribute('data-lesson', entry.id);
      }
    });

    // Unit progress bar — completed / total lessons in the current unit
    const unitProgressEl = document.getElementById('learn-unit-progress');
    if (unitProgressEl) {
      const total = orderedIds.length;
      const completedCount = orderedIds.filter(id => completed.has(id)).length;
      const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
      unitProgressEl.style.width = `${pct}%`;
    }

    // Daily XP and daily progress widgets
    const dailyXpEl = document.getElementById('learn-daily-xp');
    const dailyProgressEl = document.getElementById('learn-daily-progress');
    if (dailyXpEl) dailyXpEl.textContent = String(summary.totalXP);
    if (dailyProgressEl) {
      // Show XP progress toward next level as the daily progress bar
      const levelInfo = this._lessonEngine.progress.getLevel();
      const xpIntoLevel = summary.totalXP - levelInfo.xp;
      const xpNeeded = levelInfo.nextLevelXP - levelInfo.xp;
      const pct = xpNeeded > 0 && isFinite(xpNeeded)
        ? Math.min(100, Math.round((xpIntoLevel / xpNeeded) * 100))
        : 100;
      dailyProgressEl.style.width = `${pct}%`;
    }
  }

  /** @private */
  _refreshStreakBadge(summary) {
    const countEl = document.getElementById('streak-count');
    if (countEl) countEl.textContent = String(summary.currentStreak);
    const labelEl = document.getElementById('streak-label');
    if (labelEl) labelEl.textContent = summary.currentStreak === 1 ? 'day' : 'days';
  }

  // ── Cue Handling ────────────────────────────────────────────

  /** @private */
  _setupCueHandling() {
    // UI sync buttons → copy pitch from other deck
    this._mixerUI.addEventListener('sync', (e) => {
      const { deck } = /** @type {CustomEvent} */ (e).detail;
      const otherDeck = deck === 'A' ? 'B' : 'A';
      const otherPitch = this._mixerState.get(otherDeck, 'pitch');
      this._mixerState.set(deck, 'pitch', otherPitch, 'ui');
    });

    this._mixerUI.addEventListener('cue', (e) => {
      const { deck } = /** @type {CustomEvent} */ (e).detail;
      if (this._decks[deck]) {
        this._decks[deck].cue();
      }
    });

    // UI pad buttons → hot cue set/jump
    this._mixerUI.addEventListener('pad', (e) => {
      const { deck, pad } = /** @type {CustomEvent} */ (e).detail;
      if (!this._decks[deck]) return;
      const cues = this._mixerState.get(deck, 'hotCues');
      const deckObj = this._decks[deck];
      const idx = pad - 1;
      if (cues[idx] === null) {
        // Set hot cue at current position
        cues[idx] = deckObj.currentTime;
        this._mixerState.set(deck, 'hotCues', [...cues], 'ui');
      } else {
        // Jump to hot cue
        deckObj.setCuePoint(cues[idx]);
        deckObj.cue();
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

  // ── Cloud Sync ────────────────────────────────────────────────

  /**
   * Enable Supabase cloud sync for all persistence layers.
   * Call this after auth is confirmed and app is initialized.
   * @param {import('@supabase/supabase-js').SupabaseClient} supabase
   * @param {import('@supabase/supabase-js').User} user
   */
  async setCloudSync(supabase, user) {
    this._supabase = supabase;
    this._userId = user.id;

    // Enable cloud sync on lesson engine (progress + spaced repetition)
    if (this._lessonEngine) {
      await this._lessonEngine.setCloudSync(supabase, user.id);
      // Re-render views with fresh cloud data
      this._refreshAllViews();
    }

    // Update profile name with email
    this._updateProfileEmail(user.email);
  }

  /**
   * Sign out the current user and reload the app to show auth screen.
   * @param {import('../auth/AuthManager.js').AuthManager} authManager
   */
  async signOut(authManager) {
    this._lessonEngine?.progress.endSession();
    await authManager.signOut();
    window.location.reload();
  }

  /** @private */
  _updateProfileEmail(email) {
    if (!email) return;
    const username = email.split('@')[0];
    const nameEl = document.querySelector('.profile-card__name');
    if (nameEl && nameEl.textContent === 'DJ Learner') {
      nameEl.textContent = username;
    }
    const emailEl = document.getElementById('profile-email');
    if (emailEl) emailEl.textContent = email;
  }

  // ── Hot Cue Persistence ─────────────────────────────────────

  /** @private */
  _saveHotCues(deck, trackName) {
    const cues = this._mixerState.get(deck, 'hotCues');
    // localStorage — immediate, offline-safe
    try {
      const key = 'onset:hotcues';
      const data = JSON.parse(localStorage.getItem(key) || '{}');
      data[trackName] = cues;
      localStorage.setItem(key, JSON.stringify(data));
    } catch { /* best-effort */ }

    // Supabase — fire-and-forget
    if (this._supabase && this._userId) {
      this._supabase
        .from('hot_cues')
        .upsert({
          user_id:    this._userId,
          track_name: trackName,
          cue_points: cues,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,track_name' })
        .then(({ error }) => {
          if (error) console.warn('[hot-cues] Cloud sync failed:', error.message);
        });
    }
  }

  /** @private */
  async _restoreHotCues(deck, trackName) {
    // Try Supabase first; fall back to localStorage
    if (this._supabase && this._userId) {
      try {
        const { data, error } = await this._supabase
          .from('hot_cues')
          .select('cue_points')
          .eq('user_id', this._userId)
          .eq('track_name', trackName)
          .maybeSingle();

        if (!error && data?.cue_points && Array.isArray(data.cue_points)) {
          this._mixerState.set(deck, 'hotCues', data.cue_points, 'audio');
          return;
        }
      } catch { /* fall through to localStorage */ }
    }

    // localStorage fallback
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
