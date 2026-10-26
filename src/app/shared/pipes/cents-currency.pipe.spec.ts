import { CentsCurrencyPipe } from './cents-currency.pipe';
import { UNAVAILABLE } from './format';

describe('CentsCurrencyPipe', () => {
  const pipe = new CentsCurrencyPipe();

  it('formats cents as dollars', () => {
    expect(pipe.transform(10200)).toBe('$102.00');
    expect(pipe.transform(4)).toBe('$0.04');
    expect(pipe.transform(1234567)).toBe('$12,345.67');
  });

  it('rounds fractional cents only for display', () => {
    expect(pipe.transform(10150)).toBe('$101.50'); // VWAP from the worked example
    expect(pipe.transform(10149.6)).toBe('$101.50');
  });

  it('shows unavailable values', () => {
    expect(pipe.transform(null)).toBe(UNAVAILABLE);
  });
});
