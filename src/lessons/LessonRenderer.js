/**
 * LessonRenderer — renders lesson state in the lesson panel and provides
 * Guitar Hero-style visual feedback on mixer controls.
 *
 * Immediate feedback on every MIDI input:
 *   hit  → green glow on control
 *   hot  → yellow glow
 *   warm → orange glow
 *   cold → red glow
 *
 * Scaffold visuals:
 *   full    → highlight control + target marker + direction arrow + instruction
 *   partial → highlight control + instruction
 *   minimal → instruction only
 */

export class LessonRenderer {
  constructor() {
    /** @type {HTMLElement | null} */
    this._contentEl = null;
    /** @type {HTMLElement | null} */
    this._progressEl = null;
    /** @type {HTMLElement | null} */
    this._headerEl = null;

    /** @type {Map<string, HTMLElement>} control name → overlay element */
    this._overlays = new Map();

    /** @type {number | null} */
    this._feedbackTimeout = null;
  }

  /** Initialize DOM references. */
  init() {
    this._contentEl = document.getElementById('lesson-content');
    this._progressEl = document.getElementById('lesson-progress');
    this._headerEl = document.querySelector('.lesson-panel__header h2');
  }

  /**
   * Show session start screen.
   * @param {import('./lesson-schema.js').LessonDef[]} lessons
   */
  renderSessionStart(lessons) {
    if (!this._contentEl) return;

    const totalMinutes = lessons.reduce((sum, l) => sum + l.estimatedMinutes, 0);

    this._contentEl.innerHTML = `
      <div class="lesson-session-start">
        <h3 class="lesson-title">today's session</h3>
        <p class="lesson-meta">${lessons.length} lessons · ~${totalMinutes} min</p>
        <ul class="lesson-session-list">
          ${lessons.map((l, i) => `
            <li class="lesson-session-item">
              <span class="lesson-session-num">${i + 1}</span>
              <span class="lesson-session-name">${l.title}</span>
              <span class="lesson-session-cat">${l.category}</span>
            </li>
          `).join('')}
        </ul>
        <button class="btn btn--deck-a glow-a lesson-start-btn" id="start-session-btn">
          start session
        </button>
      </div>
    `;
  }

  /**
   * Render lesson title and progress bar.
   * @param {import('./lesson-schema.js').LessonDef} lesson
   * @param {number} stepIndex — current step (0-based)
   * @param {number} totalSteps
   */
  renderLessonHeader(lesson, stepIndex, totalSteps) {
    if (this._headerEl) {
      this._headerEl.textContent = lesson.title;
    }
    if (this._progressEl) {
      this._progressEl.textContent = `${stepIndex + 1} / ${totalSteps}`;
    }
  }

  /**
   * Render the "watch" phase — demo instructions.
   * @param {string} instruction
   */
  renderWatchPhase(instruction) {
    if (!this._contentEl) return;
    this._contentEl.innerHTML = `
      <div class="lesson-phase lesson-phase--watch">
        <div class="phase-badge">watch</div>
        <p class="lesson-instruction">${instruction}</p>
        <p class="lesson-hint">observe the technique being demonstrated</p>
      </div>
    `;
  }

  /**
   * Render the "imagine" phase.
   * @param {string} instruction
   * @param {number} durationMs
   */
  renderImaginePhase(instruction, durationMs) {
    if (!this._contentEl) return;
    this._contentEl.innerHTML = `
      <div class="lesson-phase lesson-phase--imagine">
        <div class="phase-badge">imagine</div>
        <p class="lesson-instruction">${instruction}</p>
        <div class="imagine-timer">
          <div class="imagine-timer__bar" style="animation-duration: ${durationMs}ms"></div>
        </div>
      </div>
    `;
  }

