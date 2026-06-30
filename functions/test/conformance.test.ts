import { describe, it, expect } from 'vitest'
import { computeRawScore, CONFORMANCE_VECTOR } from '../src/gameDefinition'

describe('Claridge scoring conformance', () => {
  for (const c of CONFORMANCE_VECTOR) {
    it(c.label, () => {
      expect(computeRawScore('claridge', c.outcome)).toBe(c.expectedClaridge)
      expect(computeRawScore('tolemite', c.outcome)).toBe(c.expectedTolemite)
      expect(computeRawScore('bard',     c.outcome)).toBe(c.expectedBard)
    })

    it(`${c.label} — conservation: C + T + B = 0 (up to 3-decimal rounding)`, () => {
      // The EXACT weighted scores sum to 0 for every valid contract (T+B=C on each
      // side). Each role's score is independently rounded to 3 decimals (to match the
      // frozen vector, e.g. −6.333/1.667/4.667), so the rounded sum can carry up to
      // ~0.0015 of rounding residue — conservation holds on the underlying arithmetic.
      const sum =
        computeRawScore('claridge', c.outcome) +
        computeRawScore('tolemite', c.outcome) +
        computeRawScore('bard',     c.outcome)
      expect(Math.abs(sum)).toBeLessThan(2e-3)
    })
  }

  it('no-deal: null outcome → 0 for every role (court outcome entered separately)', () => {
    expect(computeRawScore('claridge', null)).toBe(0)
    expect(computeRawScore('tolemite', null)).toBe(0)
    expect(computeRawScore('bard',     null)).toBe(0)
  })
})
