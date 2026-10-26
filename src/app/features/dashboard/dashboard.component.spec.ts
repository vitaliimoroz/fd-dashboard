import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProducerService } from '@app/core/producer.service';
import { UNAVAILABLE } from '@app/shared/pipes/format';
import { InstrumentMetrics, emptyMetrics } from '@shared/models/instrument-metrics';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let instruments: ReturnType<typeof signal<InstrumentMetrics[]>>;
  let fixture: ComponentFixture<DashboardComponent>;

  const cells = () =>
    Array.from(fixture.nativeElement.querySelectorAll('tbody tr') as NodeListOf<HTMLElement>).map(
      (row) => Array.from(row.querySelectorAll('th, td')).map((cell) => cell.textContent!.trim())
    );

  beforeEach(() => {
    instruments = signal(emptyMetrics(2));
    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [{ provide: ProducerService, useValue: { instruments } }]
    });
    fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
  });

  it('shows one row per instrument with unavailable values and zero volume before data', () => {
    expect(cells()).toEqual([
      ['ASSET01', UNAVAILABLE, UNAVAILABLE, '0', UNAVAILABLE, UNAVAILABLE],
      ['ASSET02', UNAVAILABLE, UNAVAILABLE, '0', UNAVAILABLE, UNAVAILABLE]
    ]);
  });

  it('formats the worked example', () => {
    instruments.set([
      {
        symbol: 'ASSET01',
        lastPriceCents: 10200,
        spreadCents: 4,
        volume: 40,
        vwapCents: 10150,
        imbalance: 0.2
      },
      emptyMetrics(2)[1]
    ]);
    fixture.detectChanges();

    expect(cells()[0]).toEqual(['ASSET01', '$102.00', '$0.04', '40', '$101.50', '+0.20']);
    expect(cells()[1][3]).toBe('0');
  });

  it('groups large volumes and shows an unavailable imbalance', () => {
    instruments.set([
      {
        symbol: 'ASSET01',
        lastPriceCents: 5000,
        spreadCents: 1,
        volume: 1234567,
        vwapCents: 4999.5,
        imbalance: null
      }
    ]);
    fixture.detectChanges();

    expect(cells()).toEqual([['ASSET01', '$50.00', '$0.01', '1,234,567', '$50.00', UNAVAILABLE]]);
  });
});
