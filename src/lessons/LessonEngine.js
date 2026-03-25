/**
 * LessonEngine — the core state machine orchestrating the lesson experience.
 *
 * States: idle → session_active → phase_watch → phase_imagine → phase_do →
 *         step_active → (step_scored → next step...) → lesson_complete →
 *         (next lesson... | session_complete)
 *
 * Integrates all lesson subsystems:
 *   - SessionManager: session structure and playlist
 *   - LessonLibrary: catalog and progression
 *   - InputValidator: MIDI/audio validation with immediate feedback
 *   - ScaffoldManager: fading guidance
 *   - ScoringEngine: variable reward scoring
 *   - SpacedRepetition: cross-session technique scheduling
 *   - LessonRenderer: all visual output
 */

import { InputValidator } from './InputValidator.js';
import { LessonRenderer } from './LessonRenderer.js';
import { LessonLibrary } from './LessonLibrary.js';
import { ScaffoldManager } from './ScaffoldManager.js';
import { ScoringEngine } from './ScoringEngine.js';
import { SpacedRepetition } from './SpacedRepetition.js';
import { SessionManager } from './SessionManager.js';
import { ProgressManager } from './ProgressManager.js';
import {
  trackSessionStarted,
  trackSessionEnded,
  trackLessonStarted,
  trackLessonCompleted,
  trackLessonAbandoned,
} from '../analytics.js';

/**
 * @typedef {'idle' | 'session_active' | 'phase_watch' | 'phase_imagine' | 'phase_do' | 'step_active' | 'step_scored' | 'lesson_complete' | 'session_complete'} EngineState
 */

export class LessonEngine extends EventTarget {
  /**
   * @param {import('../ui/MixerState.js').MixerState} mixerState
   */
  constructor(mixerState) {
    super();

    // Subsystems
    this._spacedRep = new SpacedRepetition();
    this._library = new LessonLibrary(this._spacedRep);
    this._scaffold = new ScaffoldManager();
    this._scoring = new ScoringEngine();
    this._validator = new InputValidator(mixerState);
    this._renderer = new LessonRenderer();
    this._session = new SessionManager(this._library);
    this._progress = new ProgressManager();

    /** @type {EngineState} */
    this._state = 'idle';

    /** @type {import('./lesson-schema.js').LessonDef | null} */
    this._currentLesson = null;

    /** @type {number} */
    this._phaseIndex = 0;

    /** @type {number} */
    this._stepIndex = 0;

    /** @type {import('./lesson-schema.js').LessonStep[]} All 'do' phase steps in current lesson */
    this._doSteps = [];

    /** @type {number | null} */
    this._imagineTimerId = null;

    /** @type {number | null} */
    this._timeLimitId = null;

    /** @type {number | null} */
    this._watchTimerId = null;

    /** @type {number | null} */
    this._scoreTimerId = null;

    /** @type {number} */
    this._stepScoreDisplayMs = 1500;

    // Wire up validator events
    this._validator.addEventListener('input-feedback', (e) => this._onInputFeedback(e));
    this._validator.addEventListener('step-complete', (e) => this._onStepComplete(e));
  }

  /** Initialize DOM references. Call after DOM is ready. */
  init() {
    this._renderer.init();
    this._renderer.renderIdle();
    this._bindUIEvents();
  }

  /**
   * Start a new practice session.
   */
  startSession() {
    const playlist = this._session.startSession();

    if (playlist.length === 0) {
      this._renderer.renderIdle();
      return;
    }

    this._progress.startSession();
    trackSessionStarted();
    this._state = 'session_active';
    this._renderer.renderSessionStart(playlist);
  }

  // ── State Machine Transitions ─────────────────────────

  /** Begin the next lesson in the session. */
  _advanceToNextLesson() {
    const lesson = this._session.nextLesson();

    if (!lesson) {
      this._completeSession();
      return;
    }

    this._currentLesson = lesson;
    this._phaseIndex = 0;
    this._lessonStartMs = performance.now();
    this._scoring.startLesson(lesson.id);
    trackLessonStarted({ lessonId: lesson.id, lessonName: lesson.title || lesson.id });

    // Collect all 'do' phase steps for progress tracking
    this._doSteps = [];
    for (const phase of lesson.phases) {
      if (phase.type === 'do' && phase.steps) {
        this._doSteps.push(...phase.steps);
      }
    }

    this._advanceToNextPhase();
  }

