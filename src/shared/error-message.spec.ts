import { errorMessage } from './error-message';

describe('errorMessage', () => {
  it('returns the message of an Error', () => {
    expect(errorMessage(new TypeError('bad type'), 'fallback')).toBe('bad type');
  });

  it('uses the fallback for non-Error values', () => {
    expect(errorMessage({ code: 1 }, 'Unknown error.')).toBe('Unknown error.');
  });

  it('stringifies non-Error values when no fallback is given', () => {
    expect(errorMessage('plain string')).toBe('plain string');
  });
});
