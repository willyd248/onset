import { describe, it, expect, beforeEach } from 'vitest';
import { ScoringEngine } from '../src/lessons/ScoringEngine.js';

describe('ScoringEngine', () => {
  // ── Static: calcAccuracy ─────────────────────────────────────
  describe('calcAccuracy', () => {
    it('returns 100 when dead on (within 25% of tolerance)', () => {
      expect(ScoringEngine.calcAccuracy(0, 0, 10)).toBe(100);
      expect(ScoringEngine.calcAccuracy(2, 0, 10)).toBe(100); // 2 ≤ 2.5
    });

    it('returns 70–100 when within tolerance', () => {
      // distance=5, tolerance=10 → 100 - (5/10 * 30) = 85
      expect(ScoringEngine.calcAccuracy(5, 0, 10)).toBe(85);
      // distance=10 (at boundary) → 100 - (10/10 * 30) = 70
      expect(ScoringEngine.calcAccuracy(10, 0, 10)).toBe(70);
    });

    it('returns 0–40 when within 2× tolerance', () => {
      // distance=15 → 40 - ((15-10)/10 * 40) = 20
      expect(ScoringEngine.calcAccuracy(15, 0, 10)).toBe(20);
      // distance=20 (at 2× boundary) → 40 - ((20-10)/10 * 40) = 0
      expect(ScoringEngine.calcAccuracy(20, 0, 10)).toBe(0);
    });

    it('returns 0 when way off (> 2× tolerance)', () => {
      expect(ScoringEngine.calcAccuracy(30, 0, 10)).toBe(0);
    });

    it('works with negative targets (e.g. EQ dB)', () => {
      // actual=-20, target=-24, tolerance=4 → distance=4, at boundary → 70
      expect(ScoringEngine.calcAccuracy(-20, -24, 4)).toBe(70);
    });
  });

  // ── Static: calcTiming ───────────────────────────────────────
  describe('calcTiming', () => {
    describe('without time limit', () => {
      it('returns 100 for fast completion (< 2s)', () => {
        expect(ScoringEngine.calcTiming(1000, null)).toBe(100);
      });
      it('returns 80 for 2–5s', () => {
        expect(ScoringEngine.calcTiming(3000, null)).toBe(80);
      });
      it('returns 60 for 5–10s', () => {
        expect(ScoringEngine.calcTiming(7000, null)).toBe(60);
      });
      it('returns 40 for 10–20s', () => {
        expect(ScoringEngine.calcTiming(15000, null)).toBe(40);
      });
      it('returns 20 for > 20s', () => {
        expect(ScoringEngine.calcTiming(25000, null)).toBe(20);
      });
    });

    describe('with time limit', () => {
      const limit = 10000;
      it('returns 100 within 25% of limit', () => {
        expect(ScoringEngine.calcTiming(2500, limit)).toBe(100);
      });
      it('returns 85 within 50% of limit', () => {
        expect(ScoringEngine.calcTiming(4000, limit)).toBe(85);
      });
      it('returns 70 within 75% of limit', () => {
        expect(ScoringEngine.calcTiming(7000, limit)).toBe(70);
      });
      it('returns 50 at the limit', () => {
        expect(ScoringEngine.calcTiming(10000, limit)).toBe(50);
      });
      it('returns 20 when over limit', () => {
        expect(ScoringEngine.calcTiming(12000, limit)).toBe(20);
      });
    });
  });

  // ── Static: calcPhraseAlignment ─────────────────────────────
  describe('calcPhraseAlignment', () => {
    // bpm=120 → beatInterval=0.5s, phraseInterval=4s
    const bpm = 120;
    const beatGrid = Array.from({ length: 20 }, (_, i) => i * 0.5);

    it('returns 50 when no beat grid provided', () => {
      expect(ScoringEngine.calcPhraseAlignment(0, [], bpm)).toBe(50);
    });

    it('returns 50 when bpm is 0', () => {
      expect(ScoringEngine.calcPhraseAlignment(0, beatGrid, 0)).toBe(50);
    });

    it('returns 100 on a phrase boundary', () => {
      // 0ms → phrase boundary (phraseDist=0 < beatInterval*0.25=0.125)
      expect(ScoringEngine.calcPhraseAlignment(0, beatGrid, bpm)).toBe(100);
    });

    it('returns 75 on a beat (not a phrase boundary)', () => {
      // 500ms = 0.5s → on beat, phraseDist=0.5 not < 0.125, minBeatDist=0 < 0.075
      expect(ScoringEngine.calcPhraseAlignment(500, beatGrid, bpm)).toBe(75);
    });

    it('returns 50 when close to a beat', () => {
      // 600ms = 0.6s → nearest beat at 0.5s (dist=0.1), 0.075 ≤ 0.1 < 0.15
      expect(ScoringEngine.calcPhraseAlignment(600, beatGrid, bpm)).toBe(50);
    });

    it('returns 25 when off beat', () => {
      // 300ms = 0.3s → nearest beat is 0 (dist=0.3) or 0.5 (dist=0.2), > 0.15
      expect(ScoringEngine.calcPhraseAlignment(300, beatGrid, bpm)).toBe(25);
    });
  });

  // ── Instance: scoreStep ──────────────────────────────────────
  describe('scoreStep', () => {
    /** @type {ScoringEngine} */
    let engine;

    beforeEach(() => {
      localStorage.clear();
      engine = new ScoringEngine();
      engine.startLesson('test-lesson');
    });

    it('calculates weighted score correctly', () => {
      const score = engine.scoreStep(
        'step-1',
        { accuracy: 80, timing: 60, phrase: 100 },
        { accuracy: 0.5, timing: 0.3, phrase: 0.2 }
      );
      // 80*0.5 + 60*0.3 + 100*0.2 = 40 + 18 + 20 = 78
      expect(score.weighted).toBe(78);
      expect(score.accuracy).toBe(80);
      expect(score.timing).toBe(60);
      expect(score.phrase).toBe(100);
    });

    it('marks step as perfect when all components ≥ 90', () => {
      const score = engine.scoreStep(
        'step-perfect',
        { accuracy: 95, timing: 92, phrase: 91 },
        { accuracy: 0.5, timing: 0.3, phrase: 0.2 }
      );
      expect(score.isPerfect).toBe(true);
    });

    it('does not mark as perfect when any component < 90', () => {
      const score = engine.scoreStep(
        'step-not-perfect',
        { accuracy: 100, timing: 89, phrase: 100 },
        { accuracy: 0.5, timing: 0.3, phrase: 0.2 }
      );
      expect(score.isPerfect).toBe(false);
    });

    it('tracks streak and resets on failure (< 60 weighted)', () => {
      // 80*0.5 + 70*0.3 + 50*0.2 = 40+21+10 = 71 ≥ 60 → streak++
      engine.scoreStep('s1', { accuracy: 80, timing: 70, phrase: 50 }, { accuracy: 0.5, timing: 0.3, phrase: 0.2 });
      engine.scoreStep('s2', { accuracy: 80, timing: 70, phrase: 50 }, { accuracy: 0.5, timing: 0.3, phrase: 0.2 });
      // 10*0.5 + 10*0.3 + 10*0.2 = 10 < 60 → streak=0
      engine.scoreStep('s3', { accuracy: 10, timing: 10, phrase: 10 }, { accuracy: 0.5, timing: 0.3, phrase: 0.2 });

      const result = engine.finishLesson();
      expect(result.maxStreak).toBe(2);
      expect(result.streak).toBe(0);
    });
  });

  // ── Instance: finishLesson ───────────────────────────────────
  describe('finishLesson', () => {
    it('averages step scores', () => {
      localStorage.clear();
      const engine = new ScoringEngine();
      engine.startLesson('avg-lesson');
      engine.scoreStep('s1', { accuracy: 80, timing: 80, phrase: 80 }, { accuracy: 1, timing: 0, phrase: 0 });
      engine.scoreStep('s2', { accuracy: 60, timing: 60, phrase: 60 }, { accuracy: 1, timing: 0, phrase: 0 });
      const result = engine.finishLesson();
      expect(result.score).toBe(70);
    });

    it('returns score of 0 for a lesson with no steps', () => {
      localStorage.clear();
      const engine = new ScoringEngine();
      engine.startLesson('empty-lesson');
      expect(engine.finishLesson().score).toBe(0);
    });

    it('detects personal best on first completion', () => {
      localStorage.clear();
      const engine = new ScoringEngine();
      engine.startLesson('best-lesson');
      engine.scoreStep('s1', { accuracy: 90, timing: 90, phrase: 90 }, { accuracy: 1, timing: 0, phrase: 0 });
      const result = engine.finishLesson();
      expect(result.isPersonalBest).toBe(true);
    });
  });
});