  /** Advance to the next phase in the current lesson. */
  _advanceToNextPhase() {
    if (!this._currentLesson) return;

    if (this._phaseIndex >= this._currentLesson.phases.length) {
      this._completeLesson();
      return;
    }

    const phase = this._currentLesson.phases[this._phaseIndex];

    switch (phase.type) {
      case 'watch':
        this._enterWatchPhase(phase);
        break;
      case 'imagine':
        this._enterImaginePhase(phase);
        break;
      case 'do':
        this._enterDoPhase(phase);
        break;
    }
  }

  // ── Watch Phase ───────────────────────────────────────

  /**
   * @param {import('./lesson-schema.js').LessonPhase} phase
   */
  _enterWatchPhase(phase) {
    this._state = 'phase_watch';
    this._stepIndex = 0;

    if (phase.steps && phase.steps.length > 0) {
      this._showWatchStep(phase.steps, 0);
    } else {
      this._phaseIndex += 1;
      this._advanceToNextPhase();
    }
  }

  /**
   * Show a watch-phase demo step, auto-advance after delay.
   * @param {import('./lesson-schema.js').LessonStep[]} steps
   * @param {number} index
   */
  _showWatchStep(steps, index) {
    if (index >= steps.length) {
      // Watch phase complete, advance
      this._phaseIndex += 1;
      this._advanceToNextPhase();
      return;
    }

    const step = steps[index];
    this._renderer.renderLessonHeader(this._currentLesson, index, steps.length);
    this._renderer.renderWatchPhase(step.instruction);

    // Auto-advance after 4 seconds per watch step
    this._watchTimerId = setTimeout(() => {
      this._watchTimerId = null;
      this._showWatchStep(steps, index + 1);
    }, 4000);
  }

  // ── Imagine Phase ─────────────────────────────────────

  /**
   * @param {import('./lesson-schema.js').LessonPhase} phase
   */
  _enterImaginePhase(phase) {
    this._state = 'phase_imagine';
    const duration = phase.durationMs || 5000;

    this._renderer.renderImaginePhase(phase.instruction, duration);

    this._imagineTimerId = setTimeout(() => {
      this._imagineTimerId = null;
      this._phaseIndex += 1;
      this._advanceToNextPhase();
    }, duration);
  }

  // ── Do Phase ──────────────────────────────────────────

  /**
   * @param {import('./lesson-schema.js').LessonPhase} phase
   */
  _enterDoPhase(phase) {
    this._state = 'phase_do';
    this._stepIndex = 0;

    if (phase.steps && phase.steps.length > 0) {
      this._activateStep(phase.steps, 0);
    } else {
      this._phaseIndex += 1;
      this._advanceToNextPhase();
    }
  }

  /**
   * Activate a do-phase step for user input.
   * @param {import('./lesson-schema.js').LessonStep[]} steps
   * @param {number} index
   */
  _activateStep(steps, index) {
    if (index >= steps.length) {
      this._phaseIndex += 1;
      this._advanceToNextPhase();
      return;
    }

    const step = steps[index];
    this._stepIndex = index;
    this._state = 'step_active';
    this._stepStartMs = performance.now();

    // Get scaffold level for this technique
    const scaffoldLevel = this._scaffold.getLevel(
      this._currentLesson.technique,
      this._currentLesson.phases.find((p) => p.type === 'do')?.scaffoldLevel || 'full'
    );
    const visuals = ScaffoldManager.getVisuals(scaffoldLevel);

    // Calculate overall do-step progress
    const overallIndex = this._doSteps.indexOf(step);
    this._renderer.renderLessonHeader(this._currentLesson, overallIndex >= 0 ? overallIndex : index, this._doSteps.length);
    this._renderer.renderDoStep(step, visuals);

    // Start validation
    this._validator.startValidating(step.target);

    // Set time limit if specified
    if (step.timeLimitMs) {
      this._timeLimitId = setTimeout(() => {
        this._timeLimitId = null;
        // Time's up — score what they've got
        this._scoreAndAdvance(step, steps, index, true);
      }, step.timeLimitMs);
    }
  }

