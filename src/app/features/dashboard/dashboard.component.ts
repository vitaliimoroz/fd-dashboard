import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ProducerService } from '@app/core/producer.service';
import { CentsCurrencyPipe } from '@app/shared/pipes/cents-currency.pipe';
import { ImbalancePipe } from '@app/shared/pipes/imbalance.pipe';
import { ProducerStatusComponent } from './producer-status/producer-status.component';

@Component({
  selector: 'app-dashboard',
  imports: [DecimalPipe, CentsCurrencyPipe, ImbalancePipe, ProducerStatusComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent {
  protected readonly instruments = inject(ProducerService).instruments;
}
