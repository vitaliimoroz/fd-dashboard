import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { PRODUCER_WORKER_FACTORY } from './core/producer.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        {
          provide: PRODUCER_WORKER_FACTORY,
          useValue: () => jasmine.createSpyObj('Worker', ['postMessage', 'terminate'])
        }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