  /**
   * Render an active "do" step with scaffold-appropriate visuals.
   * @param {import('./lesson-schema.js').LessonStep} step
   * @param {{ showHighlight: boolean, showTarget: boolean, showArrow: boolean, showText: boolean }} visuals
   */
  renderDoStep(step, visuals) {
    if (!this._contentEl) return;

    this._contentEl.innerHTML = `
      <div class="lesson-phase lesson-phase--do">
        <div class="phase-badge">your turn</div>
        ${visuals.showText ? `<p class="lesson-instruction">${step.instruction}</p>` : ''}
        ${visuals.showTarget && step.target.value !== undefined ? `
          <div class="lesson-target">
            <span class="lesson-target__label">target</span>
            <span class="lesson-target__value">${this._formatTargetValue(step.target)}</span>
          </div>
        ` : ''}
      </div>
    `;

    // Highlight the physical control on the mixer
    if (visuals.showHighlight && step.highlight) {
      this._highlightControl(step.highlight, visuals.showTarget, visuals.showArrow);
    } else {
      this._clearHighlights();
    }
  }

  /**
   * Show immediate feedback on a control (Guitar Hero moment).
   * @param {string} controlName — MIDI control name
   * @param {'hit' | 'hot' | 'warm' | 'cold'} proximity
   * @param {number} accuracy — 0-100
   */
  showInputFeedback(controlName, proximity, accuracy) {
    // Map control names to DOM element IDs
    const elementId = this._controlToElementId(controlName);
    if (!elementId) return;

    const el = document.getElementById(elementId);
    if (!el) return;

    // Remove previous feedback classes
    el.classList.remove('feedback-hit', 'feedback-hot', 'feedback-warm', 'feedback-cold');

    // Add new feedback class
    el.classList.add(`feedback-${proximity}`);

    // Clear after brief display
    if (this._feedbackTimeout) clearTimeout(this._feedbackTimeout);
    this._feedbackTimeout = setTimeout(() => {
      el.classList.remove('feedback-hit', 'feedback-hot', 'feedback-warm', 'feedback-cold');
    }, 300);
  }

  /**
   * Render step completion with score.
   * @param {import('./ScoringEngine.js').StepScore} score
   */
  renderStepScore(score) {
    if (!this._contentEl) return;

    const ratingClass = score.weighted >= 90 ? 'perfect' : score.weighted >= 70 ? 'good' : score.weighted >= 50 ? 'ok' : 'miss';

    this._contentEl.innerHTML = `
      <div class="lesson-score lesson-score--${ratingClass}">
        <div class="lesson-score__value">${score.weighted}</div>
        <div class="lesson-score__label">${this._scoreLabel(score.weighted)}</div>
        ${score.isPerfect ? '<div class="lesson-score__perfect">perfect!</div>' : ''}
        <div class="lesson-score__breakdown">
          <span>accuracy: ${score.accuracy}</span>
          <span>timing: ${score.timing}</span>
          <span>phrase: ${score.phrase}</span>
        </div>
      </div>
    `;

    this._clearHighlights();
  }

  /**
   * Render lesson completion summary.
   * @param {import('./ScoringEngine.js').LessonScore} lessonScore
   * @param {boolean} isLastInSession
   */
  renderLessonComplete(lessonScore, isLastInSession) {
    if (!this._contentEl) return;

    this._contentEl.innerHTML = `
      <div class="lesson-complete">
        <h3 class="lesson-complete__title">lesson complete</h3>
        <div class="lesson-complete__score">${lessonScore.score}</div>
        ${lessonScore.isPersonalBest ? '<div class="lesson-complete__pb">new personal best!</div>' : ''}
        <div class="lesson-complete__stats">
          <span>best streak: ${lessonScore.maxStreak}</span>
        </div>
        ${isLastInSession
          ? '<p class="lesson-complete__hint">great session — good place to take a break</p>'
          : '<button class="btn btn--deck-a glow-a" id="next-lesson-btn">next lesson</button>'
        }
        <button class="btn btn--ghost" id="end-session-btn">end session</button>
      </div>
    `;

    this._clearHighlights();
  }

  /**
   * Render session complete screen.
   * @param {{ completed: number, total: number, averageScore: number }} stats
   */
  renderSessionComplete(stats) {
    if (!this._contentEl) return;
    this._contentEl.innerHTML = `
      <div class="lesson-session-end">
        <h3 class="lesson-title">session complete</h3>
        <div class="lesson-session-stats">
          <span>${stats.completed} / ${stats.total} lessons completed</span>
          <span>avg score: ${stats.averageScore}</span>
        </div>
        <p class="lesson-hint">see you next session</p>
      </div>
    `;
  }

