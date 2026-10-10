import { Injectable, signal, effect, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ProductService } from './product.service';
import { CustomerService } from './customer.service';
import { InvoiceService } from './invoice.service';
import { PurchaseService } from './purchase.service';
import { ExpenseService } from './expense.service';
import { InvoiceTemplateId } from '../models/invoice.model';

import { SupabaseService } from './supabase.service';

export interface BusinessProfile {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  gstin?: string;
  defaultTemplate?: InvoiceTemplateId;
}

export interface InvoiceTemplateOption {
  id: InvoiceTemplateId;
  name: string;
  description: string;
  icon: string;
  badgeColor: string;
}

export type HeaderTabId =
  | 'dashboard'
  | 'sales'
  | 'invoices'
  | 'inventory'
  | 'purchases'
  | 'challan'
  | 'expenses'
  | 'customers';
export type HeaderTabVisibility = Record<HeaderTabId, boolean>;

export const HEADER_TABS: { id: HeaderTabId; label: string; translationKey: string }[] = [
  { id: 'dashboard', label: 'Dashboard', translationKey: 'nav.dashboard' },
  { id: 'sales', label: 'Sales', translationKey: 'nav.sales' },
  { id: 'invoices', label: 'Invoices', translationKey: 'nav.invoices' },
  { id: 'inventory', label: 'Inventory', translationKey: 'nav.inventory' },
  { id: 'purchases', label: 'Purchases', translationKey: 'nav.purchases' },
  { id: 'challan', label: 'Challan', translationKey: 'nav.challan' },
  { id: 'expenses', label: 'Expenses', translationKey: 'nav.expenses' },
  { id: 'customers', label: 'Customers', translationKey: 'nav.customers' }
];

const DEFAULT_HEADER_TAB_VISIBILITY: HeaderTabVisibility = {
  dashboard: true,
  sales: true,
  invoices: true,
  inventory: true,
  purchases: true,
  challan: true,
  expenses: true,
  customers: true
};

