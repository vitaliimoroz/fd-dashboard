import { FormControl } from '@angular/forms';
import { integerValidator, settingValidators } from './settings-validators';

describe('integerValidator', () => {
  const check = (value: unknown) => integerValidator(new FormControl(value));

  it('accepts integers', () => {
    expect(check(0)).toBeNull();
    expect(check(1000)).toBeNull();
  });

  it('rejects fractional numbers', () => {
    expect(check(2.5)).toEqual({ integer: true });
  });

  it('leaves empty values to the required validator', () => {
    expect(check(null)).toBeNull();
    expect(check('')).toBeNull();
  });
});

describe('settingValidators', () => {
  const errors = (value: unknown) =>
    new FormControl(value, settingValidators('instrumentCount')).errors;

  it('accepts the boundaries of the allowed range', () => {
    expect(errors(1)).toBeNull();
    expect(errors(50)).toBeNull();
  });

  it('rejects values outside the range', () => {
    expect(errors(0)).toEqual(jasmine.objectContaining({ min: { min: 1, actual: 0 } }));
    expect(errors(51)).toEqual(jasmine.objectContaining({ max: { max: 50, actual: 51 } }));
  });

  it('rejects empty and non-integer values', () => {
    expect(errors(null)).toEqual({ required: true });
    expect(errors(2.5)).toEqual({ integer: true });
  });

  it('uses the range of each setting', () => {
    const control = new FormControl(2000, settingValidators('batchIntervalMs'));
    expect(control.valid).toBeTrue();
    control.setValue(49);
    expect(control.hasError('min')).toBeTrue();
  });
});
