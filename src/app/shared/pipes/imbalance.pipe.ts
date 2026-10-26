import { Pipe, PipeTransform } from '@angular/core';
import { UNAVAILABLE } from './format';

const signed = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero'
});

/** Formats an order-book imbalance in [-1, +1] with an explicit sign, e.g. 0.2 → "+0.20". */
@Pipe({ name: 'imbalance' })
export class ImbalancePipe implements PipeTransform {
  transform(value: number | null): string {
    return value === null ? UNAVAILABLE : signed.format(value);
  }
}
