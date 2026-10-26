import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { emptyMetrics } from '@shared/models/instrument-metrics';
import type {
  ProducerWorkerRequest,
  ProducerWorkerResponse
} from '@shared/models/worker-protocol';
import { routes } from './app.routes';
import { PRODUCER_WORKER_FACTORY, ProducerService } from './core/producer.service';

/** Navigation with the real routes, pages and ProducerService; only the worker is fake. */
describe('Navigation between dashboard and settings', () => {
  let workers: { sent: ProducerWorkerRequest[]; terminate: jasmine.Spy; onmessage: Worker['onmessage'] }[];
  let harness: RouterTestingHarness;

  const latest = () => workers.at(-1)!;
  const runId = () => latest().sent[0].runId;
  const emit = (message: ProducerWorkerResponse) =>
    latest().onmessage?.call(null as unknown as Worker, new MessageEvent('message', { data: message }));
  const text = () => (harness.routeNativeElement as HTMLElement).textContent!;

  beforeEach(async () => {
    workers = [];
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        {
          provide: PRODUCER_WORKER_FACTORY,
          useValue: () => {
            const worker = {
              sent: [] as ProducerWorkerRequest[],
              postMessage(message: ProducerWorkerRequest) {
                this.sent.push(message);
              },
              terminate: jasmine.createSpy('terminate'),
              onmessage: null,
              onerror: null
            };
            workers.push(worker);
            return worker;
          }
        }
      ]
    });
    harness = await RouterTestingHarness.create('/');
  });

  it('keeps the same run and its paused state across navigation', async () => {
    emit({ type: 'ready', runId: runId() });
    const instruments = emptyMetrics(5).map((m) => ({ ...m, volume: 40 }));
    emit({ type: 'snapshot', runId: runId(), instruments, totalUpdates: 200 });
    TestBed.inject(ProducerService).pause();
    harness.detectChanges();

    await harness.navigateByUrl('/settings');
    expect(text()).toContain('Producer settings');

    await harness.navigateByUrl('/');

    expect(workers.length).toBe(1); // no extra producer was created
    expect(latest().terminate).not.toHaveBeenCalled();
    expect(text()).toContain('Paused');
    expect(text()).toContain('200'); // totals preserved
  });

  it('shows the new run on the dashboard after Apply on the settings page', async () => {
    await harness.navigateByUrl('/settings');
    const page = harness.routeNativeElement!;
    const input = page.querySelector<HTMLInputElement>('#setting-instrumentCount')!;
    input.value = '3';
    input.dispatchEvent(new Event('input'));
    harness.detectChanges();
    page.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();

    await harness.navigateByUrl('/');

    expect(workers.length).toBe(2);
    expect(workers[0].terminate).toHaveBeenCalled();
    expect(harness.routeNativeElement!.querySelectorAll('tbody tr').length).toBe(3);
  });

  it('discards an unapplied draft when leaving the settings page', async () => {
    await harness.navigateByUrl('/settings');
    const field = () => harness.routeNativeElement!.querySelector<HTMLInputElement>('#setting-instrumentCount')!;
    field().value = '42';
    field().dispatchEvent(new Event('input'));
    harness.detectChanges();

    await harness.navigateByUrl('/');
    expect(harness.routeNativeElement!.querySelectorAll('tbody tr').length).toBe(5);

    await harness.navigateByUrl('/settings');

    expect(field().value).toBe('5'); // the active setting, not the abandoned draft
    expect(workers.length).toBe(1);
    expect(TestBed.inject(ProducerService).settings().instrumentCount).toBe(5);
  });

  it('redirects unknown paths to the dashboard', async () => {
    await harness.navigateByUrl('/does-not-exist');

    expect(text()).toContain('Live metrics per instrument');
    expect(workers.length).toBe(1);
  });
});
