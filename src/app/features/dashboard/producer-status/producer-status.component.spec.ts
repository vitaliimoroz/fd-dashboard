import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProducerService, ProducerStatus } from '@app/core/producer.service';
import { DEFAULT_SETTINGS } from '@shared/models/producer-settings';
import { ProducerStatusComponent } from './producer-status.component';

describe('ProducerStatusComponent', () => {
  let fixture: ComponentFixture<ProducerStatusComponent>;
  let producer: {
    status: ReturnType<typeof signal<ProducerStatus>>;
    error: ReturnType<typeof signal<string | null>>;
    totalUpdates: ReturnType<typeof signal<number>>;
    settings: ReturnType<typeof signal<typeof DEFAULT_SETTINGS>>;
    pause: jasmine.Spy;
    resume: jasmine.Spy;
  };

  const el = () => fixture.nativeElement as HTMLElement;
  const button = () => el().querySelector('button')!;
  const render = () => fixture.detectChanges();

  beforeEach(() => {
    producer = {
      status: signal<ProducerStatus>('running'),
      error: signal<string | null>(null),
      totalUpdates: signal(12345),
      settings: signal(DEFAULT_SETTINGS),
      pause: jasmine.createSpy('pause'),
      resume: jasmine.createSpy('resume')
    };
    TestBed.configureTestingModule({
      imports: [ProducerStatusComponent],
      providers: [{ provide: ProducerService, useValue: producer }]
    });
    fixture = TestBed.createComponent(ProducerStatusComponent);
    render();
  });

  it('shows the status, settings summary and generated updates', () => {
    expect(el().querySelector('.badge')!.textContent).toContain('Running');
    expect(el().textContent).toContain('5');
    expect(el().textContent).toContain('200 updates/s'); // 100 updates every 500 ms
    expect(el().textContent).toContain('12,345');
  });

  it('pauses a running producer', () => {
    expect(button().textContent).toContain('Pause');

    button().click();

    expect(producer.pause).toHaveBeenCalled();
    expect(producer.resume).not.toHaveBeenCalled();
  });

  it('resumes a paused producer', () => {
    producer.status.set('paused');
    render();

    expect(el().querySelector('.badge')!.textContent).toContain('Paused');
    expect(button().textContent).toContain('Resume');

    button().click();

    expect(producer.resume).toHaveBeenCalled();
  });

  it('allows pausing while initializing', () => {
    producer.status.set('initializing');
    render();

    expect(el().querySelector('.badge')!.textContent).toContain('Initializing');
    expect(button().disabled).toBeFalse();
  });

  it('shows errors and disables the control', () => {
    producer.status.set('error');
    producer.error.set('Failed to fetch market-producer.wasm: HTTP 404.');
    render();

    expect(el().querySelector('[role="alert"]')!.textContent).toContain('HTTP 404');
    expect(button().disabled).toBeTrue();
  });
});
