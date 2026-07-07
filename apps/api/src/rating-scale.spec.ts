import { fromNormalized, toNormalized } from '@cinelog/contracts';

describe('rating-scale conversions', () => {
  it('maps normalized 0..100 into five-star display units', () => {
    expect(fromNormalized(100, 'FIVE_STAR')).toBe(5);
    expect(fromNormalized(0, 'FIVE_STAR')).toBe(0);
    expect(fromNormalized(50, 'FIVE_STAR')).toBe(3); // 2.5 -> nearest whole star
  });

  it('supports half-star precision', () => {
    expect(fromNormalized(50, 'FIVE_STAR_HALF')).toBe(2.5);
    expect(fromNormalized(90, 'FIVE_STAR_HALF')).toBe(4.5);
  });

  it('round-trips display units for the ten-point scale', () => {
    // Normalized values snap to the scale's step, so the stable invariant is
    // display -> normalized -> display returning the original display value.
    for (const display of [0, 1, 5, 8, 10]) {
      expect(fromNormalized(toNormalized(display, 'TEN'), 'TEN')).toBe(display);
    }
  });

  it('clamps out-of-range normalized values', () => {
    expect(toNormalized(200, 'HUNDRED')).toBe(100);
    expect(toNormalized(-5, 'HUNDRED')).toBe(0);
  });
});
