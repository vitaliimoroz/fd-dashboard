import { Pipe, PipeTransform } from '@angular/core';
import { UNAVAILABLE } from './format';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Formats a price in cents as dollars, e.g. 10150 → "$101.50". Rounds only for display. */
@Pipe({ name: 'centsCurrency' })
export class CentsCurrencyPipe implements PipeTransform {
  transform(cents: number | null): string {
    return cents === null ? UNAVAILABLE : usd.format(cents / 100);
  }
}
