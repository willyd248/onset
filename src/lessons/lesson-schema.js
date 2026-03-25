/**
 * Lesson schema definitions, built-in lesson catalog, and technique categories.
 *
 * Lesson structure follows the watch-imagine-do sequence:
 *   1. Watch: app demos the technique (auto-plays the moves)
 *   2. Imagine: brief pause to visualize
 *   3. Do: user performs with scaffolded guidance that fades
 */

/**
 * @typedef {'transitions' | 'beatmatching' | 'eq-mixing' | 'effects' | 'basics'} TechniqueCategory
 *
 * @typedef {Object} LessonStep
 * @property {string} id
 * @property {string} instruction — text shown to the user
 * @property {string} [highlight] — MIDI control name to highlight (e.g. 'deck-b:pitch')
 * @property {TargetSpec} target — what the user needs to achieve
 * @property {number | null} [timeLimitMs] — optional time limit
 * @property {{ accuracy: number, timing: number, phrase: number }} scoreWeights
 *
 * @typedef {Object} TargetSpec
 * @property {'pitch_match' | 'eq_value' | 'crossfader_position' | 'beat_aligned' | 'volume_value' | 'eq_kill' | 'button_press'} type
 * @property {number} [tolerance] — acceptable deviation from target
 * @property {number} [value] — exact target value (for eq_value, crossfader_position, volume_value)
 * @property {'A' | 'B'} [deck] — which deck to validate against
 * @property {string} [param] — state parameter name
 *
 * @typedef {Object} LessonPhase
 * @property {'watch' | 'imagine' | 'do'} type
 * @property {LessonStep[]} [steps] — for 'watch' and 'do' phases
 * @property {string} [instruction] — for 'imagine' phase
 * @property {number} [durationMs] — for 'imagine' phase
 * @property {'full' | 'partial' | 'minimal'} [scaffoldLevel] — initial scaffold for 'do' phase
 *
 * @typedef {Object} LessonDef
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {TechniqueCategory} category
 * @property {string} technique — specific technique name
 * @property {number} difficulty — 1-5
 * @property {number} estimatedMinutes
 * @property {string[]} prerequisiteIds
 * @property {LessonPhase[]} phases
 */

// Import curriculum lesson data
import setupBasicsData from './data/01-setup-basics.json';
import beatmatchingData from './data/02-beatmatching.json';
import eqMixingData from './data/03-eq-mixing.json';
import transitionsData from './data/04-transitions.json';

// Import expanded lesson catalog — beginner tier
import crossfaderBasicsData from './data/05-crossfader-basics.json';
import beatmatchByEarData from './data/06-beatmatch-by-ear.json';
import gainStagingData from './data/07-gain-staging.json';
import hotCuesData from './data/08-hot-cues.json';
import babyScratchData from './data/09-baby-scratch.json';
import loopBasicsData from './data/10-loop-basics.json';
import trackSelectionData from './data/11-track-selection.json';
import eqIncomingTrackData from './data/12-eq-incoming-track.json';

// Import expanded lesson catalog — intermediate tier
import dropMixingData from './data/13-drop-mixing.json';
import filterTransitionsData from './data/14-filter-transitions.json';
import phraseMatchingData from './data/15-phrase-matching.json';
import eqSwapTechniqueData from './data/16-eq-swap-technique.json';
import spinbackData from './data/17-spinback.json';
import tensionEffectsData from './data/18-tension-effects.json';
import waveformReadingData from './data/19-waveform-reading.json';

// Import expanded lesson catalog — advanced tier
import harmonicMixingData from './data/20-harmonic-mixing.json';
import powerCutsData from './data/21-power-cuts.json';
import multiDeckConceptsData from './data/22-multi-deck-concepts.json';
import liveMashupData from './data/23-live-mashup.json';
import setPlanningData from './data/24-set-planning.json';

