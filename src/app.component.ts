import { Component, ChangeDetectionStrategy, inject, signal, computed, effect } from '@angular/core';
import { RouterOutlet, Router, NavigationStart, NavigationEnd, NavigationCancel, NavigationError, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { SupabaseService } from './services/supabase.service';
import { TranslationService, Language } from './services/translation.service';
import { ProductService } from './services/product.service';
import { InvoiceService } from './services/invoice.service';
import { PurchaseService } from './services/purchase.service';
import { ExpenseService } from './services/expense.service';
import { CustomerService } from './services/customer.service';
import { ConfirmationService } from './services/confirmation.service';
import { SettingsService } from './services/settings.service';
import { LoaderComponent } from './components/layout/loader.component';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  imports: [
    CommonModule, 
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LoaderComponent
  ],
  styles: [`
    .active-nav-tab {
      background-color: #2563eb !important;
      color: #ffffff !important;
      font-weight: 700 !important;
      box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2) !important;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private router = inject(Router);
  private http = inject(HttpClient);
  private productService = inject(ProductService);
  private invoiceService = inject(InvoiceService);
  private purchaseService = inject(PurchaseService);
  private expenseService = inject(ExpenseService);
  private customerService = inject(CustomerService);
  private settingsService = inject(SettingsService);
  supabaseService = inject(SupabaseService);
  ts = inject(TranslationService);
  confirmationService = inject(ConfirmationService);
  dashboardFetched = signal(false);

  isRouteLoading = signal(false);

  isAppLoading = computed(() => 
    this.productService.isLoading() || 
    this.invoiceService.isLoading() || 
    this.purchaseService.isLoading() || 
    this.expenseService.isLoading() ||
    this.customerService.isLoading() ||
    this.isRouteLoading() ||
    this.supabaseService.authLoading()
  );

  loaderMessage = computed(() => {
    if (this.supabaseService.authLoading()) {
      return this.ts.t('loader.authenticating');
    }
    if (this.isRouteLoading()) {
      return this.ts.t('loader.navigating');
    }
    return this.ts.t('loader.syncing');
  });

  constructor() {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.isRouteLoading.set(true);
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.isRouteLoading.set(false);
      }
    });

    effect(() => {
      const authenticated = this.supabaseService.isAuthenticated();
      const loading = this.supabaseService.authLoading();
      const publicRoute = this.isAuthOrLanding();
      if (authenticated && !loading && !publicRoute) {
        if (!this.dashboardFetched()) {
          this.dashboardFetched.set(true);
          this.fetchDashboardData();
        }
      } else if (!authenticated || publicRoute) {
        this.dashboardFetched.set(false);
        if (!authenticated) {
          // Reset service loaded flags so they refetch on subsequent login
          this.productService.isLoaded.set(false);
          this.invoiceService.isLoaded.set(false);
          this.purchaseService.isLoaded.set(false);
          this.expenseService.isLoaded.set(false);
          this.customerService.isLoaded.set(false);
        }
      }
    });
  }

  fetchDashboardData() {
    this.productService.isLoading.set(true);
    this.invoiceService.isLoading.set(true);
    this.purchaseService.isLoading.set(true);
    this.expenseService.isLoading.set(true);
    this.customerService.isLoading.set(true);

    this.http.get<any>('/api/dashboard').subscribe({
      next: (res) => {
        if (res) {
          if (res.products) this.productService.setProducts(res.products);
          if (res.invoices) this.invoiceService.setInvoices(res.invoices);
          if (res.purchases) this.purchaseService.setPurchases(res.purchases);
          if (res.expenses) this.expenseService.setExpenses(res.expenses);
          if (res.customers) this.customerService.setCustomers(res.customers);
        }
        this.productService.isLoading.set(false);
        this.invoiceService.isLoading.set(false);
        this.purchaseService.isLoading.set(false);
        this.expenseService.isLoading.set(false);
        this.customerService.isLoading.set(false);
      },
      error: () => {
        this.productService.isLoading.set(false);
        this.invoiceService.isLoading.set(false);
        this.purchaseService.isLoading.set(false);
        this.expenseService.isLoading.set(false);
        this.customerService.isLoading.set(false);
      }
    });
  }

  showQuickMenu = signal(false);
  showProfileMenu = signal(false);
  showLangMenu = signal(false);
  isAuthOrLanding = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(event => {
        const cleanUrl = event.urlAfterRedirects.split('?')[0].split('#')[0];
        return ['/landing', '/login', '/'].includes(cleanUrl);
      })
    ), {
      initialValue: (() => {
        const cleanUrl = this.router.url.split('?')[0].split('#')[0];
        return ['/landing', '/login', '/'].includes(cleanUrl);
      })()
    }
  );

  navTabs = computed(() => {
    const visibility = this.settingsService.headerTabVisibility();
    const visibilityByPath: Record<string, boolean> = {
      '/dashboard': visibility.dashboard,
      '/sales': visibility.sales,
      '/inventory': visibility.inventory,
      '/purchases': visibility.purchases,
      '/invoices': visibility.invoices,
      '/expenses': visibility.expenses,
      '/customers': visibility.customers
    };
    const tabs = [
      { name: this.ts.t('nav.dashboard'), path: '/dashboard', icon: 'dashboard', badge: null },
      { name: this.ts.t('nav.sales'), path: '/sales', icon: 'analytics', badge: null },
      { name: this.ts.t('nav.inventory'), path: '/inventory', icon: 'inventory_2', badge: null },
      { name: this.ts.t('nav.purchaseOrders'), path: '/purchases', icon: 'local_shipping', badge: null },
      { name: this.ts.t('nav.invoices'), path: '/invoices', icon: 'receipt_long', badge: null },
      { name: this.ts.t('nav.expenses'), path: '/expenses', icon: 'payments', badge: null },
      { name: this.ts.t('nav.customers'), path: '/customers', icon: 'groups', badge: null },
      { name: this.ts.t('nav.reports'), path: '/reports', icon: 'bar_chart', badge: null },
      { name: this.ts.t('nav.settings'), path: '/settings', icon: 'settings', badge: null },
    ];

    return tabs.filter(tab => visibilityByPath[tab.path] !== false);
  });

  toggleQuickMenu(): void {
    this.showQuickMenu.update(v => !v);
  }

  closeQuickMenu(): void {
    this.showQuickMenu.set(false);
  }

  toggleProfileMenu(): void {
    this.showProfileMenu.update(v => !v);
  }

  closeProfileMenu(): void {
    this.showProfileMenu.set(false);
  }

  toggleLangMenu(): void {
    this.showLangMenu.update(v => !v);
  }

  closeLangMenu(): void {
    this.showLangMenu.set(false);
  }

  selectLanguage(lang: Language): void {
    this.ts.setLanguage(lang);
    this.closeLangMenu();
  }

  getUserDisplayName(): string {
    const user = this.supabaseService.currentUser();
    if (user?.user_metadata?.['full_name']) {
      return user.user_metadata['full_name'];
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return this.ts.t('header.storeManager');
  }

  getUserEmail(): string {
    return this.supabaseService.currentUser()?.email || 'demo@advikaerp.com';
  }

  getUserInitials(): string {
    const name = this.getUserDisplayName();
    return name.slice(0, 2).toUpperCase();
  }

  async onSignOut() {
    this.closeProfileMenu();
    await this.supabaseService.signOut();
    this.router.navigate(['/login']);
  }
}
