import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProducerService } from '@app/core/producer.service';
import { DEFAULT_SETTINGS, ProducerSettings } from '@shared/models/producer-settings';
import { SettingsComponent } from './settings.component';

describe('SettingsComponent', () => {
  const active: ProducerSettings = { instrumentCount: 10, updatesPerBatch: 200, batchIntervalMs: 250 };
  let fixture: ComponentFixture<SettingsComponent>;
  let producer: { settings: ReturnType<typeof signal<ProducerSettings>>; apply: jasmine.Spy };

  const el = () => fixture.nativeElement as HTMLElement;
  const input = (key: keyof ProducerSettings) =>
    el().querySelector<HTMLInputElement>(`#setting-${key}`)!;
  const applyButton = () => el().querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const errorText = (key: keyof ProducerSettings) =>
    el().querySelector(`#error-${key}`)?.textContent?.trim() ?? null;

  function type(key: keyof ProducerSettings, value: string): void {
    const field = input(key);
    field.value = value;
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  beforeEach(() => {
    producer = { settings: signal(active), apply: jasmine.createSpy('apply') };
    TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [{ provide: ProducerService, useValue: producer }]
    });
    fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
  });

  it('starts from the active settings', () => {
    expect(input('instrumentCount').value).toBe('10');
    expect(input('updatesPerBatch').value).toBe('200');
    expect(input('batchIntervalMs').value).toBe('250');
    expect(el().textContent).toContain('800 updates/s');
  });

  it('does not affect the producer while editing', () => {
    type('instrumentCount', '20');
    type('updatesPerBatch', '500');

    expect(producer.apply).not.toHaveBeenCalled();
  });

  it('applies the edited settings as integers', () => {
    type('instrumentCount', '20');
    type('batchIntervalMs', '50');

    applyButton().click();
    fixture.detectChanges();

    expect(producer.apply).toHaveBeenCalledOnceWith({
      instrumentCount: 20,
      updatesPerBatch: 200,
      batchIntervalMs: 50
    });
    expect(el().textContent).toContain('A new run started');
  });

  it('applies unchanged settings too, which restarts the run', () => {
    applyButton().click();

    expect(producer.apply).toHaveBeenCalledOnceWith(active);
  });

  it('rejects values outside the allowed ranges', () => {
    type('instrumentCount', '51');
    type('updatesPerBatch', '0');
    type('batchIntervalMs', '2001');

    expect(errorText('instrumentCount')).toBe('Enter a value from 1 to 50.');
    expect(errorText('updatesPerBatch')).toBe('Enter a value from 1 to 1,000.');
    expect(errorText('batchIntervalMs')).toBe('Enter a value from 50 to 2,000.');
    expect(applyButton().disabled).toBeTrue();
  });

  it('rejects non-integers and empty values', () => {
    type('instrumentCount', '2.5');
    type('updatesPerBatch', '');

    expect(errorText('instrumentCount')).toBe('Enter a whole number.');
    expect(errorText('updatesPerBatch')).toBe('Enter a value.');
    expect(input('instrumentCount').getAttribute('aria-invalid')).toBe('true');
    expect(applyButton().disabled).toBeTrue();
  });

  it('does not apply an invalid form on submit', () => {
    type('instrumentCount', '0');

    el().querySelector('form')!.dispatchEvent(new Event('submit'));

    expect(producer.apply).not.toHaveBeenCalled();
  });

  it('accepts the range boundaries', () => {
    type('instrumentCount', '1');
    type('updatesPerBatch', '1000');
    type('batchIntervalMs', '2000');

    expect(applyButton().disabled).toBeFalse();
  });

  it('restores defaults without applying them', () => {
    el().querySelector<HTMLButtonElement>('button[type="button"]')!.click();
    fixture.detectChanges();

    expect(input('instrumentCount').value).toBe(String(DEFAULT_SETTINGS.instrumentCount));
    expect(input('batchIntervalMs').value).toBe(String(DEFAULT_SETTINGS.batchIntervalMs));
    expect(producer.apply).not.toHaveBeenCalled();
  });
});
