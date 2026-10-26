import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ProducerSettings, SETTINGS_LIMITS } from '@shared/models/producer-settings';

/** Fails for non-integers such as 2.5. Empty values are left to `Validators.required`. */
export function integerValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === '') {
    return null;
  }
  return Number.isInteger(value) ? null : { integer: true };
}

/** Required, integer and within the allowed range for one producer setting. */
export function settingValidators(key: keyof ProducerSettings): ValidatorFn[] {
  const { min, max } = SETTINGS_LIMITS[key];
  return [Validators.required, integerValidator, Validators.min(min), Validators.max(max)];
}