  // ── Input Handling ────────────────────────────────────

  /**
   * Handle immediate feedback from InputValidator (every MIDI input).
   * @param {Event} event
   */
  _onInputFeedback(event) {
    if (this._state !== 'step_active') return;

    const detail = /** @type {CustomEvent} */ (event).detail;

    // Guitar Hero visual feedback
    if (detail.target && detail.target.deck) {
      const controlName = this._doSteps[this._stepIndex]?.highlight;
      if (controlName) {
        this._renderer.showInputFeedback(controlName, detail.proximity, detail.accuracy);
      }
    }
  }

  /**
   * Handle step completion from InputValidator (target reached).
   * @param {Event} event
   */
  _onStepComplete(event) {
    if (this._state !== 'step_active') return;

    const detail = /** @type {CustomEvent} */ (event).detail;
    const phase = this._currentLesson.phases.find((p) => p.type === 'do');
    if (!phase || !phase.steps) return;

    const step = phase.steps[this._stepIndex];
    this._scoreAndAdvance(step, phase.steps, this._stepIndex, false);
  }

  /**
   * Score the current step and advance.
   * @param {import('./lesson-schema.js').LessonStep} step
   * @param {import('./lesson-schema.js').LessonStep[]} steps
   * @param {number} index
   * @param {boolean} timedOut
   */
  _scoreAndAdvance(step, steps, index, timedOut) {
    // Stop validation and clear timers
    this._validator.stopValidating();
    if (this._timeLimitId) {
      clearTimeout(this._timeLimitId);
      this._timeLimitId = null;
    }

    this._state = 'step_scored';

    // Calculate scores
    const result = this._validator.validate(step.target);
    const elapsedMs = performance.now() - (this._stepStartMs || 0);

    // Calculate phrase alignment using beat grid if available, else neutral 50
    const actionTimeMs = performance.now() - (this._stepStartMs || 0);
    let phraseScore = 50;
    try {
      const deckA = document.getElementById('track-bpm-a')?.textContent;
      const deckB = document.getElementById('track-bpm-b')?.textContent;
      const bpmText = deckA || deckB || '';
      const bpmMatch = bpmText.match(/(\d+)/);
      const bpm = bpmMatch ? parseInt(bpmMatch[1], 10) : 0;
      if (bpm > 0) {
        // Approximate a beat grid from BPM (no pre-computed grid available)
        const beatInterval = 60 / bpm;
        const numBeats = Math.ceil(300 / beatInterval); // ~5 minutes of beats
        const beatGrid = Array.from({ length: numBeats }, (_, i) => i * beatInterval);
        phraseScore = ScoringEngine.calcPhraseAlignment(actionTimeMs, beatGrid, bpm);
      }
    } catch { /* fall back to neutral 50 */ }

    const rawScores = {
      accuracy: timedOut ? Math.min(result.accuracy, 40) : result.accuracy,
      timing: ScoringEngine.calcTiming(elapsedMs, step.timeLimitMs),
      phrase: phraseScore,
    };

    const stepScore = this._scoring.scoreStep(step.id, rawScores, step.scoreWeights);
    const passed = stepScore.weighted >= 50;

    // Update scaffold
    this._scaffold.recordResult(this._currentLesson.technique, passed);

    // Show score briefly
    this._renderer.renderStepScore(stepScore);

    // Advance after score display
    this._scoreTimerId = setTimeout(() => {
      this._scoreTimerId = null;
      this._activateStep(steps, index + 1);
    }, this._stepScoreDisplayMs);
  }

  // ── Lesson & Session Completion ───────────────────────

