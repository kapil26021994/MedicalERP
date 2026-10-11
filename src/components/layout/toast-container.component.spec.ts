import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ToastContainerComponent } from './toast-container.component';
import { ToastMessage, ToastService } from '../../services/toast.service';

describe('ToastContainerComponent', () => {
  it('renders messages with type-appropriate accessibility roles and dismisses by id', () => {
    const messages = signal<ToastMessage[]>([
      { id: 1, message: 'Saved successfully', type: 'success' },
      { id: 2, message: 'Unable to save', type: 'error' },
      { id: 3, message: 'Sync started', type: 'info' }
    ]);
    const dismiss = vi.fn();
    TestBed.configureTestingModule({
      imports: [ToastContainerComponent],
      providers: [{ provide: ToastService, useValue: { messages, dismiss } }],
      schemas: [NO_ERRORS_SCHEMA]
    });
    const fixture = TestBed.createComponent(ToastContainerComponent);
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    expect(root.textContent).toContain('Saved successfully');
    expect(root.textContent).toContain('Unable to save');
    expect(root.textContent).toContain('Sync started');
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Unable to save');
    expect(root.querySelectorAll('[role="status"]')).toHaveLength(2);
    expect(root.querySelector('[class*="bg-emerald-600"]')?.textContent).toContain('check_circle');
    expect(root.querySelector('[class*="bg-rose-600"]')?.textContent).toContain('error');
    expect(root.querySelector('[class*="bg-blue-600"]')?.textContent).toContain('info');

    const buttons = root.querySelectorAll('button[aria-label="Dismiss notification"]');
    buttons[1].dispatchEvent(new Event('click'));
    expect(dismiss).toHaveBeenCalledWith(2);
  });

  it('renders no toast items when the service has no messages', () => {
    TestBed.configureTestingModule({
      imports: [ToastContainerComponent],
      providers: [{ provide: ToastService, useValue: { messages: signal<ToastMessage[]>([]), dismiss: vi.fn() } }],
      schemas: [NO_ERRORS_SCHEMA]
    });
    const fixture = TestBed.createComponent(ToastContainerComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('button')).toHaveLength(0);
  });
});