export const INVOICE_TEMPLATES: InvoiceTemplateOption[] = [
  {
    id: 'modern',
    name: 'Modern Classic',
    description: 'Clean Indigo header with professional card borders and structured ledger tables',
    icon: 'space_dashboard',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200'
  },
  {
    id: 'thermal',
    name: 'Thermal POS Slip',
    description: '80mm POS receipt layout with dashed separators and compact item formatting',
    icon: 'receipt',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200'
  },
  {
    id: 'minimal',
    name: 'Minimalist Elegant',
    description: 'Subtle slate lines, spacious margins and ultra-clean monochrome typography',
    icon: 'auto_awesome',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-200'
  },
  {
    id: 'corporate',
    name: 'Corporate GST Tax Invoice',
    description: 'Formal tax invoice structure with GST breakdown, HSN codes & authorized signature block',
    icon: 'domain',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200'
  },
  {
    id: 'bold',
    name: 'Bold Emerald Banner',
    description: 'High-contrast vibrant emerald top banner with prominent total highlight card',
    icon: 'palette',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200'
  }
];

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private http = inject(HttpClient);
  private productService = inject(ProductService);
  private customerService = inject(CustomerService);
  private invoiceService = inject(InvoiceService);
  private purchaseService = inject(PurchaseService);
  private expenseService = inject(ExpenseService);
  private supabaseService = inject(SupabaseService);
  
  private apiUrl = '/api/settings';
  private defaultProfile: BusinessProfile = {
    shopName: 'Advika collection',
    shopAddress: '71,C saket dham,indore',
    shopPhone: '8602689698',
    gstin: '23AABCT123411Z5',
    defaultTemplate: 'modern'
  };

  businessProfile = signal<BusinessProfile>(this.defaultProfile);
  defaultTemplate = signal<InvoiceTemplateId>('modern');
  headerTabVisibility = signal<HeaderTabVisibility>(this.readHeaderTabVisibility(null));
  private activeAccountId: string | null = null;
  private settingsLoaded = false;
  private settingsLoading = false;
  private requestVersion = 0;

  setHeaderTabVisibility(tabId: HeaderTabId, visible: boolean): void {
    this.saveHeaderTabVisibility({ ...this.headerTabVisibility(), [tabId]: visible });
  }

  saveHeaderTabVisibility(visibility: HeaderTabVisibility): void {
    const updated = { ...visibility };
    this.headerTabVisibility.set(updated);
    if (typeof localStorage !== 'undefined' && this.activeAccountId) {
      localStorage.setItem(this.headerTabStorageKey(this.activeAccountId), JSON.stringify(updated));
    }
  }

  private headerTabStorageKey(accountId: string): string {
    return `header_tab_visibility_${encodeURIComponent(accountId)}`;
  }

  private readHeaderTabVisibility(accountId: string | null): HeaderTabVisibility {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_HEADER_TAB_VISIBILITY };
    if (!accountId) return { ...DEFAULT_HEADER_TAB_VISIBILITY };

    const stored = localStorage.getItem(this.headerTabStorageKey(accountId));
    if (!stored) return { ...DEFAULT_HEADER_TAB_VISIBILITY };

    try {
      const parsed = JSON.parse(stored) as Partial<HeaderTabVisibility>;
      return Object.fromEntries(
        HEADER_TABS.map(({ id }) => [id, typeof parsed[id] === 'boolean' ? parsed[id] : true])
      ) as HeaderTabVisibility;
    } catch (error) {
      console.warn('Could not read saved header tab visibility settings:', error);
      return { ...DEFAULT_HEADER_TAB_VISIBILITY };
    }
  }

  clearAccountData(accountId: string | null): void {
    this.requestVersion++;
    this.activeAccountId = accountId;
    this.settingsLoaded = false;
    this.settingsLoading = false;
    this.businessProfile.set({ ...this.defaultProfile });
    this.defaultTemplate.set('modern');
    this.headerTabVisibility.set(this.readHeaderTabVisibility(accountId));
  }

  fetchSettingsFromApi() {
    if (!this.supabaseService.isAuthenticated() || this.settingsLoaded || this.settingsLoading) return;
    this.settingsLoading = true;
    const requestVersion = this.requestVersion;
    this.http.get<any>(this.apiUrl).subscribe({
      next: (res) => {
        if (requestVersion !== this.requestVersion) return;
        this.settingsLoading = false;
        this.settingsLoaded = true;
        if (res) {
          const profile: BusinessProfile = {
            shopName: res.businessName || res.shopName || this.businessProfile().shopName,
            shopAddress: res.address || res.shopAddress || this.businessProfile().shopAddress,
            shopPhone: res.phone || res.shopPhone || this.businessProfile().shopPhone,
            gstin: res.gstin || this.businessProfile().gstin,
            defaultTemplate: res.defaultTemplate || this.businessProfile().defaultTemplate || 'modern'
          };
          this.businessProfile.set({ ...this.defaultProfile, ...profile });
          if (profile.defaultTemplate) {
            this.defaultTemplate.set(profile.defaultTemplate);
          }
        }
      },
      error: (err) => {
        if (requestVersion !== this.requestVersion) return;
        this.settingsLoading = false;
        this.settingsLoaded = true;
        if (this.supabaseService.isAuthenticated()) {
          if (err.error instanceof SyntaxError || (typeof err.error === 'string' && err.error.includes('<!DOCTYPE'))) {
            console.log('Settings API notice: Server returned page HTML during navigation.');
          } else {
            console.log('Settings API info: Using active local settings profile.', err?.message || err);
          }
        }
      }
    });
  }

  updateProfile(newProfile: BusinessProfile) {
    this.businessProfile.set(newProfile);
    if (newProfile.defaultTemplate) {
      this.defaultTemplate.set(newProfile.defaultTemplate);
    }
    // Make network HTTP API call so it is logged in DevTools Network tab
    this.http.put<any>(this.apiUrl, {
      businessName: newProfile.shopName,
      phone: newProfile.shopPhone,
      address: newProfile.shopAddress,
      gstin: newProfile.gstin,
      defaultTemplate: newProfile.defaultTemplate
    }).subscribe({
      next: (res) => console.log('Settings updated on server API:', res),
      error: (err) => console.warn('Settings update API note:', err)
    });
  }

  setTemplate(templateId: InvoiceTemplateId) {
    this.defaultTemplate.set(templateId);
    this.businessProfile.update(p => ({ ...p, defaultTemplate: templateId }));
  }
  
  exportData() {
    const appData = {
      products: this.productService.products(),
      customers: this.customerService.customers(),
      invoices: this.invoiceService.invoices(),
      purchases: this.purchaseService.purchases(),
      expenses: this.expenseService.expenses(),
      settings: this.businessProfile(),
      lastInvoiceNumber: (this.invoiceService as any).lastInvoiceNumber(), // Access private signal
    };

    const blob = new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `advika-pos-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  importData(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);

          // Basic validation
          if (!data.products || !data.customers || !data.invoices || !data.purchases || !data.expenses || !data.settings) {
            throw new Error('Invalid or corrupted backup file.');
          }

          // Restore data
          this.productService.products.set(data.products);
          this.customerService.customers.set(data.customers);
          const invoicesWithDates = data.invoices.map((inv: any) => ({ ...inv, date: new Date(inv.date) }));
          this.invoiceService.invoices.set(invoicesWithDates);
          const purchasesWithDates = data.purchases.map((p: any) => ({ ...p, purchaseDate: new Date(p.purchaseDate) }));
          this.purchaseService.purchases.set(purchasesWithDates);
          const expensesWithDates = data.expenses.map((e: any) => ({ ...e, date: new Date(e.date) }));
          this.expenseService.expenses.set(expensesWithDates);
          
          this.businessProfile.set(data.settings);
          if (data.lastInvoiceNumber) {
            (this.invoiceService as any).lastInvoiceNumber.set(data.lastInvoiceNumber);
          }
          
          alert('Data imported successfully! The application will now reload.');
          resolve();
        } catch (e) {
          console.error('Error importing data:', e);
          const message = e instanceof Error ? e.message : 'An unknown error occurred during import.';
          alert(`Import failed: ${message}`);
          reject(e);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    });
  }

  async resetDatabase(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const session = this.supabaseService.currentSession();
      if (!session?.access_token) {
        return { success: false, error: 'Sign in with an administrator account before resetting data.' };
      }
      const response = await fetch('/api/maintenance/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: this.supabaseService.anonKey()
        }
      });
      const result = await response.json();
      if (result.success) {
        // Refresh local services state
        this.productService.fetchProductsFromApi(true);
        this.customerService.fetchCustomers(true);
        this.invoiceService.fetchInvoicesFromApi(true);
        this.purchaseService.fetchPurchasesFromApi(true);
        this.expenseService.fetchExpenses(true);
        return { success: true, message: result.message };
      } else {
        return { success: false, error: result.error || 'Failed to reset database.' };
      }
    } catch (err: any) {
      console.error('Reset database error:', err);
      return { success: false, error: err.message || 'An unexpected error occurred.' };
    }
  }
}
