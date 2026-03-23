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
import { MixerState } from './MixerState.js';
import { MixerUI } from './MixerUI.js';
import { MixerBridge } from './MixerBridge.js';
import { AppShell } from './AppShell.js';
import { LessonEngine } from '../lessons/LessonEngine.js';
import { PerformanceTips } from './PerformanceTips.js';
import { Toast } from './Toast.js';
import { ErrorOverlay } from './ErrorOverlay.js';

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

    // 7. Init MIDI (non-blocking — may fail if no permission or no device)
    await this._initMIDI();

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

    // 12. Create LessonEngine
    this._lessonEngine = new LessonEngine(this._mixerState);

    // 13. Create PerformanceTips
    this._tips = new PerformanceTips(this._mixerState);

    // 14. Set up track loading (file inputs + drag-drop)
    this._setupTrackLoading();

    // 15. Set up the startup overlay for first user gesture
    this._setupStartupOverlay();

    // 16. Set up MIDI connection status updates
    this._setupMIDIStatusUpdates();

    // 17. Set up mode switching
    this._setupModeSwitching();

    // 18. Init LessonEngine
    this._lessonEngine.init();

    // 19. Wire cue button events from MixerUI to decks
    this._setupCueHandling();

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
    this._midiController.addEventListener('connected', (e) => {
      const detail = /** @type {CustomEvent} */ (e).detail;
      // Create router and LED feedback when controller connects
      if (!this._midiRouter) {
        this._midiRouter = new MIDIRouter(this._midiController, herculesMapping);
        this._ledFeedback = new LEDFeedback(this._midiController);

        // If bridge already exists, we need to re-create it with the router
        if (this._mixerBridge && this._decks && this._crossfader) {
          this._mixerBridge = new MixerBridge(
            this._mixerState,
            this._decks,
            this._crossfader,
            this._midiRouter
          );
          this._mixerBridge.init();
        }
      }
    });

    this._midiController.addEventListener('error', () => {
      // Web MIDI not supported — no overlay, just update status
      if (this._shell) {
        this._shell.setConnectionStatus('no-midi');
      }
    });

    this._midiController.addEventListener('permission-denied', () => {
      if (this._shell) {
        this._shell.setConnectionStatus('no-midi');
      }
    });

    await this._midiController.init();

    // Set up router and LED feedback immediately if controller is already connected
    if (this._midiController.isConnected) {
      this._midiRouter = new MIDIRouter(this._midiController, herculesMapping);
      this._ledFeedback = new LEDFeedback(this._midiController);
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

      try {
        await this._engine.init();
      } catch (err) {
        ErrorOverlay.show(
          'Audio error',
          'Could not start the audio system. Please reload and try again.'
        );
        return;
      }

      // Remove overlay
      overlay.classList.remove('startup-overlay--visible');
      overlay.addEventListener('transitionend', () => {
        overlay.remove();
      }, { once: true });

      // Fallback removal
      setTimeout(() => {
        if (overlay.parentNode) overlay.remove();
      }, 500);

      // Remove listeners
      document.removeEventListener('click', resumeAudio);
      document.removeEventListener('keydown', resumeAudio);
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
  async _loadTrack(deckName, file) {
    const deck = this._decks[deckName];
    const renderer = this._waveformRenderers[deckName];

    try {
      // Load audio into deck
      await deck.loadTrack(file);

      // Update track name in UI
      const nameEl = document.getElementById(`track-name-${deckName.toLowerCase()}`);
      if (nameEl) {
        nameEl.textContent = file.name.replace(/\.[^/.]+$/, '');
      }

      // Generate waveform data from the decoded buffer
      const buffer = deck._buffer;
      if (buffer) {
        const waveformData = new WaveformData(buffer);
        waveformData.generate();

        // Set data on renderer and start rendering
        renderer.setData(waveformData);
        renderer.start(() => deck.currentTime);
      }
    } catch (err) {
      ErrorOverlay.show(
        'Could not load track',
        'The audio file could not be decoded. Please try a different file (MP3, WAV, OGG, or FLAC).'
      );
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
    this._tips.stop();
    this._lessonEngine.startSession();
  }

  /** @private */
  _enterFreePlayMode() {
    this._tips.start();
  }

  // ── Cue Handling ─────────────────────────────────────────────

  /** @private */
  _setupCueHandling() {
    this._mixerUI.addEventListener('cue', (e) => {
      const { deck } = /** @type {CustomEvent} */ (e).detail;
      if (this._decks[deck]) {
        this._decks[deck].cue();
      }
    });
  }
}
