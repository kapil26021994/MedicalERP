import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { LandingComponent } from './landing.component';

vi.mock('motion', () => ({
  animate: vi.fn(),
  stagger: vi.fn((delay: number) => delay)
}));

describe('LandingComponent', () => {
  it('exposes its landing feature and workflow content and switches the active feature', () => {
    TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [provideRouter([]), { provide: PLATFORM_ID, useValue: 'server' }],
      schemas: [NO_ERRORS_SCHEMA]
    });
    const fixture = TestBed.createComponent(LandingComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.activeTab()).toBe('ocr');
    expect(component.features().map(feature => feature.id)).toEqual(['ocr', 'inventory', 'analytics']);
    expect(component.workflowSteps()).toHaveLength(4);
    expect(component.stats()).toHaveLength(4);

    component.setActiveTab('analytics');
    expect(component.activeTab()).toBe('analytics');
  });

  it('skips browser animations when rendered on the server', () => {
    TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [provideRouter([]), { provide: PLATFORM_ID, useValue: 'server' }],
      schemas: [NO_ERRORS_SCHEMA]
    });
    const component = TestBed.createComponent(LandingComponent).componentInstance;

    expect(() => component.ngAfterViewInit()).not.toThrow();
  });

  it('animates hero and feature elements in the browser when matching elements exist', async () => {
    const { animate, stagger } = await import('motion');
    vi.clearAllMocks();
    const heroItems = { length: 2 };
    const cards = { length: 3 };
    TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });
    const fixture = TestBed.createComponent(LandingComponent);
    const elementRef = (fixture.componentInstance as unknown as {
      elementRef: { nativeElement: HTMLElement }
    }).elementRef;
    const query = vi.spyOn(elementRef.nativeElement, 'querySelectorAll')
      .mockImplementation((selector: string) =>
        (selector === '.animate-hero-item' ? heroItems : cards) as unknown as NodeListOf<Element>);

    fixture.componentInstance.ngAfterViewInit();

    expect(query).toHaveBeenCalledWith('.animate-hero-item');
    expect(query).toHaveBeenCalledWith('.animate-card');
    expect(stagger).toHaveBeenNthCalledWith(1, 0.12);
    expect(stagger).toHaveBeenNthCalledWith(2, 0.1);
    expect(animate).toHaveBeenCalledTimes(2);
  });

  it('does not start animations when the browser has no matching elements', async () => {
    const { animate } = await import('motion');
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });
    const fixture = TestBed.createComponent(LandingComponent);
    const elementRef = (fixture.componentInstance as unknown as {
      elementRef: { nativeElement: HTMLElement }
    }).elementRef;
    vi.spyOn(elementRef.nativeElement, 'querySelectorAll')
      .mockReturnValue({ length: 0 } as unknown as NodeListOf<Element>);

    fixture.componentInstance.ngAfterViewInit();

    expect(animate).not.toHaveBeenCalled();
  });

  it('animates only the feature cards when there are no hero items', async () => {
    const { animate, stagger } = await import('motion');
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });
    const fixture = TestBed.createComponent(LandingComponent);
    const elementRef = (fixture.componentInstance as unknown as {
      elementRef: { nativeElement: HTMLElement }
    }).elementRef;
    vi.spyOn(elementRef.nativeElement, 'querySelectorAll')
      .mockImplementation((selector: string) =>
        ({ length: selector === '.animate-card' ? 2 : 0 }) as unknown as NodeListOf<Element>);

    fixture.componentInstance.ngAfterViewInit();

    expect(stagger).toHaveBeenCalledOnce();
    expect(stagger).toHaveBeenCalledWith(0.1);
    expect(animate).toHaveBeenCalledOnce();
  });
});
