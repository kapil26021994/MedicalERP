import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppComponent } from './app.component';
import { SupabaseService } from './services/supabase.service';
import { TranslationService } from './services/translation.service';
import { ProductService } from './services/product.service';
import { InvoiceService } from './services/invoice.service';
import { PurchaseService } from './services/purchase.service';
import { ExpenseService } from './services/expense.service';
import { CustomerService } from './services/customer.service';
import { ConfirmationService } from './services/confirmation.service';
import { SettingsService } from './services/settings.service';
import { ChallanService } from './services/challan.service';
import { CartService } from './services/cart.service';

describe('AppComponent', () => {
  let component: AppComponent;
  let fixture: ReturnType<typeof TestBed.createComponent<AppComponent>>;
  let routerEvents: Subject<unknown>;
  let router: { events: Subject<unknown>; url: string; navigate: ReturnType<typeof vi.fn> };
  let supabase: {
    currentUser: ReturnType<typeof signal<any>>;
    isDemoUser: ReturnType<typeof signal<boolean>>;
    isAuthenticated: ReturnType<typeof vi.fn>;
    authLoading: ReturnType<typeof signal<boolean>>;
    signOut: ReturnType<typeof vi.fn>;
  };
  let translation: { t: ReturnType<typeof vi.fn>; setLanguage: ReturnType<typeof vi.fn> };
  let settings: {
    headerTabVisibility: ReturnType<typeof signal<any>>;
    clearAccountData: ReturnType<typeof vi.fn>;
    fetchSettingsFromApi: ReturnType<typeof vi.fn>;
  };
  let loadingSignals: Array<ReturnType<typeof signal<boolean>>>;
  let dataServices: Record<string, any>;
  let http: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    routerEvents = new Subject();
    router = { events: routerEvents, url: '/dashboard', navigate: vi.fn() };
    supabase = {
      currentUser: signal(null),
      isDemoUser: signal(false),
      isAuthenticated: vi.fn(() => Boolean(supabase.currentUser() || supabase.isDemoUser())),
      authLoading: signal(true),
      signOut: vi.fn().mockResolvedValue(undefined)
    };
    translation = {
      t: vi.fn((key: string) => key),
      setLanguage: vi.fn()
    };

    const dataService = () => ({
      isLoading: signal(false),
      clearAccountData: vi.fn(),
      setProducts: vi.fn(),
      setInvoices: vi.fn(),
      setPurchases: vi.fn(),
      setExpenses: vi.fn(),
      setCustomers: vi.fn()
    });
    const products = dataService();
    const invoices = dataService();
    const purchases = dataService();
    const expenses = dataService();
    const customers = dataService();
    dataServices = { products, invoices, purchases, expenses, customers };
    loadingSignals = [
      products.isLoading,
      invoices.isLoading,
      purchases.isLoading,
      expenses.isLoading,
      customers.isLoading
    ];
    settings = {
      headerTabVisibility: signal({
        dashboard: true, sales: true, invoices: true, inventory: true,
        purchases: true, challan: true, expenses: true, customers: true
      }),
      clearAccountData: vi.fn(),
      fetchSettingsFromApi: vi.fn()
    };
    http = {
      get: vi.fn(() => of({
        products: [], invoices: [], purchases: [], expenses: [], customers: []
      }))
    };

    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: HttpClient, useValue: http },
        { provide: Router, useValue: router },
        { provide: SupabaseService, useValue: supabase },
        { provide: TranslationService, useValue: translation },
        { provide: ProductService, useValue: products },
        { provide: InvoiceService, useValue: invoices },
        { provide: PurchaseService, useValue: purchases },
        { provide: ExpenseService, useValue: expenses },
        { provide: CustomerService, useValue: customers },
        { provide: SettingsService, useValue: settings },
        { provide: ChallanService, useValue: { clearAccountData: vi.fn() } },
        { provide: CartService, useValue: { clearAccountData: vi.fn() } },
        { provide: ConfirmationService, useValue: {} }
      ]
    });
    TestBed.overrideComponent(AppComponent, { set: { template: '' } });
    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
  });

  it('toggles and closes each navigation menu', () => {
    component.toggleQuickMenu();
    expect(component.showQuickMenu()).toBe(true);
    component.closeQuickMenu();
    expect(component.showQuickMenu()).toBe(false);

    component.toggleProfileMenu();
    expect(component.showProfileMenu()).toBe(true);
    component.closeProfileMenu();
    expect(component.showProfileMenu()).toBe(false);

    component.toggleLangMenu();
    expect(component.showLangMenu()).toBe(true);
    component.closeLangMenu();
    expect(component.showLangMenu()).toBe(false);
  });

  it('updates the language and closes the language menu', () => {
    component.toggleLangMenu();
    component.selectLanguage('hi');
    expect(translation.setLanguage).toHaveBeenCalledWith('hi');
    expect(component.showLangMenu()).toBe(false);
  });

  it('formats the signed-in user name, email, and initials', () => {
    supabase.currentUser.set({
      email: 'riya@example.com',
      user_metadata: { full_name: 'Riya Sharma' }
    });
    expect(component.getUserDisplayName()).toBe('Riya Sharma');
    expect(component.getUserEmail()).toBe('riya@example.com');
    expect(component.getUserInitials()).toBe('RI');

    supabase.currentUser.set({ email: 'riya@example.com', user_metadata: {} });
    expect(component.getUserDisplayName()).toBe('riya');

    supabase.currentUser.set(null);
    expect(component.getUserDisplayName()).toBe('header.storeManager');
    expect(component.getUserEmail()).toBe('demo@advikaerp.com');
  });

  it('filters navigation tabs by account visibility preferences', () => {
    settings.headerTabVisibility.set({
      dashboard: true, sales: false, invoices: true, inventory: true,
      purchases: true, challan: true, expenses: true, customers: true
    });
    expect(component.navTabs().map(tab => tab.path)).not.toContain('/sales');
    expect(component.navTabs().map(tab => tab.path)).toContain('/reports');
  });

  it('shows the relevant application loading message', () => {
    expect(component.loaderMessage()).toBe('loader.authenticating');
    supabase.authLoading.set(false);
    component.isRouteLoading.set(true);
    expect(component.loaderMessage()).toBe('loader.navigating');
    component.isRouteLoading.set(false);
    expect(component.loaderMessage()).toBe('loader.syncing');
  });

  it('tracks router navigation state', () => {
    routerEvents.next(new NavigationStart(1, '/customers'));
    expect(component.isRouteLoading()).toBe(true);
    routerEvents.next(new NavigationEnd(1, '/customers', '/customers'));
    expect(component.isRouteLoading()).toBe(false);
    routerEvents.next(new NavigationEnd(2, '/login?next=x#top', '/login?next=x#top'));
    expect(component.isAuthOrLanding()).toBe(true);
    routerEvents.next(new NavigationEnd(3, '/landing?source=header#top', '/landing?source=header#top'));
    expect(component.isAuthOrLanding()).toBe(true);
    routerEvents.next(new NavigationEnd(4, '/?source=brand', '/?source=brand'));
    expect(component.isAuthOrLanding()).toBe(true);
    routerEvents.next(new NavigationStart(5, '/inventory'));
    expect(component.isRouteLoading()).toBe(true);
    routerEvents.next(new NavigationCancel(5, '/inventory', 'cancelled'));
    expect(component.isRouteLoading()).toBe(false);
    routerEvents.next(new NavigationStart(6, '/reports'));
    routerEvents.next(new NavigationError(6, '/reports', new Error('route failed')));
    expect(component.isRouteLoading()).toBe(false);
    routerEvents.next(new NavigationEnd(7, '/sales', '/sales'));
    expect(component.isAuthOrLanding()).toBe(false);
  });

  it('combines loading state across the app services', () => {
    supabase.authLoading.set(false);
    expect(component.isAppLoading()).toBe(false);
    for (const loading of loadingSignals) {
      loading.set(true);
      expect(component.isAppLoading()).toBe(true);
      loading.set(false);
    }
    component.isRouteLoading.set(true);
    expect(component.isAppLoading()).toBe(true);
  });

  it('loads dashboard data and clears loading indicators on success', () => {
    const dashboard = {
      products: [{ id: 'p1' }],
      invoices: [{ id: 'i1' }],
      purchases: [{ id: 'po1' }],
      expenses: [{ id: 'e1' }],
      customers: [{ id: 'c1' }]
    };
    http.get.mockReturnValue(of(dashboard));

    component.fetchDashboardData(null);

    expect(http.get).toHaveBeenCalledWith('/api/dashboard');
    expect(dataServices.products.setProducts).toHaveBeenCalledWith(dashboard.products);
    expect(dataServices.invoices.setInvoices).toHaveBeenCalledWith(dashboard.invoices);
    expect(dataServices.purchases.setPurchases).toHaveBeenCalledWith(dashboard.purchases);
    expect(dataServices.expenses.setExpenses).toHaveBeenCalledWith(dashboard.expenses);
    expect(dataServices.customers.setCustomers).toHaveBeenCalledWith(dashboard.customers);
    expect(loadingSignals.every(loading => !loading())).toBe(true);
  });

  it('clears dashboard loading indicators after an API error', () => {
    http.get.mockReturnValue(throwError(() => new Error('offline')));

    component.fetchDashboardData(null);

    expect(loadingSignals.every(loading => !loading())).toBe(true);
  });

  it('clears dashboard loading indicators when the API returns no response body', () => {
    http.get.mockReturnValue(of(null));

    component.fetchDashboardData(null);

    expect(loadingSignals.every(loading => !loading())).toBe(true);
  });

  it('does not update dashboard data when a response belongs to an old account', () => {
    const pendingResponse = new Subject<any>();
    http.get.mockReturnValue(pendingResponse);
    supabase.currentUser.set({ id: 'user-1' });
    fixture.detectChanges();

    component.fetchDashboardData('user-1');
    supabase.currentUser.set({ id: 'user-2' });
    fixture.detectChanges();
    pendingResponse.next({ products: [{ id: 'stale' }] });

    expect(dataServices.products.setProducts).not.toHaveBeenCalledWith([{ id: 'stale' }]);
  });

  it('ignores a superseded dashboard request for the same account', () => {
    const staleResponse = new Subject<any>();
    http.get.mockReturnValueOnce(staleResponse).mockReturnValueOnce(of({ products: [{ id: 'current' }] }));

    component.fetchDashboardData(null);
    component.fetchDashboardData(null);
    staleResponse.next({ products: [{ id: 'stale' }] });

    expect(dataServices.products.setProducts).toHaveBeenCalledOnce();
    expect(dataServices.products.setProducts).toHaveBeenCalledWith([{ id: 'current' }]);
    expect(loadingSignals.every(loading => !loading())).toBe(true);
  });

  it('leaves absent dashboard collections unchanged', () => {
    http.get.mockReturnValue(of({}));
    component.fetchDashboardData(null);

    for (const service of Object.values(dataServices)) {
      expect(service.setProducts ?? service.setInvoices ?? service.setPurchases ?? service.setExpenses ?? service.setCustomers)
        .not.toHaveBeenCalled();
    }
  });

  it('clears account data and resets dashboard state on sign-out', () => {
    supabase.currentUser.set({ id: 'user-1' });
    fixture.detectChanges();
    component.dashboardFetched.set(true);
    supabase.currentUser.set(null);
    fixture.detectChanges();

    expect(settings.clearAccountData).toHaveBeenLastCalledWith(null);
    expect(component.dashboardFetched()).toBe(false);
  });

  it('clears data when the active account changes', () => {
    const products = TestBed.inject(ProductService);
    const invoices = TestBed.inject(InvoiceService);
    const purchases = TestBed.inject(PurchaseService);
    const expenses = TestBed.inject(ExpenseService);
    const customers = TestBed.inject(CustomerService);
    const challans = TestBed.inject(ChallanService);
    const cart = TestBed.inject(CartService);

    supabase.currentUser.set({ id: 'user-1' });
    fixture.detectChanges();
    expect(products.clearAccountData).toHaveBeenCalled();
    expect(invoices.clearAccountData).toHaveBeenCalled();
    expect(purchases.clearAccountData).toHaveBeenCalled();
    expect(expenses.clearAccountData).toHaveBeenCalled();
    expect(customers.clearAccountData).toHaveBeenCalled();
    expect(challans.clearAccountData).toHaveBeenCalled();
    expect(cart.clearAccountData).toHaveBeenCalled();
    expect(settings.clearAccountData).toHaveBeenCalledWith('user-1');

    supabase.currentUser.set({ id: 'user-2' });
    fixture.detectChanges();
    expect(settings.clearAccountData).toHaveBeenLastCalledWith('user-2');
  });

  it('fetches dashboard and settings data after navigating to a private route while authenticated', () => {
    supabase.currentUser.set({ id: 'user-1' });
    supabase.authLoading.set(false);
    routerEvents.next(new NavigationEnd(1, '/dashboard', '/dashboard'));
    fixture.detectChanges();

    expect(component.dashboardFetched()).toBe(true);
    expect(http.get).toHaveBeenCalledWith('/api/dashboard');
    expect(settings.fetchSettingsFromApi).toHaveBeenCalled();
  });

  it('signs out and routes back to login', async () => {
    component.toggleProfileMenu();
    await component.onSignOut();
    expect(supabase.signOut).toHaveBeenCalledOnce();
    expect(component.showProfileMenu()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
