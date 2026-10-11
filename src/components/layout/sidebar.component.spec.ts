import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SidebarComponent } from './sidebar.component';
import { SettingsService } from '../../services/settings.service';
import { TranslationService } from '../../services/translation.service';

describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ReturnType<typeof TestBed.createComponent<SidebarComponent>>;
  let visibility: ReturnType<typeof signal<{
    dashboard: boolean;
    sales: boolean;
    invoices: boolean;
    inventory: boolean;
    purchases: boolean;
    challan: boolean;
    expenses: boolean;
    customers: boolean;
  }>>;

  beforeEach(() => {
    visibility = signal({
      dashboard: true, sales: false, invoices: false, inventory: true,
      purchases: false, challan: false, expenses: false, customers: true
    });
    const settings = {
      headerTabVisibility: visibility
    } as unknown as SettingsService;
    const translations = {
      currentLang: signal<'en' | 'hi'>('en'),
      t: (key: string) => key
    } as unknown as TranslationService;
    TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([]),
        { provide: SettingsService, useValue: settings },
        { provide: TranslationService, useValue: translations }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });
    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('emits navigation requests from its navigation handler', () => {
    const navigateSpy = vi.fn();
    component.navigate.subscribe(navigateSpy);

    component.onNavigate();

    expect(navigateSpy).toHaveBeenCalledOnce();
  });

  it('shows procurement and finance sections when any of their tabs are enabled', () => {
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('a[href="/purchases"]')).toBeNull();
    expect(root.querySelector('a[href="/challan"]')).toBeNull();
    expect(root.querySelector('a[href="/sales"]')).toBeNull();
    expect(root.querySelector('a[href="/invoices"]')).toBeNull();
    expect(root.querySelector('a[href="/expenses"]')).toBeNull();

    visibility.set({ ...visibility(), purchases: true, sales: true });
    fixture.detectChanges();

    expect(root.querySelector('a[href="/purchases"]')).not.toBeNull();
    expect(root.querySelector('a[href="/sales"]')).not.toBeNull();
  });

  it('renders all configured routes and emits when a route link is activated', () => {
    visibility.set({
      dashboard: true, sales: true, invoices: true, inventory: true,
      purchases: true, challan: true, expenses: true, customers: true
    });
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const navigation = root.querySelector('nav');
    expect(navigation).not.toBeNull();
    const navigateSpy = vi.fn();
    component.navigate.subscribe(navigateSpy);

    for (const route of ['/dashboard', '/sales', '/invoices', '/inventory', '/purchases', '/challan', '/expenses', '/customers']) {
      const link = navigation?.querySelector(`a[href="${route}"]`) as HTMLAnchorElement | null;
      expect(link).not.toBeNull();
      link?.click();
    }

    expect(navigateSpy).toHaveBeenCalledTimes(8);
  });
});
