
import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BusinessProfile, HEADER_TABS, HeaderTabId, HeaderTabVisibility, SettingsService } from '../../services/settings.service';
import { SupabaseService } from '../../services/supabase.service';
import { TranslationService, Language } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';

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
  private toastService = inject(ToastService);

  showImportConfirmation = signal(false);
  importFile = signal<File | null>(null);
  supabaseSaveMsg = signal<string | null>(null);
  selectedLanguage = signal<Language>('en');
  headerTabs = HEADER_TABS;
  headerTabDraft = signal<HeaderTabVisibility>({ ...this.settingsService.headerTabVisibility() });
  hasUnsavedHeaderTabChanges = signal(false);


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

CREATE TABLE IF NOT EXISTS public.challans (
  id VARCHAR(100) PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  challan_number VARCHAR(100) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50) DEFAULT '',
  challan_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  due_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'Open',
  items JSONB NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.challans ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.challans ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00;

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

CREATE TABLE IF NOT EXISTS public.settings (
  id INT PRIMARY KEY DEFAULT 1,
  business_name VARCHAR(255) DEFAULT 'Advika ERP',
  phone VARCHAR(50) DEFAULT '',
  email VARCHAR(255) DEFAULT '',
  address TEXT DEFAULT '',
  gstin VARCHAR(100) DEFAULT '',
  currency_symbol VARCHAR(10) DEFAULT '₹',
  receipt_footer TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.account_settings (
  user_id UUID PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Existing rows deliberately remain unowned (NULL) and are hidden until ownership is verified.
DO $$
DECLARE
  target_table TEXT;
  policy_record RECORD;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'customers', 'products', 'invoices', 'purchases', 'expenses',
    'procurement_items', 'inventory_logs', 'challans', 'settings', 'account_settings'
  ] LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE',
      target_table
    );
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id SET DEFAULT auth.uid()', target_table);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);

    FOR policy_record IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = target_table
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', policy_record.policyname, target_table);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())',
      'Users can manage own ' || target_table,
      target_table
    );
  END LOOP;
END $$;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_sku_key;
DROP INDEX IF EXISTS public.idx_products_unique_name;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_user_name
  ON public.products (user_id, LOWER(TRIM(name)));
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_user_sku
  ON public.products (user_id, UPPER(TRIM(sku)));

NOTIFY pgrst, 'reload schema';`;

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
    const visible = (event.target as HTMLInputElement).checked;
    this.headerTabDraft.update(current => ({ ...current, [tabId]: visible }));
    this.hasUnsavedHeaderTabChanges.set(
      HEADER_TABS.some(tab =>
        this.headerTabDraft()[tab.id] !== this.settingsService.headerTabVisibility()[tab.id]
      )
    );
  }

  saveSettings() {
    if (this.settingsForm.invalid) {
      return;
    }
    this.settingsService.saveHeaderTabVisibility(this.headerTabDraft());
    this.hasUnsavedHeaderTabChanges.set(false);
    this.ts.setLanguage(this.selectedLanguage());
    const formValue = this.settingsForm.getRawValue();
    const profile: BusinessProfile = {
      ...this.settingsService.businessProfile(),
      shopName: formValue.shopName ?? '',
      shopAddress: formValue.shopAddress ?? '',
      shopPhone: formValue.shopPhone ?? ''
    };
    this.settingsService.updateProfile(profile);
    this.toastService.success('Settings saved successfully.');
  }

  saveSupabaseConfig() {
    if (this.supabaseForm.invalid) return;
    const { url, anonKey } = this.supabaseForm.getRawValue();
    const result = this.supabaseService.saveCredentials(url || '', anonKey || '');
    if (result.success) {
      this.supabaseSaveMsg.set('Supabase configuration updated successfully!');
      setTimeout(() => this.supabaseSaveMsg.set(null), 4000);
      this.toastService.success('Supabase configuration updated.');
    } else {
      this.toastService.error(result.error || 'Failed to save configuration.');
    }
  }

  clearSupabaseConfig() {
    this.supabaseService.clearCredentials();
    this.supabaseForm.reset({ url: '', anonKey: '' });
    this.supabaseSaveMsg.set('Supabase credentials cleared.');
    setTimeout(() => this.supabaseSaveMsg.set(null), 4000);
    this.toastService.success('Supabase credentials cleared.');
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
        this.toastService.success('Data imported successfully.');
        setTimeout(() => window.location.reload(), 1200);
      }).catch(err => {
        console.error("Import failed in component", err);
        this.toastService.error(err instanceof Error ? err.message : 'Failed to import data.');
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
        this.toastService.success(result.message || 'Database reset successfully.');
        setTimeout(() => window.location.reload(), 1200);
      } else {
        this.toastService.error(result.error || 'Failed to reset database.');
      }
    }
  }
}
