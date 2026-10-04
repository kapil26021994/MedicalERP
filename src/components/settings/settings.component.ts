
import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HEADER_TABS, HeaderTabId, SettingsService } from '../../services/settings.service';
import { SupabaseService } from '../../services/supabase.service';
import { TranslationService, Language } from '../../services/translation.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent implements OnInit {
  private fb: FormBuilder = inject(FormBuilder);
  settingsService = inject(SettingsService);
  supabaseService = inject(SupabaseService);
  ts = inject(TranslationService);

  showImportConfirmation = signal(false);
  importFile = signal<File | null>(null);
  supabaseSaveMsg = signal<string | null>(null);
  selectedLanguage = signal<Language>('en');
  headerTabs = HEADER_TABS;


  settingsForm = this.fb.group({
    shopName: ['', Validators.required],
    shopAddress: ['', Validators.required],
    shopPhone: ['', Validators.required],
  });

  supabaseForm = this.fb.group({
    url: [this.supabaseService.url(), [Validators.required]],
    anonKey: [this.supabaseService.anonKey(), [Validators.required]],
  });

  showSqlSchema = signal(false);
  sqlCopied = signal(false);

  sqlScript = `-- Run this script in your Supabase Dashboard -> SQL Editor (https://supabase.com/dashboard) to create all required tables & permissions:

CREATE TABLE IF NOT EXISTS public.expenses (
  id VARCHAR(100) PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.customers (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255) DEFAULT '',
  purchase_history TEXT[] DEFAULT '{}',
  due_amount NUMERIC(12,2) DEFAULT 0.00,
  paid_amount NUMERIC(12,2) DEFAULT 0.00,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.products (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) DEFAULT 'General',
  sku VARCHAR(100) UNIQUE NOT NULL,
  size VARCHAR(50) DEFAULT 'Free Size',
  color VARCHAR(50) DEFAULT '',
  purchase_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  selling_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  discount_percent NUMERIC(5,2) DEFAULT 0.00,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_stock_alert INTEGER DEFAULT 5,
  image_urls TEXT[] DEFAULT '{}',
  description TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id VARCHAR(100) PRIMARY KEY,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  customer JSONB NOT NULL,
  items JSONB NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  payment_mode VARCHAR(50) DEFAULT 'Cash',
  total_discount NUMERIC(12,2) DEFAULT 0.00,
  amount_paid NUMERIC(12,2) DEFAULT 0.00,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchases (
  id VARCHAR(100) PRIMARY KEY,
  supplier VARCHAR(255) NOT NULL,
  supplier_invoice_number VARCHAR(100) DEFAULT '',
  purchase_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  items JSONB NOT NULL,
  final_bill_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  paid_amount NUMERIC(12,2) DEFAULT 0.00,
  due_amount NUMERIC(12,2) DEFAULT 0.00,
  bill_image_url TEXT DEFAULT '',
  cgst NUMERIC(12,2) DEFAULT 0.00,
  sgst NUMERIC(12,2) DEFAULT 0.00,
  total_tax NUMERIC(12,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.procurement_items (
  id VARCHAR(100) PRIMARY KEY,
  purchase_id VARCHAR(100) NOT NULL,
  supplier VARCHAR(255) NOT NULL,
  supplier_invoice_number VARCHAR(100) DEFAULT '',
  purchase_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  product_id VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) DEFAULT '',
  batch_no VARCHAR(100) DEFAULT '',
  exp_date VARCHAR(50) DEFAULT '',
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  free_qty NUMERIC(12,2) DEFAULT 0,
  cost_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  mrp NUMERIC(12,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_logs (
  id VARCHAR(100) PRIMARY KEY,
  product_id VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  quantity_change INTEGER NOT NULL,
  reason TEXT DEFAULT '',
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS) & Add Permissions
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on expenses" ON public.expenses;
CREATE POLICY "Allow all on expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on customers" ON public.customers;
CREATE POLICY "Allow all on customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on products" ON public.products;
CREATE POLICY "Allow all on products" ON public.products FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on invoices" ON public.invoices;
CREATE POLICY "Allow all on invoices" ON public.invoices FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on purchases" ON public.purchases;
CREATE POLICY "Allow all on purchases" ON public.purchases FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on procurement_items" ON public.procurement_items;
CREATE POLICY "Allow all on procurement_items" ON public.procurement_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on inventory_logs" ON public.inventory_logs;
CREATE POLICY "Allow all on inventory_logs" ON public.inventory_logs FOR ALL USING (true) WITH CHECK (true);`;

  copySql() {
    navigator.clipboard.writeText(this.sqlScript);
    this.sqlCopied.set(true);
    setTimeout(() => this.sqlCopied.set(false), 3000);
  }

  ngOnInit() {
    this.settingsForm.patchValue(this.settingsService.businessProfile());
    this.selectedLanguage.set(this.ts.currentLang());
  }

  selectLanguageOption(lang: Language) {
    this.selectedLanguage.set(lang);
  }

  setHeaderTabVisibility(tabId: HeaderTabId, event: Event): void {
    this.settingsService.setHeaderTabVisibility(
      tabId,
      (event.target as HTMLInputElement).checked
    );
  }

  saveSettings() {
    if (this.settingsForm.invalid) {
      return;
    }
    this.ts.setLanguage(this.selectedLanguage());
    this.settingsService.updateProfile(this.settingsForm.getRawValue());
    alert('Settings saved successfully!');
  }

  saveSupabaseConfig() {
    if (this.supabaseForm.invalid) return;
    const { url, anonKey } = this.supabaseForm.getRawValue();
    const result = this.supabaseService.saveCredentials(url || '', anonKey || '');
    if (result.success) {
      this.supabaseSaveMsg.set('Supabase configuration updated successfully!');
      setTimeout(() => this.supabaseSaveMsg.set(null), 4000);
    } else {
      alert(result.error || 'Failed to save configuration.');
    }
  }

  clearSupabaseConfig() {
    this.supabaseService.clearCredentials();
    this.supabaseForm.reset({ url: '', anonKey: '' });
    this.supabaseSaveMsg.set('Supabase credentials cleared.');
    setTimeout(() => this.supabaseSaveMsg.set(null), 4000);
  }

  exportAppData() {
    this.settingsService.exportData();
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.importFile.set(file);
      this.showImportConfirmation.set(true);
    }
    (event.target as HTMLInputElement).value = '';
  }

  confirmImport() {
    const file = this.importFile();
    if (file) {
      this.settingsService.importData(file).then(() => {
        window.location.reload();
      }).catch(err => {
        console.error("Import failed in component", err);
      }).finally(() => {
        this.showImportConfirmation.set(false);
        this.importFile.set(null);
      });
    }
  }

  async resetAllData() {
    if (confirm('CRITICAL ACTION: This will permanently delete all records (Invoices, Purchases, Products, Customers, Expenses) from both local storage and Supabase. This cannot be undone. Are you absolutely sure?')) {
      const result = await this.settingsService.resetDatabase();
      if (result.success) {
        alert(result.message || 'Database reset successfully.');
        window.location.reload();
      } else {
        alert('Error: ' + result.error);
      }
    }
  }
}