  _completeLesson() {
    this._state = 'lesson_complete';

    const lessonScore = this._scoring.finishLesson();

    // Record in library and spaced repetition
    this._library.recordCompletion(this._currentLesson.id, lessonScore.score);
    this._spacedRep.recordAttempt(
      this._currentLesson.technique,
      SpacedRepetition.scoreToQuality(lessonScore.score)
    );

    // Record in progress manager (XP, streaks, lesson tracking)
    this._progress.recordLessonComplete(
      this._currentLesson.id,
      lessonScore.score,
      this._currentLesson.category
    );

    // Update session rolling accuracy
    this._session.recordLessonScore(lessonScore.score);

    const lessonDurationMs = Math.round(performance.now() - (this._lessonStartMs || 0));
    trackLessonCompleted({
      lessonId: this._currentLesson.id,
      score: lessonScore.score,
      durationMs: lessonDurationMs,
    });

    this._renderer.renderLessonComplete(lessonScore, this._session.isLastLesson);

    this.dispatchEvent(new CustomEvent('lesson-complete', {
      detail: { lessonId: this._currentLesson.id, score: lessonScore },
    }));
  }

  _completeSession() {
    this._state = 'session_complete';

    // Clear any in-flight phase timers
    if (this._watchTimerId) { clearTimeout(this._watchTimerId); this._watchTimerId = null; }
    if (this._scoreTimerId) { clearTimeout(this._scoreTimerId); this._scoreTimerId = null; }
    if (this._imagineTimerId) { clearTimeout(this._imagineTimerId); this._imagineTimerId = null; }
    if (this._timeLimitId) { clearTimeout(this._timeLimitId); this._timeLimitId = null; }

    // If a lesson was in-flight, track it as abandoned
    const inFlightStates = ['phase_watch', 'phase_imagine', 'phase_do', 'step_active', 'step_scored'];
    if (this._currentLesson && inFlightStates.includes(this._state)) {
      const phaseMap = {
        phase_watch: 'Watch',
        phase_imagine: 'Imagine',
        phase_do: 'Do',
        step_active: 'Do',
        step_scored: 'Do',
      };
      trackLessonAbandoned({
        lessonId: this._currentLesson.id,
        phase: phaseMap[this._state] || 'Watch',
      });
    }

    this._session.endSession();
    this._progress.endSession();

    const summary = this._progress.getSummary();
    trackSessionEnded({
      totalXP: summary.totalXP,
      lessonsCompleted: summary.lessonsCompleted,
    });

    const stats = this._library.getStats();
    this._renderer.renderSessionComplete(stats);

    this.dispatchEvent(new CustomEvent('session-complete', { detail: stats }));
  }

  // ── UI Event Bindings ─────────────────────────────────

  _bindUIEvents() {
    // Use event delegation on the lesson panel
    const panel = document.querySelector('.lesson-panel');
    if (!panel) return;

    panel.addEventListener('click', (e) => {
      const target = /** @type {HTMLElement} */ (e.target);

      if (target.id === 'start-session-btn') {
        this._advanceToNextLesson();
      } else if (target.id === 'next-lesson-btn') {
        this._advanceToNextLesson();
      } else if (target.id === 'end-session-btn') {
        this._completeSession();
      }
    });
  }

  // ── Public API ────────────────────────────────────────

  /** @returns {EngineState} */
  get state() {
    return this._state;
  }

  /** @returns {import('./LessonLibrary.js').LessonLibrary} */
  get library() {
    return this._library;
  }

  /** @returns {import('./SessionManager.js').SessionManager} */
  get session() {
    return this._session;
  }

  /** @returns {import('./ProgressManager.js').ProgressManager} */
  get progress() {
    return this._progress;
  }

  /**
   * Enable Supabase cloud sync for both ProgressManager and SpacedRepetition.
   * Call this after auth is confirmed.
   * @param {import('@supabase/supabase-js').SupabaseClient} supabase
   * @param {string} userId
   */
  async setCloudSync(supabase, userId) {
    await Promise.all([
      this._progress.setCloudSync(supabase, userId),
      this._spacedRep.setCloudSync(supabase, userId),
    ]);
  }

  /** Clean up timers and listeners. */
  destroy() {
    if (this._imagineTimerId) clearTimeout(this._imagineTimerId);
    if (this._timeLimitId) clearTimeout(this._timeLimitId);
    if (this._watchTimerId) clearTimeout(this._watchTimerId);
    if (this._scoreTimerId) clearTimeout(this._scoreTimerId);
    this._validator.destroy();
  }
}
