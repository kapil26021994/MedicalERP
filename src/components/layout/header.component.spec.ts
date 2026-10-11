import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HeaderComponent } from './header.component';
import { SettingsService } from '../../services/settings.service';
import { SupabaseService } from '../../services/supabase.service';
import { TranslationService } from '../../services/translation.service';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let router: Router;
  let fixture: ReturnType<typeof TestBed.createComponent<HeaderComponent>>;
  let language: ReturnType<typeof signal<'en' | 'hi'>>;
  let signOut: ReturnType<typeof vi.fn>;
  let user: ReturnType<typeof signal<unknown>>;
  let demoUser: ReturnType<typeof signal<boolean>>;
  let visibility: ReturnType<typeof signal<{
    dashboard: boolean; sales: boolean; invoices: boolean; inventory: boolean;
    purchases: boolean; challan: boolean; expenses: boolean; customers: boolean;
  }>>;

  beforeEach(() => {
    language = signal<'en' | 'hi'>('en');
    user = signal<unknown>(null);
    demoUser = signal(false);
    signOut = vi.fn().mockResolvedValue(undefined);
    visibility = signal({
      dashboard: true, sales: true, invoices: true, inventory: true,
      purchases: true, challan: true, expenses: true, customers: true
    });
    const settings = { headerTabVisibility: visibility } as unknown as SettingsService;
    const translations = {
      currentLang: language,
      t: (key: string) => key,
      setLanguage: vi.fn((next: 'en' | 'hi') => language.set(next))
    } as unknown as TranslationService;
    const supabase = {
      currentUser: user,
      isDemoUser: demoUser,
      signOut
    } as unknown as SupabaseService;

    TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        provideRouter([]),
        { provide: SettingsService, useValue: settings },
        { provide: TranslationService, useValue: translations },
        { provide: SupabaseService, useValue: supabase }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });
    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  });

  it('toggles the quick actions, profile, and language menus and closes them', () => {
    component.toggleQuickMenu();
    component.toggleProfileMenu();
    component.toggleLangMenu();
    expect(component.showQuickMenu()).toBe(true);
    expect(component.showProfileMenu()).toBe(true);
    expect(component.showLangMenu()).toBe(true);

    component.closeQuickMenu();
    component.closeProfileMenu();
    component.selectLanguage('hi');
    expect(component.showQuickMenu()).toBe(false);
    expect(component.showProfileMenu()).toBe(false);
    expect(component.showLangMenu()).toBe(false);
    expect(language()).toBe('hi');

    component.selectLanguage('en');
    expect(language()).toBe('en');
  });

  it('emits the sidebar toggle and derives profile labels from the active user', () => {
    const toggleSpy = vi.fn();
    component.toggleSidebar.subscribe(toggleSpy);
    component.onToggleSidebar();
    expect(toggleSpy).toHaveBeenCalledOnce();

    expect(component.getUserDisplayName()).toBe('Store Manager');
    expect(component.getUserEmail()).toBe('demo@advikaerp.com');
    user.set({ email: 'ada@example.com', user_metadata: {} });
    expect(component.getUserDisplayName()).toBe('ada');
    expect(component.getUserInitials()).toBe('AD');
    user.set({ email: 'ada@example.com', user_metadata: { full_name: 'Ada Lovelace' } });
    expect(component.getUserDisplayName()).toBe('Ada Lovelace');
    expect(component.getUserEmail()).toBe('ada@example.com');
    expect(component.getUserInitials()).toBe('AD');
    demoUser.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('header.demoManager');
  });

  it('signs out, closes the profile menu, and redirects to login', async () => {
    component.showProfileMenu.set(true);

    await component.onSignOut();

    expect(signOut).toHaveBeenCalledOnce();
    expect(component.showProfileMenu()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('opens and closes menu panels from their rendered controls', () => {
    const root: HTMLElement = fixture.nativeElement;
    const buttons = () => Array.from(root.querySelectorAll('button'));

    buttons().find(button => button.textContent?.includes('header.new'))?.click();
    fixture.detectChanges();
    expect(component.showQuickMenu()).toBe(true);
    expect(root.textContent).toContain('quick.posBill');
    root.querySelector('.fixed.inset-0')?.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    expect(component.showQuickMenu()).toBe(false);

    buttons().find(button => button.textContent?.includes('(English)'))?.click();
    fixture.detectChanges();
    expect(component.showLangMenu()).toBe(true);
    expect(root.textContent).toContain('English (EN)');
    buttons().find(button => button.textContent?.includes('Hindi (हिंदी)'))?.click();
    fixture.detectChanges();
    expect(component.showLangMenu()).toBe(false);
    expect(language()).toBe('hi');

    buttons().find(button => button.textContent?.includes('(हिंदी)'))?.click();
    fixture.detectChanges();
    root.querySelector('.fixed.inset-0')?.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    expect(component.showLangMenu()).toBe(false);

    buttons().find(button => button.textContent?.includes('(हिंदी)'))?.click();
    fixture.detectChanges();
    buttons().find(button => button.textContent?.includes('English (EN)'))?.click();
    fixture.detectChanges();
    expect(language()).toBe('en');
  });

  it('closes quick actions after selecting an action and closes the profile after signing out', async () => {
    const root: HTMLElement = fixture.nativeElement;
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    component.toggleQuickMenu();
    fixture.detectChanges();
    const posAction = Array.from(root.querySelectorAll('a'))
      .find(link => link.textContent?.includes('quick.posBill'));
    posAction?.click();
    fixture.detectChanges();
    expect(component.showQuickMenu()).toBe(false);

    component.toggleQuickMenu();
    fixture.detectChanges();
    const inventoryAction = Array.from(root.querySelectorAll('a'))
      .find(link => link.textContent?.includes('quick.addInventory'));
    inventoryAction?.click();
    fixture.detectChanges();
    expect(component.showQuickMenu()).toBe(false);

    component.toggleProfileMenu();
    fixture.detectChanges();
    const signOutButton = Array.from(root.querySelectorAll('button'))
      .find(button => button.textContent?.includes('header.signOut'));
    signOutButton?.click();
    await fixture.whenStable();

    expect(signOut).toHaveBeenCalledOnce();
    expect(component.showProfileMenu()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('opens the profile menu and closes it after choosing account settings', () => {
    const root: HTMLElement = fixture.nativeElement;
    const profileButton = Array.from(root.querySelectorAll('button'))
      .find(button => button.textContent?.trim() === 'ST');
    profileButton?.click();
    fixture.detectChanges();

    expect(component.showProfileMenu()).toBe(true);
    expect(root.textContent).toContain('header.accountSettings');
    root.querySelector('.fixed.inset-0')?.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    expect(component.showProfileMenu()).toBe(false);

    profileButton?.click();
    fixture.detectChanges();
    const settingsLink = root.querySelector('a[href="/settings"]') as HTMLAnchorElement | null;
    settingsLink?.click();
    fixture.detectChanges();
    expect(component.showProfileMenu()).toBe(false);
  });

  it('omits optional navigation and quick-action links when their settings are disabled', () => {
    visibility.set({
      dashboard: false, sales: false, invoices: false, inventory: false,
      purchases: false, challan: false, expenses: false, customers: false
    });
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    for (const route of ['/dashboard', '/sales', '/invoices', '/inventory', '/purchases', '/challan', '/expenses', '/customers']) {
      expect(root.querySelector(`a[href="${route}"]`)).toBeNull();
    }
    expect(root.querySelector('a[href="/pos"]')).not.toBeNull();

    component.toggleQuickMenu();
    fixture.detectChanges();
    expect(root.querySelector('a[href="/sales"]')).toBeNull();
    expect(root.querySelector('a[href="/invoices"]')).toBeNull();
    expect(root.querySelector('a[href="/inventory"]')).toBeNull();
    expect(root.querySelector('a[href="/purchases"]')).toBeNull();
    expect(root.querySelector('a[href="/challan"]')).toBeNull();
    expect(root.querySelector('a[href="/expenses"]')).toBeNull();
    expect(root.querySelector('a[href="/pos"]')).not.toBeNull();
  });

  it('offers every quick action when its corresponding setting is enabled', () => {
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const root: HTMLElement = fixture.nativeElement;
    const actions = [
      ['quick.salesAnalytics', '/sales'],
      ['quick.posBill', '/pos'],
      ['quick.createInvoice', '/invoices'],
      ['quick.addInventory', '/inventory'],
      ['quick.recordPurchase', '/purchases'],
      ['nav.challan', '/challan'],
      ['quick.addExpense', '/expenses']
    ];

    component.toggleQuickMenu();
    fixture.detectChanges();
    for (const [label, route] of actions) {
      const action = Array.from(root.querySelectorAll('a'))
        .find(link => link.textContent?.includes(label));
      expect(action?.getAttribute('href')).toBe(route);
    }
  });
});
