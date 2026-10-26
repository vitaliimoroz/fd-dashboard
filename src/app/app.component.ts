import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ProducerService } from './core/producer.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  protected readonly producer = inject(ProducerService);
}
