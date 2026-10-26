import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ProducerService } from '@app/core/producer.service';
import {
  DEFAULT_SETTINGS,
  ProducerSettings,
  SETTINGS_LIMITS
} from '@shared/models/producer-settings';
import { settingValidators } from './settings-validators';

interface FieldConfig {
  key: keyof ProducerSettings;
  label: string;
  hint: string;
}

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule, DecimalPipe],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsComponent {
  private readonly producer = inject(ProducerService);

  protected readonly fields: FieldConfig[] = [
    { key: 'instrumentCount', label: 'Instrument count', hint: 'Number of fictional instruments.' },
    { key: 'updatesPerBatch', label: 'Updates per batch', hint: 'Market updates in each batch, across all instruments.' },
    { key: 'batchIntervalMs', label: 'Batch interval (ms)', hint: 'Requested time between batches.' }
  ];
  protected readonly limits = SETTINGS_LIMITS;

  // The form is a draft: editing it does not touch the producer until Apply.
  private readonly active = this.producer.settings();
  protected readonly form = inject(NonNullableFormBuilder).group({
    instrumentCount: [this.active.instrumentCount, settingValidators('instrumentCount')],
    updatesPerBatch: [this.active.updatesPerBatch, settingValidators('updatesPerBatch')],
    batchIntervalMs: [this.active.batchIntervalMs, settingValidators('batchIntervalMs')]
  });

  private readonly draft = toSignal(this.form.valueChanges, { initialValue: this.form.value });
  /** Nominal updates per second for the draft, across all instruments. */
  protected readonly nominalRate = computed(() => {
    const { updatesPerBatch, batchIntervalMs } = this.draft();
    return updatesPerBatch && batchIntervalMs ? (updatesPerBatch * 1000) / batchIntervalMs : null;
  });

  protected readonly applied = signal(false);

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.applied.set(false));
  }

  protected errorFor(key: keyof ProducerSettings): string | null {
    const control = this.form.controls[key];
    if (control.valid || !(control.dirty || control.touched)) {
      return null;
    }
    if (control.hasError('required')) {
      return 'Enter a value.';
    }
    if (control.hasError('integer')) {
      return 'Enter a whole number.';
    }
    const { min, max } = SETTINGS_LIMITS[key];
    return `Enter a value from ${min.toLocaleString('en-US')} to ${max.toLocaleString('en-US')}.`;
  }

  protected apply(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.producer.apply(this.form.getRawValue());
    this.form.markAsPristine();
    this.applied.set(true);
  }

  protected restoreDefaults(): void {
    this.form.setValue(DEFAULT_SETTINGS);
    this.form.markAsDirty();
  }
}