/** @type {LessonDef[]} */
export const LESSON_CATALOG = [
  // ── Basics ────────────────────────────────────────────
  {
    id: 'basics-load-play',
    title: 'Load & Play',
    description: 'Load a track onto a deck and start playback',
    category: 'basics',
    technique: 'load-play',
    difficulty: 1,
    estimatedMinutes: 2,
    prerequisiteIds: [],
    phases: [
      {
        type: 'watch',
        steps: [
          { id: 'w1', instruction: 'Watch: drag an audio file onto Deck A', highlight: null, target: { type: 'button_press' }, scoreWeights: { accuracy: 1, timing: 0, phrase: 0 } },
          { id: 'w2', instruction: 'Watch: press Play on Deck A', highlight: 'deck-a:play', target: { type: 'button_press' }, scoreWeights: { accuracy: 1, timing: 0, phrase: 0 } },
        ],
      },
      { type: 'imagine', instruction: 'Visualize loading a track and pressing play.', durationMs: 3000 },
      {
        type: 'do',
        scaffoldLevel: 'full',
        steps: [
          { id: 'd1', instruction: 'Press Play on Deck A', highlight: 'deck-a:play', target: { type: 'button_press', deck: 'A', param: 'isPlaying' }, scoreWeights: { accuracy: 1, timing: 0, phrase: 0 } },
          { id: 'd2', instruction: 'Adjust the volume fader on Deck A to 80%', highlight: 'deck-a:volume', target: { type: 'volume_value', deck: 'A', value: 0.8, tolerance: 0.1 }, scoreWeights: { accuracy: 0.8, timing: 0.2, phrase: 0 } },
        ],
      },
    ],
  },
  {
    id: 'basics-eq-sweep',
    title: 'EQ Sweep',
    description: 'Learn how EQ knobs shape the sound — cut and boost lows and highs',
    category: 'basics',
    technique: 'eq-sweep',
    difficulty: 1,
    estimatedMinutes: 3,
    prerequisiteIds: ['basics-load-play'],
    phases: [
      {
        type: 'watch',
        steps: [
          { id: 'w1', instruction: 'Watch: turn the LOW EQ knob all the way down to kill the bass', highlight: 'deck-a:eq-low', target: { type: 'eq_value', deck: 'A', param: 'eqLow', value: -24, tolerance: 3 }, scoreWeights: { accuracy: 1, timing: 0, phrase: 0 } },
          { id: 'w2', instruction: 'Watch: bring the LOW EQ back to center', highlight: 'deck-a:eq-low', target: { type: 'eq_value', deck: 'A', param: 'eqLow', value: 0, tolerance: 3 }, scoreWeights: { accuracy: 1, timing: 0, phrase: 0 } },
        ],
      },
      { type: 'imagine', instruction: 'Imagine turning the low EQ down and hearing the bass disappear, then bringing it back.', durationMs: 4000 },
      {
        type: 'do',
        scaffoldLevel: 'full',
        steps: [
          { id: 'd1', instruction: 'Kill the bass — turn LOW EQ all the way down', highlight: 'deck-a:eq-low', target: { type: 'eq_value', deck: 'A', param: 'eqLow', value: -24, tolerance: 4 }, scoreWeights: { accuracy: 0.7, timing: 0.3, phrase: 0 } },
          { id: 'd2', instruction: 'Now bring the bass back to center (0 dB)', highlight: 'deck-a:eq-low', target: { type: 'eq_value', deck: 'A', param: 'eqLow', value: 0, tolerance: 3 }, scoreWeights: { accuracy: 0.7, timing: 0.3, phrase: 0 } },
          { id: 'd3', instruction: 'Cut the highs — turn HIGH EQ all the way down', highlight: 'deck-a:eq-high', target: { type: 'eq_value', deck: 'A', param: 'eqHigh', value: -24, tolerance: 4 }, scoreWeights: { accuracy: 0.7, timing: 0.3, phrase: 0 } },
          { id: 'd4', instruction: 'Bring the highs back to center', highlight: 'deck-a:eq-high', target: { type: 'eq_value', deck: 'A', param: 'eqHigh', value: 0, tolerance: 3 }, scoreWeights: { accuracy: 0.7, timing: 0.3, phrase: 0 } },
        ],
      },
    ],
  },

  // ── Beatmatching ──────────────────────────────────────
  {
    id: 'beatmatch-pitch',
    title: 'Pitch Matching',
    description: 'Match the BPM of Deck B to Deck A using the pitch fader',
    category: 'beatmatching',
    technique: 'pitch-match',
    difficulty: 2,
    estimatedMinutes: 4,
    prerequisiteIds: ['basics-load-play'],
    phases: [
      {
        type: 'watch',
        steps: [
          { id: 'w1', instruction: 'Watch: the pitch fader adjusts Deck B\'s tempo to match Deck A', highlight: 'deck-b:pitch', target: { type: 'pitch_match', tolerance: 1 }, scoreWeights: { accuracy: 1, timing: 0, phrase: 0 } },
        ],
      },
      { type: 'imagine', instruction: 'Listen to both tracks. Imagine sliding the pitch fader until the beats align.', durationMs: 5000 },
      {
        type: 'do',
        scaffoldLevel: 'full',
        steps: [
          { id: 'd1', instruction: 'Match Deck B\'s BPM to Deck A — adjust the pitch fader', highlight: 'deck-b:pitch', target: { type: 'pitch_match', tolerance: 2 }, timeLimitMs: 30000, scoreWeights: { accuracy: 0.6, timing: 0.3, phrase: 0.1 } },
        ],
      },
    ],
  },
  {
    id: 'beatmatch-phase',
    title: 'Phase Alignment',
    description: 'Nudge Deck B so its beats land on top of Deck A\'s beats',
    category: 'beatmatching',
    technique: 'phase-align',
    difficulty: 3,
    estimatedMinutes: 5,
    prerequisiteIds: ['beatmatch-pitch'],
    phases: [
      {
        type: 'watch',
        steps: [
          { id: 'w1', instruction: 'Watch: the jog wheel nudges Deck B until beats are perfectly aligned', highlight: 'deck-b:jog-rotate', target: { type: 'beat_aligned', tolerance: 50 }, scoreWeights: { accuracy: 1, timing: 0, phrase: 0 } },
        ],
      },
      { type: 'imagine', instruction: 'Listen for the "flamming" of misaligned kicks. Imagine nudging until they snap together.', durationMs: 5000 },
      {
        type: 'do',
        scaffoldLevel: 'full',
        steps: [
          { id: 'd1', instruction: 'Nudge Deck B\'s jog wheel to align the beats with Deck A', highlight: 'deck-b:jog-rotate', target: { type: 'beat_aligned', tolerance: 80 }, timeLimitMs: 45000, scoreWeights: { accuracy: 0.5, timing: 0.2, phrase: 0.3 } },
        ],
      },
    ],
  },

  // ── Transitions ───────────────────────────────────────
  {
    id: 'transition-bass-swap',
    title: 'The Bass Swap',
    description: 'The fundamental transition — swap bass frequencies between decks at a phrase boundary',
    category: 'transitions',
    technique: 'bass-swap',
    difficulty: 2,
    estimatedMinutes: 5,
    prerequisiteIds: ['basics-eq-sweep', 'beatmatch-pitch'],
    phases: [
      {
        type: 'watch',
        steps: [
          { id: 'w1', instruction: 'Watch: bring Deck B\'s volume up to match Deck A', highlight: 'deck-b:volume', target: { type: 'volume_value', deck: 'B', value: 0.8, tolerance: 0.1 }, scoreWeights: { accuracy: 1, timing: 0, phrase: 0 } },
          { id: 'w2', instruction: 'Watch: at the phrase boundary, kill Deck A\'s bass and bring in Deck B\'s bass', highlight: 'deck-a:eq-low', target: { type: 'eq_kill', deck: 'A', param: 'eqLow' }, scoreWeights: { accuracy: 0.5, timing: 0.2, phrase: 0.3 } },
        ],
      },
      { type: 'imagine', instruction: 'Both tracks playing. At the phrase drop, swap which deck owns the bass. Feel the energy shift.', durationMs: 5000 },
      {
        type: 'do',
        scaffoldLevel: 'full',
        steps: [
          { id: 'd1', instruction: 'Bring Deck B\'s volume up to 80%', highlight: 'deck-b:volume', target: { type: 'volume_value', deck: 'B', value: 0.8, tolerance: 0.15 }, scoreWeights: { accuracy: 0.8, timing: 0.2, phrase: 0 } },
          { id: 'd2', instruction: 'Kill Deck A\'s bass — turn LOW EQ all the way down', highlight: 'deck-a:eq-low', target: { type: 'eq_value', deck: 'A', param: 'eqLow', value: -24, tolerance: 4 }, timeLimitMs: 15000, scoreWeights: { accuracy: 0.4, timing: 0.2, phrase: 0.4 } },
          { id: 'd3', instruction: 'Now bring Deck B\'s bass back to full', highlight: 'deck-b:eq-low', target: { type: 'eq_value', deck: 'B', param: 'eqLow', value: 0, tolerance: 3 }, timeLimitMs: 5000, scoreWeights: { accuracy: 0.5, timing: 0.3, phrase: 0.2 } },
          { id: 'd4', instruction: 'Fade Deck A\'s volume down to 0', highlight: 'deck-a:volume', target: { type: 'volume_value', deck: 'A', value: 0, tolerance: 0.1 }, timeLimitMs: 20000, scoreWeights: { accuracy: 0.6, timing: 0.4, phrase: 0 } },
        ],
      },
    ],
  },

  // ── EQ Mixing ─────────────────────────────────────────
  {
    id: 'eq-mix-frequency-swap',
    title: 'Frequency Swap',
    description: 'Swap mids and highs between decks for a smooth blend',
    category: 'eq-mixing',
    technique: 'frequency-swap',
    difficulty: 3,
    estimatedMinutes: 5,
    prerequisiteIds: ['transition-bass-swap'],
    phases: [
      {
        type: 'watch',
        steps: [
          { id: 'w1', instruction: 'Watch: cut Deck A\'s highs while boosting Deck B\'s', highlight: 'deck-a:eq-high', target: { type: 'eq_value', deck: 'A', param: 'eqHigh', value: -24, tolerance: 4 }, scoreWeights: { accuracy: 1, timing: 0, phrase: 0 } },
        ],
      },
      { type: 'imagine', instruction: 'Imagine sculpting the frequency space — each deck owns different bands.', durationMs: 4000 },
      {
        type: 'do',
        scaffoldLevel: 'full',
        steps: [
          { id: 'd1', instruction: 'Cut Deck A\'s highs (turn HIGH EQ down)', highlight: 'deck-a:eq-high', target: { type: 'eq_value', deck: 'A', param: 'eqHigh', value: -24, tolerance: 4 }, scoreWeights: { accuracy: 0.6, timing: 0.2, phrase: 0.2 } },
          { id: 'd2', instruction: 'Bring Deck B\'s highs to center', highlight: 'deck-b:eq-high', target: { type: 'eq_value', deck: 'B', param: 'eqHigh', value: 0, tolerance: 3 }, scoreWeights: { accuracy: 0.6, timing: 0.2, phrase: 0.2 } },
          { id: 'd3', instruction: 'Now swap the bass — kill A\'s bass and bring B\'s back', highlight: 'deck-a:eq-low', target: { type: 'eq_value', deck: 'A', param: 'eqLow', value: -24, tolerance: 4 }, scoreWeights: { accuracy: 0.4, timing: 0.2, phrase: 0.4 } },
        ],
      },
    ],
  },

  // ── Curriculum (Full Course) ──────────────────────────
  setupBasicsData,
  beatmatchingData,
  eqMixingData,
  transitionsData,

  // ── Expanded Catalog — Beginner ───────────────────────
  crossfaderBasicsData,
  beatmatchByEarData,
  gainStagingData,
  hotCuesData,
  babyScratchData,
  loopBasicsData,
  trackSelectionData,
  eqIncomingTrackData,

  // ── Expanded Catalog — Intermediate ──────────────────
  dropMixingData,
  filterTransitionsData,
  phraseMatchingData,
  eqSwapTechniqueData,
  spinbackData,
  tensionEffectsData,
  waveformReadingData,

  // ── Expanded Catalog — Advanced ───────────────────────
  harmonicMixingData,
  powerCutsData,
  multiDeckConceptsData,
  liveMashupData,
  setPlanningData,
];

/** @type {TechniqueCategory[]} */
export const CATEGORIES = ['basics', 'beatmatching', 'transitions', 'eq-mixing', 'effects'];
