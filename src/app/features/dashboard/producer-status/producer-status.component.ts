import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ProducerService, ProducerStatus } from '@app/core/producer.service';

const STATUS_LABELS: Record<ProducerStatus, string> = {
  initializing: 'Initializing…',
  running: 'Running',
  paused: 'Paused',
  error: 'Error'
};

@Component({
  selector: 'app-producer-status',
  imports: [DecimalPipe],
  templateUrl: './producer-status.component.html',
  styleUrl: './producer-status.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProducerStatusComponent {
  protected readonly producer = inject(ProducerService);

  protected readonly statusLabel = computed(() => STATUS_LABELS[this.producer.status()]);

  /** Nominal updates per second across all instruments. */
  protected readonly nominalRate = computed(() => {
    const { updatesPerBatch, batchIntervalMs } = this.producer.settings();
    return (updatesPerBatch * 1000) / batchIntervalMs;
  });

  protected toggle(): void {
    if (this.producer.status() === 'paused') {
      this.producer.resume();
    } else {
      this.producer.pause();
    }
  }
}
