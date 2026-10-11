import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { LoaderComponent } from './loader.component';

describe('LoaderComponent', () => {
  it('shows its default loading message', () => {
    TestBed.configureTestingModule({
      imports: [LoaderComponent],
      schemas: [NO_ERRORS_SCHEMA]
    });
    const fixture = TestBed.createComponent(LoaderComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Loading data...');
    expect(fixture.nativeElement.textContent).toContain('Please wait while we sync');
  });

  it('renders a caller-provided loading message', () => {
    TestBed.configureTestingModule({
      imports: [LoaderComponent],
      schemas: [NO_ERRORS_SCHEMA]
    });
    const fixture = TestBed.createComponent(LoaderComponent);
    fixture.componentRef.setInput('message', 'Saving invoice...');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Saving invoice...');
  });
});
