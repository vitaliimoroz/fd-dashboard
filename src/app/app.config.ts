import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideZoneChangeDetection
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { ProducerService } from './core/producer.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // Start the producer with the default settings on startup, whichever page loads first.
    provideAppInitializer(() => {
      inject(ProducerService);
    })
  ]
};