  /** Render idle state. */
  renderIdle() {
    if (!this._contentEl) return;
    this._contentEl.innerHTML = `
      <p class="lesson-panel__placeholder">load a track to get started</p>
    `;
    if (this._headerEl) this._headerEl.textContent = 'lessons';
    if (this._progressEl) this._progressEl.textContent = '';
    this._clearHighlights();
  }

  // ── Private helpers ───────────────────────────────────

  /**
   * Highlight a mixer control with scaffold visuals.
   * @private
   */
  _highlightControl(controlName, showTarget, showArrow) {
    this._clearHighlights();

    const elementId = this._controlToElementId(controlName);
    if (!elementId) return;

    const el = document.getElementById(elementId);
    if (!el) return;

    el.classList.add('lesson-highlight');
    if (showTarget) el.classList.add('lesson-highlight--target');
    if (showArrow) el.classList.add('lesson-highlight--arrow');
  }

  /** @private */
  _clearHighlights() {
    document.querySelectorAll('.lesson-highlight').forEach((el) => {
      el.classList.remove('lesson-highlight', 'lesson-highlight--target', 'lesson-highlight--arrow');
    });
  }

  /**
   * Map MIDI control names to DOM element IDs.
   * @private
   * @param {string} controlName — e.g. 'deck-a:eq-low', 'deck-b:pitch'
   * @returns {string | null}
   */
  _controlToElementId(controlName) {
    const map = {
      'deck-a:play': 'play-a',
      'deck-b:play': 'play-b',
      'deck-a:cue': 'cue-a',
      'deck-b:cue': 'cue-b',
      'deck-a:sync': 'sync-a',
      'deck-b:sync': 'sync-b',
      'deck-a:gain': 'gain-a',
      'deck-b:gain': 'gain-b',
      'deck-a:volume': 'volume-a',
      'deck-b:volume': 'volume-b',
      'deck-a:eq-high': 'eq-high-a',
      'deck-b:eq-high': 'eq-high-b',
      'deck-a:eq-mid': 'eq-mid-a',
      'deck-b:eq-mid': 'eq-mid-b',
      'deck-a:eq-low': 'eq-low-a',
      'deck-b:eq-low': 'eq-low-b',
      'deck-a:filter': 'filter-a',
      'deck-b:filter': 'filter-b',
      'deck-a:pitch': 'pitch-a',
      'deck-b:pitch': 'pitch-b',
      'deck-a:pad-1': 'pad-1-a',
      'deck-a:pad-2': 'pad-2-a',
      'deck-a:pad-3': 'pad-3-a',
      'deck-a:pad-4': 'pad-4-a',
      'deck-b:pad-1': 'pad-1-b',
      'deck-b:pad-2': 'pad-2-b',
      'deck-b:pad-3': 'pad-3-b',
      'deck-b:pad-4': 'pad-4-b',
      'deck-a:jog-rotate': null,
      'deck-b:jog-rotate': null,
      'crossfader': 'crossfader',
    };
    return map[controlName] ?? null;
  }

  /**
   * Format a target value for display.
   * @private
   */
  _formatTargetValue(target) {
    switch (target.type) {
      case 'volume_value':
        return `${Math.round(target.value * 100)}%`;
      case 'eq_value':
      case 'eq_kill':
        return `${target.value > 0 ? '+' : ''}${target.value} dB`;
      case 'crossfader_position':
        return target.value === 0 ? 'center' : target.value < 0 ? `${Math.round(target.value * 100)}% A` : `${Math.round(target.value * 100)}% B`;
      case 'pitch_match':
        return 'match BPM';
      default:
        return '';
    }
  }

  /**
   * Convert score to human label.
   * @private
   */
  _scoreLabel(score) {
    if (score >= 95) return 'flawless';
    if (score >= 85) return 'excellent';
    if (score >= 70) return 'solid';
    if (score >= 50) return 'getting there';
    return 'keep practicing';
  }
}
