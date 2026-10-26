import { UNAVAILABLE } from './format';
import { ImbalancePipe } from './imbalance.pipe';

describe('ImbalancePipe', () => {
  const pipe = new ImbalancePipe();

  it('formats values between -1 and +1 with a sign', () => {
    expect(pipe.transform(0.2)).toBe('+0.20'); // worked example
    expect(pipe.transform(-0.5)).toBe('-0.50');
    expect(pipe.transform(1)).toBe('+1.00');
    expect(pipe.transform(-1)).toBe('-1.00');
  });

  it('shows zero without a sign', () => {
    expect(pipe.transform(0)).toBe('0.00');
    expect(pipe.transform(0.001)).toBe('0.00');
  });

  it('shows unavailable values', () => {
    expect(pipe.transform(null)).toBe(UNAVAILABLE);
  });
});
