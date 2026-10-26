import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])]
    }).compileComponents();
  });

  it('renders the shell with navigation and a router outlet', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const links = Array.from(el.querySelectorAll('nav a')).map((a) => [
      a.textContent!.trim(),
      a.getAttribute('href')
    ]);
    expect(el.querySelector('h1')!.textContent).toContain('Realtime Fintech Dashboard');
    expect(links).toEqual([
      ['Dashboard', '/'],
      ['Settings', '/settings']
    ]);
    expect(el.querySelector('router-outlet')).not.toBeNull();
  });
});
