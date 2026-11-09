import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { mergeIntervals, type Interval } from '../src/intervals';

const endpoint = fc.integer({ min: -20, max: 20 });
const interval: fc.Arbitrary<Interval> = fc.tuple(endpoint, endpoint)
  .map(([a, b]) => [Math.min(a, b), Math.max(a, b)]);
const intervalList = fc.array(interval, { maxLength: 20 });

// Positive gaps construct intervals that neither overlap nor touch.
const disjointList = fc.tuple(
  endpoint,
  fc.array(fc.tuple(fc.integer({ min: 1, max: 5 }), fc.nat(5)), { maxLength: 20 }),
).map(([start, parts]) => {
  let end = start;
  return parts.map(([gap, width]): Interval => {
    const next = end + gap;
    end = next + width;
    return [next, end];
  });
});

describe('mergeIntervals', () => {
  // Pattern: invariant. Output is valid, sorted and separated, covers each input, and leaves input unchanged.
  it('preserves the input and produces sorted, separated intervals', () => {
    fc.assert(fc.property(intervalList, xs => {
      const before = xs.map(([s, e]): Interval => [s, e]);
      const out = mergeIntervals(xs);
      expect(xs).toEqual(before);
      for (const [s, e] of before) {
        expect(out.some(([a, b]) => a <= s && e <= b)).toBe(true);
      }
      for (let i = 0; i < out.length; i++) {
        expect(Number.isInteger(out[i][0]) && Number.isInteger(out[i][1])).toBe(true);
        expect(out[i][0]).toBeLessThanOrEqual(out[i][1]);
        if (i > 0) expect(out[i - 1][1]).toBeLessThan(out[i][0]);
      }
    }));
  });

  // Pattern: differential. Input and output cover exactly the same points, including gaps between integers.
  it('preserves point coverage', () => {
    fc.assert(fc.property(intervalList, xs => {
      const before = xs.map(([s, e]): Interval => [s, e]);
      const out = mergeIntervals(xs);
      const covers = (ys: Interval[], p: number) => ys.some(([s, e]) => s <= p && p <= e);
      // Integer endpoints mean checking endpoints and half-integers checks every region.
      const points = [...before.flat(), ...out.flat()].sort((a, b) => a - b);
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        expect(covers(out, p)).toBe(covers(before, p));
        if (i > 0) {
          const middle = (points[i - 1] + p) / 2;
          expect(covers(out, middle)).toBe(covers(before, middle));
        }
      }
      if (before.length === 0) expect(out).toEqual([]);
    }));
  });

  // Pattern: metamorphic. Reordering and duplicating intervals does not change their union.
  it('ignores input order and duplicates', () => {
    fc.assert(fc.property(intervalList, xs => {
      const changed = [...xs, ...xs].reverse().map(([s, e]): Interval => [s, e]);
      expect(mergeIntervals(changed)).toEqual(mergeIntervals(xs));
    }));
  });

  // Pattern: algebraic. Merging an already merged result has no effect.
  it('is idempotent', () => {
    fc.assert(fc.property(intervalList, xs => {
      const out = mergeIntervals(xs);
      expect(mergeIntervals(out)).toEqual(out);
    }));
  });

  // Pattern: conditional. Already separated intervals are returned in sorted order unchanged.
  it('preserves disjoint intervals', () => {
    fc.assert(fc.property(disjointList, xs => {
      expect(mergeIntervals([...xs].reverse())).toEqual(xs);
    }));
  });
});
