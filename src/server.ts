import express from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from '@google/genai';
import { AngularNodeAppEngine, createNodeRequestHandler, isMainModule, writeResponseToNodeResponse } from '@angular/ssr/node';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AsyncLocalStorage } from 'node:async_hooks';

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '20mb' }));

// Prevent outgoing fetch from sending invalid host headers (e.g. host: localhost:3000) to external APIs
const originalFetch = global.fetch;
if (originalFetch) {
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    // Strip forbidden host headers from Request object if passed as input
    if (typeof input === 'object' && input !== null && 'headers' in input && (input as any).headers) {
      const h = (input as any).headers;
      if (typeof h.delete === 'function') {
        try {
          h.delete('host');
          h.delete('Host');
        } catch (e) {}
      }
    }

    // Strip forbidden host headers from init options
    if (init && init.headers) {
      if (init.headers instanceof Headers) {
        init.headers.delete('host');
        init.headers.delete('Host');
      } else if (Array.isArray(init.headers)) {
        init.headers = init.headers.filter(([key]) => key.toLowerCase() !== 'host');
      } else if (typeof init.headers === 'object') {
        const newHeaders: Record<string, string> = {};
        for (const [key, value] of Object.entries(init.headers)) {
          if (key.toLowerCase() !== 'host') {
            newHeaders[key] = value as string;
          }
        }
        init.headers = newHeaders;
      }
    }
    return originalFetch(input, init);
  };
}

// Lazy Gemini AI Client Initialization (Server-side)
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not configured.');
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return geminiClient;
}

// ==========================================
// DATA INTERFACES
// ==========================================

export interface ICustomer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  purchaseHistory?: string[];
  dueAmount?: number;
  paidAmount?: number;
  notes?: string;
  createdAt?: string;
}

export interface IProduct {
  id: string;
  name: string;
  category: string;
  sku: string;
  size?: 'S' | 'M' | 'L' | 'XL' | 'Free Size';
  color?: string;
  purchasePrice: number;
  sellingPrice: number;
  discountPercent?: number;
  quantity: number;
  minStockAlert?: number;
  imageUrls?: string[];
  description?: string;
  createdAt?: string;
}

export interface ICartItem {
  id: string;
  name: string;
  cartQuantity: number;
  sellingPrice: number;
  discountPercent?: number;
  isCustom?: boolean;
  sku?: string;
  imageUrl?: string;
}

export interface IInvoice {
  id: string;
  date: string;
  customer: ICustomer;
  items: ICartItem[];
  subtotal: number;
  total: number;
  paymentMode: 'Cash' | 'UPI' | 'Card';
  totalDiscount?: number;
  amountPaid?: number;
  notes?: string;
  createdAt?: string;
}

export interface IPurchaseItem {
  hsnCode?: string;
  product: { id?: string; name: string; isNew?: boolean; sku?: string; code?: string };
  oldMrp?: number;
  pack?: string;
  batchNo?: string;
  expDate?: string;
  mrp?: number;
  quantity: number;
  freeQty?: number;
  costPrice: number;
  discountPercent?: number;
  gstPercent?: number;
  sgstPercent?: number;
  cgstPercent?: number;
  [key: string]: any;
}

export interface IPurchase {
  id: string;
  supplier: string;
  supplierInvoiceNumber?: string;
  purchaseDate: string;
  items: IPurchaseItem[];
  finalBillAmount: number;
  paidAmount?: number;
  dueAmount?: number;
  billImageUrl?: string;
  cgst?: number;
  sgst?: number;
  totalTax?: number;
  createdAt?: string;
}

export interface IChallan {
  id: string;
  ownerId: string;
  challanNumber: string;
  customerName: string;
  customerPhone: string;
  date: string;
  dueDate: string;
  status: string;
  items: any[];
  totalAmount: number;
  paidAmount: number;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface IExpense {
  id: string;
  date: string;
  category: 'Rent' | 'Salaries' | 'Utilities' | 'Marketing' | 'Supplies' | 'Other';
  description: string;
  amount: number;
  createdAt?: string;
}

export interface IInventoryLog {
  id: string;
  productId: string;
  productName: string;
  type: 'Purchase' | 'Sale' | 'Adjustment' | 'Initial';
  quantityChange: number;
  reason: string;
  date: string;
}

export interface ISettings {
  businessName: string;
  phone: string;
  email: string;
  address: string;
  gstin?: string;
  currencySymbol?: string;
  receiptFooter?: string;
}

// ==========================================
// SUPABASE CLIENT INITIALIZATION
// ==========================================

const SUPABASE_URL = process.env['SUPABASE_URL'] || '';
const SUPABASE_ANON_KEY = process.env['SUPABASE_ANON_KEY'] || '';

let supabaseClient: SupabaseClient | null = null;
const requestSupabaseContext = new AsyncLocalStorage<SupabaseClient>();
if (SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL.startsWith('http')) {
  try {
    const baseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    });
    supabaseClient = new Proxy(baseClient, {
      get(target, property) {
        const activeClient = requestSupabaseContext.getStore() || target;
        const value = Reflect.get(activeClient, property, activeClient);
        return typeof value === 'function' ? value.bind(activeClient) : value;
      }
    });
    console.log('Supabase client initialized on server backend.');
  } catch (err) {
    console.error('Failed to initialize Supabase client on server:', err);
  }
}

const DEFAULT_SEED_CUSTOMERS: ICustomer[] = [
  {
    id: 'cust-walkin',
    name: 'Walking Customer',
    phone: 'N/A',
    email: 'counter@advikaerp.com',
    purchaseHistory: [],
    dueAmount: 0,
    paidAmount: 0,
    notes: 'Standard Walk-in Store Counter Client',
    createdAt: new Date().toISOString()
  },
  {
    id: 'cust-1',
    name: 'Rajesh Sharma',
    phone: '9810234567',
    email: 'rajesh.sharma@example.com',
    purchaseHistory: [],
    dueAmount: 0,
    paidAmount: 2450,
    notes: 'Regular retail customer',
    createdAt: new Date().toISOString()
  },
  {
    id: 'cust-2',
    name: 'Priya Patel',
    phone: '9871122334',
    email: 'priya.p@example.com',
    purchaseHistory: [],
    dueAmount: 0,
    paidAmount: 1890,
    notes: 'Prefers UPI billing',
    createdAt: new Date().toISOString()
  },
  {
    id: 'cust-3',
    name: 'Amit Verma',
    phone: '9958844332',
    email: 'amit.verma@example.com',
    purchaseHistory: [],
    dueAmount: 0,
    paidAmount: 5600,
    notes: 'Wholesale buyer account',
    createdAt: new Date().toISOString()
  }
];

const DEFAULT_SEED_PRODUCTS: IProduct[] = [
  {
    id: 'prod-101',
    name: 'Fortune Sunlite Refined Sunflower Oil (1L)',
    category: 'Groceries',
    sku: 'SKU-OIL-101',
    size: 'Free Size',
    color: 'Golden',
    purchasePrice: 110,
    sellingPrice: 145,
    discountPercent: 0,
    quantity: 48,
    minStockAlert: 10,
    imageUrls: ['https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&auto=format&fit=crop&q=80'],
    description: 'Refined sunflower oil for healthy everyday cooking'
  },
  {
    id: 'prod-102',
    name: 'Daawat Rozana Gold Basmati Rice (5kg)',
    category: 'Groceries',
    sku: 'SKU-RIC-102',
    size: 'Free Size',
    color: 'White',
    purchasePrice: 380,
    sellingPrice: 485,
    discountPercent: 5,
    quantity: 35,
    minStockAlert: 8,
    imageUrls: ['https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop&q=80'],
    description: 'Aromatic long grain Indian basmati rice'
  },
  {
    id: 'prod-103',
    name: 'Tata Tea Gold Royal Rich Assam (500g)',
    category: 'Beverages',
    sku: 'SKU-TEA-103',
    size: 'Free Size',
    color: 'Green',
    purchasePrice: 240,
    sellingPrice: 310,
    discountPercent: 0,
    quantity: 50,
    minStockAlert: 12,
    imageUrls: ['https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&auto=format&fit=crop&q=80'],
    description: 'Premium Assam tea blend with long tea leaves'
  },
  {
    id: 'prod-104',
    name: 'Nescafe Classic Instant Coffee Jar (100g)',
    category: 'Beverages',
    sku: 'SKU-COF-104',
    size: 'Free Size',
    color: 'Brown',
    purchasePrice: 220,
    sellingPrice: 285,
    discountPercent: 8,
    quantity: 24,
    minStockAlert: 6,
    imageUrls: ['https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=80'],
    description: '100% pure instant coffee blend'
  },
  {
    id: 'prod-105',
    name: 'Amul Pure Cow Ghee Tin (1L)',
    category: 'Dairy',
    sku: 'SKU-GHE-105',
    size: 'Free Size',
    color: 'Yellow',
    purchasePrice: 520,
    sellingPrice: 630,
    discountPercent: 0,
    quantity: 30,
    minStockAlert: 5,
    imageUrls: ['https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=500&auto=format&fit=crop&q=80'],
    description: 'Traditional granular aroma pure cow ghee'
  },
  {
    id: 'prod-106',
    name: 'Cadbury Dairy Milk Silk Hazelnut (143g)',
    category: 'Snacks',
    sku: 'SKU-CHO-106',
    size: 'Free Size',
    color: 'Purple',
    purchasePrice: 135,
    sellingPrice: 175,
    discountPercent: 0,
    quantity: 60,
    minStockAlert: 15,
    imageUrls: ['https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=500&auto=format&fit=crop&q=80'],
    description: 'Smooth and creamy chocolate with roasted hazelnuts'
  },
  {
    id: 'prod-107',
    name: 'Haldiram Nagpur Aloo Bhujia (400g)',
    category: 'Snacks',
    sku: 'SKU-SNK-107',
    size: 'Free Size',
    color: 'Red',
    purchasePrice: 85,
    sellingPrice: 110,
    discountPercent: 0,
    quantity: 80,
    minStockAlert: 20,
    imageUrls: ['https://images.unsplash.com/photo-1621996346565-e3d5d6281745?w=500&auto=format&fit=crop&q=80'],
    description: 'Crispy and spicy potato noodle namkeen'
  },
  {
    id: 'prod-108',
    name: 'Dettol Disinfectant Liquid Lime Fresh (500ml)',
    category: 'Personal Care',
    sku: 'SKU-DET-108',
    size: 'Free Size',
    color: 'Lime',
    purchasePrice: 170,
    sellingPrice: 220,
    discountPercent: 5,
    quantity: 40,
    minStockAlert: 8,
    imageUrls: ['https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80'],
    description: 'Multi-purpose hygiene and surface cleaner'
  },
  {
    id: 'prod-109',
    name: 'Surf Excel Matic Front Load Liquid (1L)',
    category: 'Household',
    sku: 'SKU-SRF-109',
    size: 'Free Size',
    color: 'Blue',
    purchasePrice: 215,
    sellingPrice: 270,
    discountPercent: 10,
    quantity: 32,
    minStockAlert: 6,
    imageUrls: ['https://images.unsplash.com/photo-1585421514738-01798e348b17?w=500&auto=format&fit=crop&q=80'],
    description: 'Advanced stain removal washing liquid detergent'
  },
  {
    id: 'prod-110',
    name: 'boAt BassHeads 100 In-Ear Wired Earphones',
    category: 'Electronics',
    sku: 'SKU-BOA-110',
    size: 'Free Size',
    color: 'Black',
    purchasePrice: 299,
    sellingPrice: 429,
    discountPercent: 12,
    quantity: 18,
    minStockAlert: 4,
    imageUrls: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=80'],
    description: 'Super extra bass in-ear earphones with HD mic'
  },
  {
    id: 'prod-111',
    name: 'Aashirvaad Superior MP Shudh Chakki Atta (10kg)',
    category: 'Groceries',
    sku: 'SKU-ATT-111',
    size: 'Free Size',
    color: 'Gold',
    purchasePrice: 375,
    sellingPrice: 450,
    discountPercent: 0,
    quantity: 42,
    minStockAlert: 10,
    imageUrls: ['https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&auto=format&fit=crop&q=80'],
    description: '100% whole wheat atta with 0% maida'
  },
  {
    id: 'prod-112',
    name: 'Colgate Strong Teeth Anticavity Toothpaste (200g)',
    category: 'Personal Care',
    sku: 'SKU-COL-112',
    size: 'Free Size',
    color: 'Red',
    purchasePrice: 95,
    sellingPrice: 125,
    discountPercent: 0,
    quantity: 65,
    minStockAlert: 15,
    imageUrls: ['https://images.unsplash.com/photo-1559591937-e62fb3d8651a?w=500&auto=format&fit=crop&q=80'],
    description: 'Calci-lock formula for strong, healthy teeth'
  }
];

// In-Memory Storage Containers
let inMemoryCustomers: ICustomer[] = [...DEFAULT_SEED_CUSTOMERS];
let inMemoryProducts: IProduct[] = [...DEFAULT_SEED_PRODUCTS];
let inMemoryInvoices: IInvoice[] = [];
let inMemoryPurchases: IPurchase[] = [];
let inMemoryChallans: IChallan[] = [];
let inMemoryProcurementItems: any[] = [];
let inMemoryExpenses: IExpense[] = [];
let inMemoryInventoryLogs: IInventoryLog[] = [];
let inMemorySettings: ISettings = {
  businessName: 'Advika ERP',
  phone: '9876543210',
  email: 'contact@advikaerp.com',
  address: 'Main Market, New Delhi, India',
  gstin: '07AAAAA0000A1Z5',
  currencySymbol: '₹',
  receiptFooter: 'Thank you for your visit! Please come again.'
};

const publicSiteUrl = (() => {
  const configuredUrl = process.env['PUBLIC_SITE_URL'];
  if (!configuredUrl) return null;
  try {
    const parsedUrl = new URL(configuredUrl);
    if (parsedUrl.protocol !== 'https:' && parsedUrl.hostname !== 'localhost') return null;
    return parsedUrl.origin;
  } catch {
    return null;
  }
})();

app.get('/robots.txt', (_req, res) => {
  const sitemapDirective = publicSiteUrl ? `Sitemap: ${publicSiteUrl}/sitemap.xml\n` : '';
  res.type('text/plain').send(
    `User-agent: *\nAllow: /landing\nDisallow: /\n${sitemapDirective}`
  );
});

app.get('/sitemap.xml', (_req, res) => {
  if (!publicSiteUrl) {
    return res.status(404).type('text/plain').send('Sitemap is unavailable until PUBLIC_SITE_URL is configured.');
  }
  return res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    `<url><loc>${publicSiteUrl}/landing</loc></url></urlset>`
  );
});

const privateRoutePrefixes = [
  '/login', '/dashboard', '/pos', '/sales', '/inventory', '/purchases',
  '/expenses', '/invoices', '/customers', '/reports', '/settings', '/api'
];
app.use((req, res, next) => {
  if (privateRoutePrefixes.some(prefix => req.path === prefix || req.path.startsWith(`${prefix}/`))) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }
  next();
});

app.use('/api', async (req, res, next) => {
  const authorization = req.get('authorization') || '';
  const bearerMatch = authorization.match(/^Bearer\s+([^\s]+)$/i);

  if (!supabaseClient) {
    const remoteAddress = req.socket.remoteAddress;
    const isLocalDevelopmentRequest =
      process.env['NODE_ENV'] === 'development' &&
      (remoteAddress === '127.0.0.1' || remoteAddress === '::1' || remoteAddress === '::ffff:127.0.0.1');
    if (isLocalDevelopmentRequest) return next();
    return res.status(503).json({
      error: 'API authentication is unavailable because Supabase is not configured on the server. Set SUPABASE_URL and SUPABASE_ANON_KEY in the server environment.'
    });
  }

  if (!bearerMatch) {
    return res.status(401).json({ error: 'A valid signed-in session is required.' });
  }

  try {
    const { data, error } = await supabaseClient.auth.getUser(bearerMatch[1]);
    if (error || !data.user) {
      return res.status(401).json({ error: 'The signed-in session is invalid or expired.' });
    }
    res.locals.authenticatedUser = data.user;
    const requestClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${bearerMatch[1]}` } }
    });
    return requestSupabaseContext.run(requestClient, () => next());
  } catch (error) {
    console.error('API session verification failed:', error);
    return res.status(503).json({ error: 'Could not verify the signed-in session.' });
  }
});

// ==========================================
// DATABASE SCHEMA ENDPOINT (PostgreSQL / Supabase DDL)
// ==========================================

app.get('/api/schema/sql', (req, res) => {
  const sqlSchema = `
-- ==========================================
-- ADVIKA ERP POSTGRESQL / SUPABASE TABLE SCHEMAS
-- ==========================================

-- 1. Customers Table
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

-- 2. Products Table
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
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  min_stock_alert NUMERIC(12,2) DEFAULT 5.00,
  image_urls TEXT[] DEFAULT '{}',
  description TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Strict unique constraint on product name (case-insensitive & trimmed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_unique_name ON public.products (LOWER(TRIM(name)));

-- 3. Invoices Table
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

-- 4. Purchases Table
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

-- 5. Procurement Items Table (Individual batch items inventory)
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


-- 5. Expenses Table
CREATE TABLE IF NOT EXISTS public.expenses (
  id VARCHAR(100) PRIMARY KEY,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  category VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Inventory Logs Table
CREATE TABLE IF NOT EXISTS public.inventory_logs (
  id VARCHAR(100) PRIMARY KEY,
  product_id VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  quantity_change NUMERIC(12,2) NOT NULL,
  reason TEXT DEFAULT '',
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Settings Table
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

NOTIFY pgrst, 'reload schema';
  `;
  return res.type('text/plain').send(sqlSchema);
});

// ==========================================
// SUPABASE FETCH & MAPPING HELPERS
// ==========================================

async function fetchSupabaseTable(tableName: string, userId?: string): Promise<any[] | null> {
  if (!supabaseClient) return null;

  let query = supabaseClient.from(tableName).select('*');
  if (userId) {
    query = query.eq('user_id', userId);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) {
    console.error(`Supabase fetch failed for table "${tableName}":`, error.message);
    throw error;
  }
  return data || [];
}

function memoryListForResponse<T>(records: T[]): T[] {
  return supabaseClient ? [] : records;
}

function getSupabaseApiError(tableName: string, error: unknown): string {
  const databaseError = error as { code?: string; message?: string };
  const message = databaseError?.message || 'Unknown Supabase error';

  if (databaseError?.code === '42P01' || databaseError?.code === 'PGRST205') {
    return `Supabase table public.${tableName} is missing. Run the latest schema SQL from Settings.`;
  }
  if (databaseError?.code === '42703' || databaseError?.code === 'PGRST204') {
    return `Supabase table public.${tableName} is missing a required column. Run the latest schema SQL from Settings. Supabase: ${message}`;
  }
  if (databaseError?.code === '42501') {
    return `Supabase denied access to public.${tableName}. Check its Row Level Security policy. Supabase: ${message}`;
  }
  return `Supabase request for public.${tableName} failed: ${message}`;
}

function safeParseJson(val: any) {
  if (typeof val === 'object' && val !== null) return val;
  if (typeof val === 'string' && val.trim()) {
    try { return JSON.parse(val); } catch { return null; }
  }
  return null;
}

function mapCustomer(item: any): ICustomer {
  const ph = item.purchase_history || item.purchaseHistory;
  let parsedPh: string[] = [];
  if (Array.isArray(ph)) parsedPh = ph;
  else if (typeof ph === 'string' && ph.trim()) {
    try { parsedPh = JSON.parse(ph); } catch { parsedPh = []; }
  }

  return {
    id: String(item.id || `cust-${Date.now()}`),
    name: String(item.name || item.client_name || item.customer_name || 'Unnamed Client'),
    phone: String(item.phone || item.mobile || item.contact || 'N/A'),
    email: String(item.email || ''),
    purchaseHistory: parsedPh,
    dueAmount: Number(item.due_amount ?? item.dueAmount ?? item.due ?? 0),
    paidAmount: Number(item.paid_amount ?? item.paidAmount ?? item.paid ?? 0),
    notes: String(item.notes || ''),
    createdAt: String(item.created_at || item.createdAt || new Date().toISOString())
  };
}

function mapProduct(p: any): IProduct {
  let imgs: string[] = [];
  const rawImgs = p.image_urls ?? p.imageUrls ?? p.images;
  if (Array.isArray(rawImgs)) {
    imgs = rawImgs;
  } else if (typeof rawImgs === 'string' && rawImgs.trim()) {
    try {
      const parsed = JSON.parse(rawImgs);
      if (Array.isArray(parsed)) imgs = parsed;
      else imgs = [rawImgs];
    } catch {
      imgs = [rawImgs];
    }
  }

  return {
    id: String(p.id || `prod-${Date.now()}`),
    name: String(p.name || p.product_name || p.title || 'Unnamed Product'),
    category: String(p.category || 'General'),
    sku: String(p.sku || p.code || p.barcode || `SKU-${Date.now()}`),
    size: (p.size || 'Free Size') as any,
    color: String(p.color || ''),
    purchasePrice: Number(p.purchase_price ?? p.purchasePrice ?? p.purchase_cost ?? p.cost ?? 0),
    sellingPrice: Number(p.selling_price ?? p.sellingPrice ?? p.price ?? 0),
    discountPercent: Number(p.discount_percent ?? p.discountPercent ?? p.discount ?? 0),
    quantity: Number(p.quantity ?? p.stock ?? p.qty ?? 0),
    minStockAlert: Number(p.min_stock_alert ?? p.minStockAlert ?? p.min_stock ?? 5),
    imageUrls: imgs,
    description: String(p.description || p.details || ''),
    createdAt: String(p.created_at || p.createdAt || new Date().toISOString())
  };
}

function mapInvoice(i: any): IInvoice {
  let parsedCust = safeParseJson(i.customer);
  if (!parsedCust || typeof parsedCust !== 'object') {
    parsedCust = {
      name: String(i.customer_name || i.customerName || i.customer || 'Walk-in Customer'),
      phone: String(i.customer_phone || i.phone || 'N/A'),
      email: String(i.customer_email || i.email || '')
    };
  }

  let parsedItems = safeParseJson(i.items);
  if (!Array.isArray(parsedItems)) {
    parsedItems = Array.isArray(i.items) ? i.items : [];
  }

  return {
    id: String(i.id || i.invoice_number || i.invoiceNo || `INV-${Date.now()}`),
    date: String(i.date || i.created_at || i.createdAt || new Date().toISOString()),
    customer: parsedCust,
    items: parsedItems,
    subtotal: Number(i.subtotal ?? i.sub_total ?? 0),
    total: Number(i.total ?? i.total_amount ?? i.grand_total ?? 0),
    paymentMode: (i.payment_mode || i.paymentMode || i.payment_type || 'Cash') as any,
    totalDiscount: Number(i.total_discount ?? i.totalDiscount ?? 0),
    amountPaid: Number(i.amount_paid ?? i.amountPaid ?? i.paidAmount ?? i.total ?? 0),
    notes: String(i.notes || ''),
    createdAt: String(i.created_at || i.createdAt || new Date().toISOString())
  };
}

function mapPurchase(p: any): IPurchase {
  let parsedItems = safeParseJson(p.items);
  if (!Array.isArray(parsedItems)) {
    parsedItems = Array.isArray(p.items) ? p.items : [];
  }

  const supplierVal = p.supplier || p.supplier_name || p.vendor;
  const supplierStr = typeof supplierVal === 'string' ? supplierVal : (supplierVal?.name || 'Unknown Supplier');

  return {
    id: String(p.id || `pur-${Date.now()}`),
    supplier: supplierStr,
    supplierInvoiceNumber: String(p.supplier_invoice_number || p.supplierInvoiceNumber || p.invoice_number || ''),
    purchaseDate: String(p.purchase_date || p.purchaseDate || p.created_at || p.createdAt || new Date().toISOString()),
    items: parsedItems,
    finalBillAmount: Number(p.final_bill_amount ?? p.finalBillAmount ?? p.total ?? 0),
    paidAmount: Number(p.paid_amount ?? p.paidAmount ?? 0),
    dueAmount: Number(p.due_amount ?? p.dueAmount ?? 0),
    billImageUrl: String(p.bill_image_url || p.billImageUrl || ''),
    cgst: Number(p.cgst || 0),
    sgst: Number(p.sgst || 0),
    totalTax: Number(p.total_tax ?? p.totalTax ?? 0),
    createdAt: String(p.created_at || p.createdAt || new Date().toISOString())
  };
}

function mapChallan(challan: any): IChallan {
  const items = safeParseJson(challan.items);
  return {
    id: String(challan.id || ''),
    ownerId: String(challan.user_id || challan.ownerId || ''),
    challanNumber: String(challan.challan_number || challan.challanNumber || ''),
    customerName: String(challan.customer_name || challan.customerName || ''),
    customerPhone: String(challan.customer_phone || challan.customerPhone || ''),
    date: String(challan.challan_date || challan.date || challan.created_at || new Date().toISOString()),
    dueDate: String(challan.due_date || challan.dueDate || new Date().toISOString()),
    status: String(challan.status || 'Open'),
    items: Array.isArray(items) ? items : [],
    totalAmount: Number(challan.total_amount ?? challan.totalAmount ?? 0),
    paidAmount: Number(challan.paid_amount ?? challan.paidAmount ?? 0),
    notes: String(challan.notes || ''),
    createdAt: String(challan.created_at || challan.createdAt || new Date().toISOString()),
    updatedAt: String(challan.updated_at || challan.updatedAt || new Date().toISOString())
  };
}

function getChallanDatabaseError(action: string, error: { code?: string; message: string }): string {
  if (error.code === '42P01' || error.code === 'PGRST205') {
    return `Supabase table public.challans was not found. Run the challan table SQL from Settings before trying to ${action}.`;
  }
  if (error.code === '42703' || error.code === 'PGRST204') {
    return `The public.challans table is missing a required column. Run the latest schema SQL from Settings. Supabase: ${error.message}`;
  }
  if (error.code === '42501') {
    return `Supabase denied access to public.challans. Check the challans table Row Level Security policy. Supabase: ${error.message}`;
  }
  return `Supabase could not ${action} challans: ${error.message}`;
}

function mapExpense(e: any): IExpense {
  return {
    id: String(e.id || `exp-${Date.now()}`),
    category: (e.category || 'Other') as any,
    description: String(e.description || e.title || ''),
    amount: Number(e.amount ?? e.price ?? 0),
    date: String(e.date || e.created_at || e.createdAt || new Date().toISOString()),
    createdAt: String(e.created_at || e.createdAt || new Date().toISOString())
  };
}

// ==========================================
// 1. CUSTOMERS / CLIENT REGISTRY API
// ==========================================

app.get('/api/customers', async (req, res) => {
  try {
    const rawData = await fetchSupabaseTable('customers', res.locals.authenticatedUser?.id);
    if (rawData !== null) {
      const list = rawData.map(mapCustomer);
      return res.json({ success: true, message: 'Record found', customers: list });
    }
    const list = memoryListForResponse(inMemoryCustomers);
    const message = (list && list.length > 0) ? 'Record found' : 'No record found';
    return res.json({ success: true, message, customers: list });
  } catch (error) {
    console.error('Failed to fetch customers:', error);
    return res.status(500).json({ error: 'Failed to fetch customers.' });
  }
});

app.post('/api/customers', async (req, res) => {
  try {
    const { name, phone, email, notes, dueAmount, paidAmount } = req.body;
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Validation Error: Client name is required' });
    }

    const cleanEmail = (email || '').toLowerCase().trim();
    const cleanPhone = (phone || '').trim();

    // Validation: Duplicate phone / email check
    const isDuplicate = !supabaseClient && inMemoryCustomers.some(c =>
      (cleanEmail.length > 0 && c.email?.toLowerCase().trim() === cleanEmail) ||
      (cleanPhone.length > 0 && cleanPhone !== 'N/A' && cleanPhone !== 'n/a' && c.phone?.trim() === cleanPhone)
    );

    if (isDuplicate) {
      const matchField = cleanEmail.length > 0 ? 'email' : 'phone';
      return res.status(400).json({ error: `Duplicate Client Error: A client with this ${matchField} already exists.` });
    }

    const newCustomer: ICustomer = {
      id: req.body.id || `cust-${Date.now()}`,
      name: name.trim(),
      phone: cleanPhone || 'N/A',
      email: cleanEmail,
      purchaseHistory: [],
      dueAmount: Number(dueAmount) || 0,
      paidAmount: Number(paidAmount) || 0,
      notes: notes || '',
      createdAt: new Date().toISOString()
    };

    if (supabaseClient && res.locals.authenticatedUser?.id) {
      try {
        await supabaseClient.from('customers').insert([{
          id: newCustomer.id, name: newCustomer.name, phone: newCustomer.phone,
          email: newCustomer.email, due_amount: newCustomer.dueAmount,
          paid_amount: newCustomer.paidAmount, notes: newCustomer.notes, created_at: newCustomer.createdAt,
          user_id: res.locals.authenticatedUser.id
        }]);
      } catch (e) {}
    }

    inMemoryCustomers.unshift(newCustomer);
    return res.status(201).json({ success: true, customer: newCustomer, customers: memoryListForResponse(inMemoryCustomers) });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create customer' });
  }
});

app.put('/api/customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const index = inMemoryCustomers.findIndex(c => c.id === id);
    if (index !== -1) {
      inMemoryCustomers[index] = { ...inMemoryCustomers[index], ...updates };
    }

    if (supabaseClient && res.locals.authenticatedUser?.id) {
      try {
        await supabaseClient.from('customers').update({
          name: updates.name, phone: updates.phone, email: updates.email,
          due_amount: updates.dueAmount, paid_amount: updates.paidAmount, notes: updates.notes,
          user_id: res.locals.authenticatedUser.id
        }).eq('id', id).eq('user_id', res.locals.authenticatedUser.id);
      } catch (e) {}
    }

    return res.json({
      success: true,
      customer: supabaseClient ? updates : (inMemoryCustomers[index] || updates),
      customers: memoryListForResponse(inMemoryCustomers)
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update customer' });
  }
});

app.delete('/api/customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    inMemoryCustomers = inMemoryCustomers.filter(c => c.id !== id);

    if (supabaseClient) {
      try { await supabaseClient.from('customers').delete().eq('id', id); } catch (e) {}
    }
    return res.json({ success: true, id, customers: memoryListForResponse(inMemoryCustomers) });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete customer' });
  }
});

// ==========================================
// 2. PRODUCTS / INVENTORY API
// ==========================================

app.get('/api/products', async (req, res) => {
  try {
    const rawData = await fetchSupabaseTable('products', res.locals.authenticatedUser?.id);
    if (rawData !== null) {
      const list = rawData.map(mapProduct);
      return res.json({ success: true, message: 'Record found', products: list });
    }
    const list = memoryListForResponse(inMemoryProducts);
    const message = (list && list.length > 0) ? 'Record found' : 'No record found';
    return res.json({ success: true, message, products: list });
  } catch (error) {
    console.error('Failed to fetch products:', error);
    return res.status(500).json({ error: 'Failed to fetch products.' });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { name, category, sku, size, color, purchasePrice, sellingPrice, discountPercent, quantity, minStockAlert, imageUrls, description } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Validation Error: Product name is required' });
    }
    if (!sku || sku.trim().length === 0) {
      return res.status(400).json({ error: 'Validation Error: Product SKU is required' });
    }

    const cleanName = name.trim();
    const cleanSku = sku.trim().toUpperCase();
    const isPlaceholderSku = (s?: string) => !s || ['EXTRACTED', 'MANUAL', 'N/A', 'NONE', 'UNKNOWN', 'DEFAULT', 'TEST', ''].includes(s);

    let existing = !supabaseClient && inMemoryProducts.find(p =>
      p.name.trim().toLowerCase() === cleanName.toLowerCase() ||
      (!isPlaceholderSku(cleanSku) && !isPlaceholderSku(p.sku) && p.sku.trim().toUpperCase() === cleanSku)
    );

    if (!existing && supabaseClient) {
      try {
        const { data: dbMatches } = await supabaseClient.from('products').select('*').ilike('name', cleanName).limit(1);
        if (dbMatches && dbMatches.length > 0) {
          existing = mapProduct(dbMatches[0]);
          inMemoryProducts.unshift(existing);
        }
      } catch (e) {}
    }

    if (existing) {
      // DUPLICATE GUARD: Merge/update existing product instead of creating duplicate
      existing.quantity += Number(quantity) || 0;
      if (Number(purchasePrice) > 0) existing.purchasePrice = Number(purchasePrice);
      if (Number(sellingPrice) > 0) existing.sellingPrice = Number(sellingPrice);
      if (category) existing.category = category;
      if (size) existing.size = size;
      if (description) existing.description = description;

      if (supabaseClient && res.locals.authenticatedUser?.id) {
        try {
          await supabaseClient.from('products').update({
            quantity: existing.quantity,
            purchase_price: existing.purchasePrice,
            selling_price: existing.sellingPrice,
            category: existing.category,
            size: existing.size,
            description: existing.description,
            user_id: res.locals.authenticatedUser.id
          }).eq('id', existing.id).eq('user_id', res.locals.authenticatedUser.id);
        } catch (e) {}
      }
      return res.status(200).json({
        success: true,
        message: 'Existing product updated',
        product: existing,
        products: memoryListForResponse(inMemoryProducts)
      });
    }

    const newProduct: IProduct = {
      id: req.body.id || `prod-${Date.now()}`,
      name: cleanName,
      category: category || 'General',
      sku: cleanSku,
      size: size || 'Free Size',
      color: color || '',
      purchasePrice: Number(purchasePrice) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      discountPercent: Number(discountPercent) || 0,
      quantity: Number(quantity) || 0,
      minStockAlert: Number(minStockAlert) || 5,
      imageUrls: imageUrls || [],
      description: description || '',
      createdAt: new Date().toISOString()
    };

    if (supabaseClient && res.locals.authenticatedUser?.id) {
      try {
        const { error } = await supabaseClient.from('products').insert([{
          id: newProduct.id, name: newProduct.name, category: newProduct.category, sku: newProduct.sku,
          size: newProduct.size, color: newProduct.color, purchase_price: newProduct.purchasePrice,
          selling_price: newProduct.sellingPrice, discount_percent: newProduct.discountPercent,
          quantity: newProduct.quantity, min_stock_alert: newProduct.minStockAlert,
          image_urls: newProduct.imageUrls, description: newProduct.description,
          user_id: res.locals.authenticatedUser.id
        }]);
        if (error) console.error(`Error inserting product ${newProduct.id} in Supabase:`, error);
      } catch (e) {
        console.error(`Exception inserting product ${newProduct.id}:`, e);
      }
    }

    inMemoryProducts.unshift(newProduct);
    return res.status(201).json({ success: true, product: newProduct, products: memoryListForResponse(inMemoryProducts) });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create product' });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    let persisted = false;
    if (supabaseClient) {
      const productUpdates = {
          name: updates.name, category: updates.category, sku: updates.sku,
          selling_price: Number(updates.sellingPrice) || 0,
          purchase_price: Number(updates.purchasePrice) || 0,
          quantity: Number(updates.quantity) || 0,
          min_stock_alert: Number(updates.minStockAlert) || 0
      };
      const { data, error } = await supabaseClient
        .from('products')
        .update(productUpdates)
        .eq('id', id)
        .select('id');
      if (error || !data?.length) {
        const message = error?.message || `No product with ID ${id} was updated in "products".`;
        console.error(`Error updating product ${id} in Supabase: ${message}`);
        return res.status(500).json({ error: `Failed to update product stock: ${message}` });
      }
      persisted = true;
    }

    const index = inMemoryProducts.findIndex(p => p.id === id);
    const updatedProduct: IProduct = {
      ...(!supabaseClient && index !== -1 ? inMemoryProducts[index] : {}),
      ...updates,
      id
    };
    if (index !== -1) inMemoryProducts[index] = updatedProduct;
    else inMemoryProducts.unshift(updatedProduct);

    return res.json({
      success: true,
      persisted,
      product: updatedProduct,
      products: memoryListForResponse(inMemoryProducts)
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update product' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    inMemoryProducts = inMemoryProducts.filter(p => p.id !== id);
    if (supabaseClient) {
      try { await supabaseClient.from('products').delete().eq('id', id); } catch (e) {}
    }
    return res.json({ success: true, id, products: memoryListForResponse(inMemoryProducts) });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ==========================================
// 3. INVOICES / BILLING API
// ==========================================

// Helper: Deduct or Restore Product Stock across in-memory and Supabase
app.get('/api/invoices', async (req, res) => {
  try {
    const rawData = await fetchSupabaseTable('invoices', res.locals.authenticatedUser?.id);
    if (rawData !== null) {
      const list = rawData.map(mapInvoice);
      return res.json({ success: true, message: list.length > 0 ? 'Record found' : 'No record found', invoices: list });
    }
    const list = memoryListForResponse(inMemoryInvoices);
    const message = (list && list.length > 0) ? 'Record found' : 'No record found';
    return res.json({ success: true, message, invoices: list });
  } catch (error) {
    console.error('Failed to fetch invoices:', error);
    return res.status(500).json({ error: 'Failed to fetch invoices.' });
  }
});

app.post('/api/invoices', async (req, res) => {
  try {
    const { customer, items, subtotal, total, paymentMode, totalDiscount, amountPaid, notes } = req.body;
    if (!customer || !customer.name) {
      return res.status(400).json({ error: 'Validation Error: Invoice must have a valid customer assigned.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Validation Error: Invoice must contain at least 1 item.' });
    }

    const newInvoice: IInvoice = {
      id: req.body.id || `INV-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString(),
      customer,
      items,
      subtotal: Number(subtotal) || 0,
      total: Number(total) || 0,
      paymentMode: paymentMode || 'Cash',
      totalDiscount: Number(totalDiscount) || 0,
      amountPaid: Number(amountPaid) || Number(total) || 0,
      notes: notes || '',
      createdAt: new Date().toISOString()
    };

    if (supabaseClient && res.locals.authenticatedUser?.id) {
      try {
        const { error } = await supabaseClient.from('invoices').insert([{
          id: newInvoice.id, date: newInvoice.date, customer: newInvoice.customer,
          items: newInvoice.items, subtotal: newInvoice.subtotal, total: newInvoice.total,
          payment_mode: newInvoice.paymentMode, total_discount: newInvoice.totalDiscount,
          amount_paid: newInvoice.amountPaid, notes: newInvoice.notes,
          user_id: res.locals.authenticatedUser.id
        }]);
        if (error) console.error(`Error inserting invoice ${newInvoice.id} in Supabase:`, error);
      } catch (e) {
        console.error(`Exception inserting invoice ${newInvoice.id}:`, e);
      }
    }

    inMemoryInvoices.unshift(newInvoice);
    return res.status(201).json({ success: true, invoice: newInvoice, invoices: memoryListForResponse(inMemoryInvoices) });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to generate invoice' });
  }
});

app.put('/api/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const index = inMemoryInvoices.findIndex(i => i.id === id);
    if (index !== -1) {
      inMemoryInvoices[index] = { ...inMemoryInvoices[index], ...updates };
    }
    if (supabaseClient && res.locals.authenticatedUser?.id) {
      try {
        await supabaseClient.from('invoices').update({
          customer: updates.customer,
          items: updates.items,
          subtotal: updates.subtotal,
          total: updates.total,
          payment_mode: updates.paymentMode,
          total_discount: updates.totalDiscount,
          amount_paid: updates.amountPaid,
          notes: updates.notes,
          user_id: res.locals.authenticatedUser.id
        }).eq('id', id).eq('user_id', res.locals.authenticatedUser.id);
      } catch (e) {}
    }
    return res.json({
      success: true,
      invoice: supabaseClient ? updates : (inMemoryInvoices[index] || updates),
      invoices: memoryListForResponse(inMemoryInvoices)
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update invoice' });
  }
});

app.delete('/api/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const invToDelete = inMemoryInvoices.find(i => i.id === id);

    inMemoryInvoices = inMemoryInvoices.filter(i => i.id !== id);
    if (supabaseClient) {
      try { await supabaseClient.from('invoices').delete().eq('id', id); } catch (e) {}
    }
    return res.json({ success: true, id, invoices: memoryListForResponse(inMemoryInvoices) });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

// ==========================================
// 4. PURCHASES / SUPPLIER ORDERS API
// ==========================================

app.get('/api/procurement-items', async (req, res) => {
  try {
    const rawData = await fetchSupabaseTable('procurement_items', res.locals.authenticatedUser?.id);
    let list: any[] = (rawData !== null ? [...rawData] : [...inMemoryProcurementItems]);

    // Fallback: If procurement_items table is empty, extract items from purchases
    if (!list || list.length === 0) {
      const rawPurchases = await fetchSupabaseTable('purchases', res.locals.authenticatedUser?.id);
      const purchasesList = rawPurchases !== null
        ? rawPurchases.map(mapPurchase)
        : inMemoryPurchases;
      if (Array.isArray(purchasesList)) {
        purchasesList.forEach(p => {
          if (Array.isArray(p.items)) {
            p.items.forEach((item, idx) => {
              const prodObj: any = item.product || {};
              const pName = prodObj.name || (typeof item.product === 'string' ? item.product : '') || 'Procured Item';
              const pSku = prodObj.sku || (item as any).sku || '';
              const qty = Number(item.quantity) || 0;
              const cost = Number(item.costPrice || (item as any).cost_price) || 0;
              list.push({
                id: `proc-${p.id}-${idx}`,
                purchase_id: p.id,
                supplier: p.supplier || 'Supplier',
                supplier_invoice_number: p.supplierInvoiceNumber || '',
                purchase_date: p.purchaseDate,
                product_id: prodObj.id || `prod-${idx}`,
                product_name: pName,
                sku: pSku,
                batch_no: (item as any).batchNo || '',
                exp_date: (item as any).expDate || '',
                quantity: qty,
                free_qty: Number(item.freeQty || (item as any).free_qty) || 0,
                cost_price: cost,
                total_cost: qty * cost,
                mrp: Number(item.mrp) || 0
              });
            });
          }
        });
      }
    }

    // Attach current stock from products catalog
    let allProds = memoryListForResponse(inMemoryProducts);
    if (supabaseClient) {
      const dbProds = await fetchSupabaseTable('products', res.locals.authenticatedUser?.id);
      if (dbProds !== null) allProds = dbProds.map(mapProduct);
    }

    const representedProductIds = new Set<string>();
    const representedSkus = new Set<string>();
    const representedNames = new Set<string>();

    const enrichedList = list.map(item => {
      const pId = item.product_id || item.productId;
      const pSku = (item.sku || '').trim().toUpperCase();
      const pName = (item.product_name || item.productName || '').trim().toLowerCase();

      const matched = allProds.find(p => 
        (pId && p.id === pId) ||
        (pSku && p.sku && p.sku.toUpperCase() === pSku) ||
        (pName && p.name && p.name.trim().toLowerCase() === pName)
      );

      if (matched) {
        if (matched.id) representedProductIds.add(matched.id);
        if (matched.sku) representedSkus.add(matched.sku.trim().toUpperCase());
        if (matched.name) representedNames.add(matched.name.trim().toLowerCase());
      }

      const currentStock = matched ? Number(matched.quantity || 0) : 0;
      const initialProcured = (Number(item.quantity) || 0) + (Number(item.free_qty || item.freeQty) || 0);
      const soldQuantity = Math.max(0, initialProcured - currentStock);

      return {
        ...item,
        current_stock: currentStock,
        currentStock: currentStock,
        sold_quantity: soldQuantity,
        soldQuantity: soldQuantity,
        is_sold_out: currentStock <= 0
      };
    });

    // Also include any catalog products not represented in procurement items
    allProds.forEach(p => {
      const pId = p.id;
      const pSku = (p.sku || '').trim().toUpperCase();
      const pName = (p.name || '').trim().toLowerCase();

      const isRep = (pId && representedProductIds.has(pId)) ||
        (pSku && representedSkus.has(pSku)) ||
        (pName && representedNames.has(pName));

      if (!isRep) {
        const qty = Number(p.quantity || 0);
        const cost = Number(p.purchasePrice || 0);
        enrichedList.push({
          id: `catalog-${p.id}`,
          purchase_id: 'CATALOG',
          supplier: 'Store Catalog',
          supplier_invoice_number: 'N/A',
          purchase_date: p.createdAt || new Date().toISOString(),
          product_id: p.id,
          product_name: p.name,
          sku: p.sku || 'N/A',
          batch_no: 'Standard',
          exp_date: '',
          quantity: qty,
          free_qty: 0,
          cost_price: cost,
          total_cost: qty * cost,
          mrp: Number(p.sellingPrice || 0),
          current_stock: qty,
          currentStock: qty,
          sold_quantity: 0,
          soldQuantity: 0,
          is_sold_out: qty <= 0
        });
      }
    });

    return res.json({ 
      success: true, 
      message: enrichedList.length > 0 ? 'Record found' : 'No record found', 
      procurementItems: enrichedList 
    });
  } catch (error) {
    console.error('Failed to fetch procurement items:', error);
    return res.status(500).json({ error: 'Failed to fetch procurement items.' });
  }
});

app.delete('/api/procurement-items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    inMemoryProcurementItems = inMemoryProcurementItems.filter(item => item.id !== id && (item.product_id || item.productId) !== id);
    if (supabaseClient) {
      try { await supabaseClient.from('procurement_items').delete().eq('id', id); } catch (e) {}
      try { await supabaseClient.from('procurement_items').delete().eq('product_id', id); } catch (e) {}
    }
    return res.json({ success: true, id });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete procurement item' });
  }
});

app.post('/api/inventory/batch-delete', async (req, res) => {
  try {
    const pIds: string[] = Array.isArray(req.body.productIds)
      ? req.body.productIds.filter((id: unknown): id is string => typeof id === 'string' && Boolean(id))
      : [];
    const iIds: string[] = Array.isArray(req.body.itemIds)
      ? req.body.itemIds.filter((id: unknown): id is string => typeof id === 'string' && Boolean(id))
      : [];
    const purchaseItemRefs = new Map<string, Set<number>>();
    if (Array.isArray(req.body.purchaseItemRefs)) {
      for (const ref of req.body.purchaseItemRefs) {
        if (typeof ref?.purchaseId !== 'string' || !ref.purchaseId || !Array.isArray(ref.itemIndexes)) continue;
        const indexes = purchaseItemRefs.get(ref.purchaseId) || new Set<number>();
        ref.itemIndexes.forEach((index: unknown) => {
          const itemIndex = Number(index);
          if (Number.isInteger(itemIndex) && itemIndex >= 0) indexes.add(itemIndex);
        });
        purchaseItemRefs.set(ref.purchaseId, indexes);
      }
    }

    if (supabaseClient) {
      if (purchaseItemRefs.size > 0) {
        const { data: purchaseRows, error: fetchError } = await supabaseClient
          .from('purchases')
          .select('id, items')
          .in('id', Array.from(purchaseItemRefs.keys()));
        if (fetchError) throw fetchError;

        for (const purchaseRow of purchaseRows || []) {
          const indexes = purchaseItemRefs.get(String(purchaseRow.id));
          if (!indexes) continue;
          const parsedItems = safeParseJson(purchaseRow.items);
          const items = Array.isArray(parsedItems) ? parsedItems : [];
          const updatedItems = items.filter((_: unknown, index: number) => !indexes.has(index));
          const { error } = await supabaseClient
            .from('purchases')
            .update({ items: updatedItems })
            .eq('id', purchaseRow.id);
          if (error) throw error;
        }
      }

      if (iIds.length > 0) {
        const { error } = await supabaseClient.from('procurement_items').delete().in('id', iIds);
        if (error) throw error;
      }

      if (pIds.length > 0) {
        const { error } = await supabaseClient.from('products').delete().in('id', pIds);
        if (error) throw error;
      }
    }

    inMemoryProducts = inMemoryProducts.filter(product => !pIds.includes(product.id));
    inMemoryProcurementItems = inMemoryProcurementItems.filter(item => !iIds.includes(item.id));
    inMemoryPurchases = inMemoryPurchases.map(purchase => {
      const deletedIndexes = purchaseItemRefs.get(purchase.id);
      if (!deletedIndexes) return purchase;
      return {
        ...purchase,
        items: purchase.items.filter((_, index) => !deletedIndexes.has(index))
      };
    });

    return res.json({ 
      success: true, 
      message: 'Items deleted successfully', 
      deletedProductIds: pIds, 
      deletedItemIds: iIds,
      deletedPurchaseItemRefs: Array.from(purchaseItemRefs, ([purchaseId, indexes]) => ({
        purchaseId,
        itemIndexes: Array.from(indexes)
      })),
      databaseSynced: Boolean(supabaseClient),
      products: memoryListForResponse(inMemoryProducts),
      procurementItems: memoryListForResponse(inMemoryProcurementItems)
    });
  } catch (error) {
    console.error('Failed to batch delete inventory items:', error);
    return res.status(500).json({ error: 'Failed to batch delete inventory items' });
  }
});

app.get('/api/purchases', async (req, res) => {
  try {
    const rawData = await fetchSupabaseTable('purchases', res.locals.authenticatedUser?.id);
    if (rawData !== null) {
      const list = rawData.map(mapPurchase);
      return res.json({ success: true, message: list.length > 0 ? 'Record found' : 'No record found', purchases: list });
    }
    const list = memoryListForResponse(inMemoryPurchases);
    const message = (list && list.length > 0) ? 'Record found' : 'No record found';
    return res.json({ success: true, message, purchases: list });
  } catch (error) {
    console.error('Failed to fetch purchases:', error);
    return res.status(500).json({ error: 'Failed to fetch purchases.' });
  }
});

app.post('/api/purchases', async (req, res) => {
  try {
    const { supplier, supplierInvoiceNumber, purchaseDate, items, finalBillAmount, paidAmount, dueAmount, billImageUrl, cgst, sgst, totalTax } = req.body;
    const supplierStr = typeof supplier === 'string' ? supplier.trim() : (supplier?.name || supplier || 'Unknown Supplier');

    const newPurchase: IPurchase = {
      id: req.body.id || `pur-${Date.now()}`,
      supplier: supplierStr,
      supplierInvoiceNumber: supplierInvoiceNumber || '',
      purchaseDate: purchaseDate || new Date().toISOString(),
      items: items || [],
      finalBillAmount: Number(finalBillAmount) || 0,
      paidAmount: Number(paidAmount) || 0,
      dueAmount: Number(dueAmount) || 0,
      billImageUrl: billImageUrl || '',
      cgst: Number(cgst) || 0,
      sgst: Number(sgst) || 0,
      totalTax: Number(totalTax) || 0,
      createdAt: new Date().toISOString()
    };

    // Extract and store individual items into procurement_items
    const batchProcurementRows: any[] = [];
    if (Array.isArray(items)) {
      for (const [idx, item] of items.entries()) {
        const prod = item.product || {};
        const pId = prod.id || `prod-item-${idx}`;
        const pName = prod.name || 'Unnamed Product';
        const pSku = prod.sku || prod.code || '';
        const qty = Number(item.quantity) || 0;
        const cost = Number(item.costPrice) || 0;
        const row = {
          id: `proc-item-${newPurchase.id}-${idx}`,
          purchase_id: newPurchase.id,
          supplier: newPurchase.supplier,
          supplier_invoice_number: newPurchase.supplierInvoiceNumber,
          purchase_date: newPurchase.purchaseDate,
          product_id: pId,
          product_name: pName,
          sku: pSku,
          batch_no: item.batchNo || '',
          exp_date: item.expDate || '',
          quantity: qty,
          free_qty: Number(item.freeQty) || 0,
          cost_price: cost,
          total_cost: qty * cost,
          mrp: Number(item.mrp) || 0,
          created_at: new Date().toISOString()
        };
        batchProcurementRows.push(row);
        inMemoryProcurementItems = [
          row,
          ...inMemoryProcurementItems.filter(existing => existing.id !== row.id)
        ];

        // Auto-sync into products table
        const totalQty = qty + (Number(item.freeQty) || 0);
        const isPlaceholder = (s?: string) => !s || ['EXTRACTED', 'MANUAL', 'N/A', 'NONE', 'UNKNOWN', 'DEFAULT', 'TEST', ''].includes(s.trim().toUpperCase());
        const isTempId = !pId || String(pId).startsWith('custom-') || String(pId).startsWith('extracted-');

        let existingProd = !supabaseClient && inMemoryProducts.find(p =>
          (!isTempId && p.id === pId) ||
          (pName && p.name.trim().toLowerCase() === pName.trim().toLowerCase()) ||
          (!isPlaceholder(pSku) && p.sku && p.sku.toLowerCase() === pSku.toLowerCase())
        );

        if (!existingProd && supabaseClient) {
          try {
            const { data: dbMatches } = await supabaseClient.from('products').select('*').ilike('name', pName.trim()).limit(1);
            if (dbMatches && dbMatches.length > 0) {
              existingProd = mapProduct(dbMatches[0]);
              inMemoryProducts.push(existingProd);
            }
          } catch (e) {}
        }

        if (existingProd) {
          existingProd.quantity += totalQty;
          if (cost > 0) existingProd.purchasePrice = cost;
          if (item.mrp && Number(item.mrp) > 0) existingProd.sellingPrice = Number(item.mrp);
          if (supabaseClient && res.locals.authenticatedUser?.id) {
            try {
              supabaseClient.from('products').update({
                quantity: existingProd.quantity,
                purchase_price: existingProd.purchasePrice,
                selling_price: existingProd.sellingPrice,
                user_id: res.locals.authenticatedUser.id
              }).eq('id', existingProd.id).eq('user_id', res.locals.authenticatedUser.id).then();
            } catch (e) {}
          }
        } else {
          const finalSku = !isPlaceholder(pSku) ? pSku : (item.hsnCode ? `HSN-${item.hsnCode}-${idx + 1}` : `SKU-${Date.now().toString().slice(-4)}-${idx + 1}`);
          const newProd: IProduct = {
            id: !isTempId ? pId : `prod-${Date.now()}-${idx + 1}`,
            name: pName,
            category: 'General',
            sku: finalSku,
            size: item.pack || 'Free Size',
            color: '',
            purchasePrice: cost,
            sellingPrice: Number(item.mrp) || cost,
            discountPercent: Number(item.discountPercent) || 0,
            quantity: totalQty,
            minStockAlert: 5,
            imageUrls: ['https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop&q=80'],
            description: `Procured from ${supplierStr} (Batch: ${item.batchNo || 'N/A'})`
          };
          inMemoryProducts.unshift(newProd);
          if (supabaseClient && res.locals.authenticatedUser?.id) {
            try {
              supabaseClient.from('products').insert([{
                id: newProd.id,
                name: newProd.name,
                category: newProd.category,
                sku: newProd.sku,
                size: newProd.size,
                color: newProd.color,
                purchase_price: newProd.purchasePrice,
                selling_price: newProd.sellingPrice,
                discount_percent: newProd.discountPercent,
                quantity: newProd.quantity,
                min_stock_alert: newProd.minStockAlert,
                image_urls: newProd.imageUrls,
                description: newProd.description,
                user_id: res.locals.authenticatedUser.id
              }]).then();
            } catch (e) {}
          }
        }
      }
    }

    if (supabaseClient && res.locals.authenticatedUser?.id) {
      try {
        await supabaseClient.from('purchases').insert([{
          id: newPurchase.id,
          supplier: newPurchase.supplier,
          supplier_invoice_number: newPurchase.supplierInvoiceNumber,
          purchase_date: newPurchase.purchaseDate,
          items: newPurchase.items,
          final_bill_amount: newPurchase.finalBillAmount,
          paid_amount: newPurchase.paidAmount,
          due_amount: newPurchase.dueAmount,
          bill_image_url: newPurchase.billImageUrl,
          cgst: newPurchase.cgst,
          sgst: newPurchase.sgst,
          total_tax: newPurchase.totalTax,
          user_id: res.locals.authenticatedUser.id
        }]);

        if (batchProcurementRows.length > 0) {
          await supabaseClient.from('procurement_items').upsert(batchProcurementRows.map(row => ({ ...row, user_id: res.locals.authenticatedUser.id })), { onConflict: 'id' });
        }
      } catch (e) {}
    }

    inMemoryPurchases.unshift(newPurchase);
    return res.status(201).json({
      success: true,
      purchase: newPurchase,
      purchases: memoryListForResponse(inMemoryPurchases),
      procurementItems: memoryListForResponse(inMemoryProcurementItems)
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create purchase' });
  }
});


app.put('/api/purchases/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { supplier, supplierInvoiceNumber, purchaseDate, items, finalBillAmount, paidAmount, dueAmount, billImageUrl, cgst, sgst, totalTax } = req.body;
    const supplierStr = typeof supplier === 'string' ? supplier.trim() : (supplier?.name || supplier || '');

    const updatedPurchase: Partial<IPurchase> = {
      supplier: supplierStr,
      supplierInvoiceNumber: supplierInvoiceNumber || '',
      purchaseDate: purchaseDate || new Date().toISOString(),
      items: items || [],
      finalBillAmount: Number(finalBillAmount) || 0,
      paidAmount: Number(paidAmount) || 0,
      dueAmount: Number(dueAmount) || 0,
      billImageUrl: billImageUrl || '',
      cgst: Number(cgst) || 0,
      sgst: Number(sgst) || 0,
      totalTax: Number(totalTax) || 0
    };

    if (supabaseClient && res.locals.authenticatedUser?.id) {
      try {
        await supabaseClient.from('purchases').update({
          supplier,
          supplier_invoice_number: supplierInvoiceNumber,
          purchase_date: purchaseDate,
          items,
          final_bill_amount: finalBillAmount,
          paid_amount: paidAmount,
          due_amount: dueAmount,
          bill_image_url: billImageUrl,
          cgst,
          sgst,
          total_tax: totalTax,
          user_id: res.locals.authenticatedUser.id
        }).eq('id', id).eq('user_id', res.locals.authenticatedUser.id);
      } catch (e) {}
    }

    const index = inMemoryPurchases.findIndex(p => p.id === id);
    if (index !== -1) {
      inMemoryPurchases[index] = { ...inMemoryPurchases[index], ...updatedPurchase };
    }

    return res.json({
      success: true,
      purchase: supabaseClient ? updatedPurchase : (inMemoryPurchases[index] || updatedPurchase),
      purchases: memoryListForResponse(inMemoryPurchases)
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update purchase' });
  }
});

app.delete('/api/purchases/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (supabaseClient && res.locals.authenticatedUser?.id) {
      try {
        await supabaseClient.from('purchases').delete().eq('id', id).eq('user_id', res.locals.authenticatedUser.id);
      } catch (e) {}
    }
    inMemoryPurchases = inMemoryPurchases.filter(p => p.id !== id);
    return res.json({ success: true, id, purchases: memoryListForResponse(inMemoryPurchases) });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete purchase' });
  }
});

app.get('/api/challans', async (_req, res) => {
  try {
    const ownerId = res.locals.authenticatedUser?.id;
    if (supabaseClient) {
      if (!ownerId) return res.status(401).json({ error: 'A signed-in account is required to access challans.' });
      const { data, error } = await supabaseClient
        .from('challans')
        .select('*')
        .eq('user_id', ownerId)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Supabase challan fetch failed:', error.message);
        return res.status(500).json({ error: getChallanDatabaseError('fetch', error) });
      }
      return res.json({ success: true, challans: (data || []).map(mapChallan) });
    }
    return res.json({ success: true, challans: inMemoryChallans.filter(item => item.ownerId === (ownerId || 'local-development')) });
  } catch (error) {
    console.error('Failed to fetch challans:', error);
    return res.status(500).json({ error: 'Failed to fetch challans.' });
  }
});

app.get('/api/challans/:id', async (req, res) => {
  try {
    const ownerId = res.locals.authenticatedUser?.id;
    if (supabaseClient) {
      if (!ownerId) return res.status(401).json({ error: 'A signed-in account is required to access challans.' });
      const { data, error } = await supabaseClient
        .from('challans')
        .select('*')
        .eq('id', req.params.id)
        .eq('user_id', ownerId)
        .maybeSingle();
      if (error) {
        console.error('Supabase challan lookup failed:', error.message);
        return res.status(500).json({ error: getChallanDatabaseError('fetch', error) });
      }
      if (!data) return res.status(404).json({ error: 'Challan not found.' });
      return res.json({ success: true, challan: mapChallan(data) });
    }
    const challan = inMemoryChallans.find(item =>
      item.id === req.params.id && item.ownerId === (ownerId || 'local-development')
    );
    if (!challan) return res.status(404).json({ error: 'Challan not found.' });
    return res.json({ success: true, challan });
  } catch (error) {
    console.error('Failed to fetch challan:', error);
    return res.status(500).json({ error: 'Failed to fetch challan.' });
  }
});

app.post('/api/challans', async (req, res) => {
  try {
    const ownerId = res.locals.authenticatedUser?.id || 'local-development';
    if (supabaseClient && !res.locals.authenticatedUser?.id) {
      return res.status(401).json({ error: 'A signed-in account is required to create challans.' });
    }
    const body = req.body || {};
    if (!String(body.challanNumber || '').trim() || !String(body.customerName || '').trim()) {
      return res.status(400).json({ error: 'Challan number and customer name are required.' });
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return res.status(400).json({ error: 'At least one challan item is required.' });
    }

    const now = new Date().toISOString();
    const challan: IChallan = {
      id: String(body.id || `challan-${Date.now()}`),
      ownerId,
      challanNumber: String(body.challanNumber).trim(),
      customerName: String(body.customerName).trim(),
      customerPhone: String(body.customerPhone || '').trim(),
      date: String(body.date || now),
      dueDate: String(body.dueDate || now),
      status: String(body.status || 'Open'),
      items: body.items,
      totalAmount: Number(body.totalAmount) || 0,
      paidAmount: Number(body.paidAmount) || 0,
      notes: String(body.notes || ''),
      createdAt: now,
      updatedAt: now
    };
    const row = {
      id: challan.id,
      user_id: ownerId === 'local-development' ? null : ownerId,
      challan_number: challan.challanNumber,
      customer_name: challan.customerName,
      customer_phone: challan.customerPhone,
      challan_date: challan.date,
      due_date: challan.dueDate,
      status: challan.status,
      items: challan.items,
      total_amount: challan.totalAmount,
      paid_amount: challan.paidAmount,
      notes: challan.notes,
      created_at: challan.createdAt,
      updated_at: challan.updatedAt
    };

    if (supabaseClient) {
      const { data, error } = await supabaseClient.from('challans').insert([row]).select('*').single();
      if (error) {
        console.error('Supabase challan insert failed:', error.message);
        return res.status(500).json({ error: getChallanDatabaseError('create', error) });
      }
      return res.status(201).json({ success: true, challan: mapChallan(data) });
    }
    inMemoryChallans = [challan, ...inMemoryChallans.filter(item => item.id !== challan.id)];
    return res.status(201).json({ success: true, challan });
  } catch (error) {
    console.error('Failed to create challan:', error);
    return res.status(500).json({ error: 'Failed to create challan.' });
  }
});

app.put('/api/challans/:id', async (req, res) => {
  try {
    const ownerId = res.locals.authenticatedUser?.id || 'local-development';
    if (supabaseClient && !res.locals.authenticatedUser?.id) {
      return res.status(401).json({ error: 'A signed-in account is required to update challans.' });
    }
    const body = req.body || {};
    if (!String(body.challanNumber || '').trim() || !String(body.customerName || '').trim()) {
      return res.status(400).json({ error: 'Challan number and customer name are required.' });
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return res.status(400).json({ error: 'At least one challan item is required.' });
    }

    const id = req.params.id;
    const updatedAt = new Date().toISOString();
    const row = {
      challan_number: String(body.challanNumber).trim(),
      customer_name: String(body.customerName).trim(),
      customer_phone: String(body.customerPhone || '').trim(),
      challan_date: String(body.date || updatedAt),
      due_date: String(body.dueDate || updatedAt),
      status: String(body.status || 'Open'),
      items: body.items,
      total_amount: Number(body.totalAmount) || 0,
      paid_amount: Number(body.paidAmount) || 0,
      notes: String(body.notes || ''),
      updated_at: updatedAt
    };

    if (supabaseClient) {
      const { data, error } = await supabaseClient
        .from('challans')
        .update(row)
        .eq('id', id)
        .eq('user_id', ownerId)
        .select('*')
        .maybeSingle();
      if (error) {
        console.error('Supabase challan update failed:', error.message);
        return res.status(500).json({ error: getChallanDatabaseError('update', error) });
      }
      if (!data) return res.status(404).json({ error: 'Challan not found.' });
      return res.json({ success: true, challan: mapChallan(data) });
    }

    const index = inMemoryChallans.findIndex(item => item.id === id && item.ownerId === ownerId);
    if (index < 0) return res.status(404).json({ error: 'Challan not found.' });
    const updated: IChallan = {
      ...inMemoryChallans[index],
      ...mapChallan({ ...row, id, created_at: inMemoryChallans[index].createdAt }),
      id,
      createdAt: inMemoryChallans[index].createdAt,
      updatedAt
    };
    inMemoryChallans[index] = updated;
    return res.json({ success: true, challan: updated });
  } catch (error) {
    console.error('Failed to update challan:', error);
    return res.status(500).json({ error: 'Failed to update challan.' });
  }
});

app.delete('/api/challans/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const ownerId = res.locals.authenticatedUser?.id || 'local-development';
    if (supabaseClient && !res.locals.authenticatedUser?.id) {
      return res.status(401).json({ error: 'A signed-in account is required to delete challans.' });
    }
    if (supabaseClient) {
      const { data, error } = await supabaseClient
        .from('challans')
        .delete()
        .eq('id', id)
        .eq('user_id', ownerId)
        .select('id');
      if (error) {
        console.error('Supabase challan deletion failed:', error.message);
        return res.status(500).json({ error: getChallanDatabaseError('delete', error) });
      }
      if (!data?.length) return res.status(404).json({ error: 'Challan not found.' });
      return res.json({ success: true, id });
    }
    const exists = inMemoryChallans.some(item => item.id === id && item.ownerId === ownerId);
    if (!exists) return res.status(404).json({ error: 'Challan not found.' });
    inMemoryChallans = inMemoryChallans.filter(item => item.id !== id || item.ownerId !== ownerId);
    return res.json({ success: true, id });
  } catch (error) {
    console.error('Failed to delete challan:', error);
    return res.status(500).json({ error: 'Failed to delete challan.' });
  }
});

// ==========================================
// 5. EXPENSES API
// ==========================================

app.get('/api/expenses', async (req, res) => {
  try {
    const rawData = await fetchSupabaseTable('expenses', res.locals.authenticatedUser?.id);
    if (rawData !== null) {
      const list = rawData.map(mapExpense);
      return res.json({ success: true, message: list.length > 0 ? 'Record found' : 'No record found', expenses: list });
    }
    const list = memoryListForResponse(inMemoryExpenses);
    const message = (list && list.length > 0) ? 'Record found' : 'No record found';
    return res.json({ success: true, message, expenses: list });
  } catch (error) {
    console.error('Failed to fetch expenses:', error);
    return res.status(500).json({ error: 'Failed to fetch expenses.' });
  }
});

app.post('/api/expenses', async (req, res) => {
  try {
    const { category, description, amount, date } = req.body;
    if (!category) return res.status(400).json({ error: 'Validation Error: Category is required' });
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Validation Error: Amount must be greater than 0' });

    const newExpense: IExpense = {
      id: req.body.id || `exp-${Date.now()}`,
      category,
      description: description || '',
      amount: Number(amount),
      date: date || new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    if (supabaseClient && res.locals.authenticatedUser?.id) {
      try {
        await supabaseClient.from('expenses').insert([{
          id: newExpense.id,
          category: newExpense.category,
          description: newExpense.description,
          amount: newExpense.amount,
          date: newExpense.date,
          user_id: res.locals.authenticatedUser.id
        }]);
      } catch (e) {}
    }

    inMemoryExpenses.unshift(newExpense);
    return res.status(201).json({ success: true, expense: newExpense, expenses: memoryListForResponse(inMemoryExpenses) });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to record expense' });
  }
});

app.put('/api/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { category, description, amount, date } = req.body;
    
    if (supabaseClient && res.locals.authenticatedUser?.id) {
      try {
        await supabaseClient.from('expenses').update({
          category,
          description,
          amount,
          date,
          user_id: res.locals.authenticatedUser.id
        }).eq('id', id).eq('user_id', res.locals.authenticatedUser.id);
      } catch (e) {}
    }
    
    const index = inMemoryExpenses.findIndex(e => e.id === id);
    if (index !== -1) {
      inMemoryExpenses[index] = { ...inMemoryExpenses[index], category, description, amount: Number(amount), date };
    }
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update expense' });
  }
});

app.delete('/api/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (supabaseClient) {
      try {
        await supabaseClient.from('expenses').delete().eq('id', id);
      } catch (e) {}
    }
    inMemoryExpenses = inMemoryExpenses.filter(e => e.id !== id);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// ==========================================
// 6. SETTINGS API
// ==========================================

app.get('/api/settings', async (req, res) => {
  if (!supabaseClient) {
    return res.json({
      success: true,
      message: 'Record found',
      ...inMemorySettings
    });
  }

  const userId = res.locals.authenticatedUser?.id;
  if (!userId) return res.status(401).json({ error: 'A signed-in account is required to access settings.' });
  try {
    const { data, error } = await supabaseClient
      .from('account_settings')
      .select('profile')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return res.json({
      success: true,
      message: data?.profile ? 'Record found' : 'No record found',
      ...(data?.profile || inMemorySettings)
    });
  } catch (error) {
    console.error('Failed to fetch account settings:', error);
    return res.status(500).json({ error: 'Failed to fetch account settings.' });
  }
});

app.put('/api/settings', async (req, res) => {
  const profile = req.body;
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    return res.status(400).json({ error: 'A valid settings profile is required.' });
  }

  if (!supabaseClient) {
    inMemorySettings = { ...inMemorySettings, ...profile };
    return res.json({ success: true, message: 'Settings saved', settings: inMemorySettings });
  }

  const userId = res.locals.authenticatedUser?.id;
  if (!userId) return res.status(401).json({ error: 'A signed-in account is required to update settings.' });
  try {
    const { error } = await supabaseClient
      .from('account_settings')
      .upsert({ user_id: userId, profile, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) throw error;
    return res.json({ success: true, message: 'Settings saved', settings: profile });
  } catch (error) {
    console.error('Failed to save account settings:', error);
    return res.status(500).json({ error: 'Failed to save account settings.' });
  }
});

// ==========================================
// 7. REPORTS & DASHBOARD METRICS API
// ==========================================

app.get('/api/dashboard', async (req, res) => {
  try {
    let products: IProduct[] = supabaseClient ? [] : inMemoryProducts;
    let invoices: IInvoice[] = supabaseClient ? [] : inMemoryInvoices;
    let purchases: IPurchase[] = supabaseClient ? [] : inMemoryPurchases;
    let expenses: IExpense[] = supabaseClient ? [] : inMemoryExpenses;
    let customers: ICustomer[] = supabaseClient ? [] : inMemoryCustomers;

    if (supabaseClient) {
      const [rawProducts, rawInvoices, rawPurchases, rawExpenses, rawCustomers] = await Promise.all([
        fetchSupabaseTable('products', res.locals.authenticatedUser?.id),
        fetchSupabaseTable('invoices', res.locals.authenticatedUser?.id),
        fetchSupabaseTable('purchases', res.locals.authenticatedUser?.id),
        fetchSupabaseTable('expenses', res.locals.authenticatedUser?.id),
        fetchSupabaseTable('customers', res.locals.authenticatedUser?.id)
      ]);

      products = (rawProducts || []).map(mapProduct);
      invoices = (rawInvoices || []).map(mapInvoice);
      purchases = (rawPurchases || []).map(mapPurchase);
      expenses = (rawExpenses || []).map(mapExpense);
      customers = (rawCustomers || []).map(mapCustomer);
    }

    const totalSales = invoices.reduce((sum, i) => sum + (i.total || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const lowStockCount = products.filter(p => p.quantity <= (p.minStockAlert || 5)).length;
    const totalRecords = products.length + invoices.length + purchases.length + expenses.length + customers.length;
    const message = totalRecords > 0 ? 'Record found' : 'No record found';

    return res.json({
      success: true,
      message,
      products,
      invoices,
      purchases,
      expenses,
      customers,
      summary: {
        totalSales,
        totalExpenses,
        netProfit: totalSales - totalExpenses,
        totalInvoices: invoices.length,
        totalCustomers: customers.length,
        totalProducts: products.length,
        lowStockCount
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

app.get('/api/reports/summary', async (req, res) => {
  try {
    let products: IProduct[] = inMemoryProducts;
    let invoices: IInvoice[] = inMemoryInvoices;
    let expenses: IExpense[] = inMemoryExpenses;
    let customers: ICustomer[] = inMemoryCustomers;

    if (supabaseClient) {
      const [rawProducts, rawInvoices, rawExpenses, rawCustomers] = await Promise.all([
        fetchSupabaseTable('products', res.locals.authenticatedUser?.id),
        fetchSupabaseTable('invoices', res.locals.authenticatedUser?.id),
        fetchSupabaseTable('expenses', res.locals.authenticatedUser?.id),
        fetchSupabaseTable('customers', res.locals.authenticatedUser?.id)
      ]);
      products = (rawProducts || []).map(mapProduct);
      invoices = (rawInvoices || []).map(mapInvoice);
      expenses = (rawExpenses || []).map(mapExpense);
      customers = (rawCustomers || []).map(mapCustomer);
    }

    const totalSales = invoices.reduce((sum, i) => sum + (i.total || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const lowStockCount = products.filter(p => p.quantity <= (p.minStockAlert || 5)).length;

    return res.json({
      totalSales,
      totalExpenses,
      netProfit: totalSales - totalExpenses,
      totalInvoices: invoices.length,
      totalCustomers: customers.length,
      totalProducts: products.length,
      lowStockCount
    });
  } catch (error) {
    console.error('Failed to fetch report summary:', error);
    return res.status(500).json({ error: 'Failed to fetch report summary.' });
  }
});

// ==========================================
// 8. DATA RESET / MAINTENANCE API
// ==========================================

app.post('/api/maintenance/reset', async (req, res) => {
  const user = res.locals.authenticatedUser;
  const allowedAdminIds = (process.env['API_ADMIN_USER_IDS'] || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);
  const isAdmin = user?.app_metadata?.role === 'admin' ||
    (typeof user?.id === 'string' && allowedAdminIds.includes(user.id));
  if (!isAdmin) {
    return res.status(403).json({ error: 'Administrator access is required to reset application data.' });
  }

  try {
    const authorization = req.get('authorization') || '';
    const token = authorization.replace(/^Bearer\s+/i, '');
    const adminSupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    if (supabaseClient) {
      const tables = [
        'procurement_items',
        'purchases',
        'invoices',
        'inventory_logs',
        'products',
        'customers',
        'expenses',
        'challans',
        'account_settings'
      ];
      const results = await Promise.all(
        tables.map(table =>
          adminSupabaseClient.from(table).delete().eq('user_id', user.id)
        )
      );
      const errors = results.filter(result => result.error).map(result => result.error?.message);
      if (errors.length > 0) {
        console.error('Errors clearing Supabase tables:', errors);
        return res.status(500).json({ error: 'One or more database tables could not be reset.' });
      }
    }

    // 1. Clear In-Memory
    inMemoryCustomers = [...DEFAULT_SEED_CUSTOMERS];
    inMemoryProducts = [...DEFAULT_SEED_PRODUCTS];
    inMemoryInvoices = [];
    inMemoryPurchases = [];
    inMemoryProcurementItems = [];
    inMemoryExpenses = [];
    inMemoryInventoryLogs = [];

    return res.json({ success: true, message: 'All database tables cleared successfully (excluding settings).' });
  } catch (error: any) {
    console.error('Critical failure in /api/maintenance/reset:', error);
    return res.status(500).json({ error: 'Failed to reset database.' });
  }
});

// ==========================================
// 9. GEMINI INVOICE OCR & PARSING API
// ==========================================

app.post('/api/parse-invoice', async (req: express.Request, res: express.Response) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'No image data provided.' });
    }

    let mimeType = 'image/jpeg';
    let base64Data = image;

    if (image.startsWith('data:')) {
      const parts = image.split(';base64,');
      mimeType = parts[0].replace('data:', '');
      base64Data = parts[1];
    }

    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Data,
      },
    };

    const promptText = `
Analyze this invoice / bill / purchase order image very carefully.
CRITICAL ORIENTATION & ACCURACY: The invoice image might be oriented at an angle or sideways. Read all printed text accurately.
Check if the bill specifies "Total Items" (for instance "Total Items :- 4" or "Total Items :- 6").
Extract every genuine product line listed in the table, with exactly one output row per printed product line. Do not stop after the first item, merge adjacent items, or omit rows because a column is hard to read. Under no circumstances should you invent, pad, or hallucinate extra rows. If there are 4 items printed, extract exactly 4 items. If there are 6 items, extract exactly 6 items. Never return more rows than actually exist in the table.

Extract:
- supplierName: Name of vendor / agency / distributor at the top header
- invoiceNumber: Invoice or bill number (e.g. A001318)
- date: Date of invoice formatted as YYYY-MM-DD (e.g. 2026-07-22)
- subtotal: Subtotal before taxes and discounts
- discount: Total discount amount if listed
- tax: Total GST tax amount (CGST + SGST or IGST)
- totalAmount: Grand total payable

And for each actual printed product line item:
- itemDescription: Product name (e.g. "ASTHAKIND LPD SYP", "KETOSTAR SOAP", "TELMIKIND-40", "ESLO 2.5 TAB"). DO NOT include totals, disclaimers, or ERP footers.
- hsnCode: HSN code (e.g. "30049030", "34011110", etc.)
- oldMrp: Old MRP if shown
- pack: Pack size (e.g. "100ML", "50GM", "10T", "15TAB")
- batchNo: Batch number (e.g. "A0PWY015", "A6IBZ004", "5K5Z037", "20SBC25018")
- expDate: Expiry formatted as MM/YY (e.g. "09/27", "01/29")
- mrp: MRP value
- quantity: Billed quantity (e.g. 2.5, 1, 2)
- freeQty: Free scheme quantity (e.g. 0.5 for 2.5+0.5, or 0)
- rate: Unit purchase rate (e.g. 71.42, 88.81, 47.14, 78.74)
- sgstPercent: SGST rate percentage for this item (for example 2.5 when GST is 5%)
- cgstPercent: CGST rate percentage for this item (for example 2.5 when GST is 5%)
- discountPercent: Item discount percentage (e.g. 4.75)
- gstPercent: GST tax percentage (e.g. 5)
- amount: Row net amount (e.g. 178.55, 88.81, 94.28, 157.48)

Read every visible item column separately and return every field in the schema for every row. Map printed SGST and CGST rates into sgstPercent and cgstPercent; if the bill shows only a combined GST rate, split it equally between them. Use an empty string for unavailable text fields and 0 for unavailable numeric fields. Do not substitute values from other rows or invent missing batch, expiry, pack, HSN, MRP, rate, or tax details.
`;

    const gemini = getGeminiClient();
    const candidateModels = [
      'gemini-3.8-flash',
      'gemini-flash-latest',
      'gemini-3.1-flash-lite',
      'gemini-3.1-pro-preview'
    ];

    let response: any = null;
    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        response = await gemini.models.generateContent({
          model: modelName,
          contents: [imagePart, { text: promptText }],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                supplierName: {
                  type: Type.STRING,
                  description: 'The name of the vendor, supplier, or medical agency at the top of the invoice.'
                },
                invoiceNumber: {
                  type: Type.STRING,
                  description: 'The invoice number or bill number.'
                },
                date: {
                  type: Type.STRING,
                  description: 'The invoice date formatted as YYYY-MM-DD.'
                },
                subtotal: {
                  type: Type.NUMBER,
                  description: 'The subtotal amount before taxes or discounts.'
                },
                discount: {
                  type: Type.NUMBER,
                  description: 'The total discount amount listed on the bill if any (e.g. 24.66).'
                },
                tax: {
                  type: Type.NUMBER,
                  description: 'The total tax amount (CGST + SGST or IGST) if specified.'
                },
                totalAmount: {
                  type: Type.NUMBER,
                  description: 'The final total amount of the bill.'
                },
                rows: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      hsnCode: { type: Type.STRING },
                      itemDescription: { type: Type.STRING },
                      oldMrp: { type: Type.NUMBER },
                      pack: { type: Type.STRING },
                      batchNo: { type: Type.STRING },
                      expDate: { type: Type.STRING },
                      mrp: { type: Type.NUMBER },
                      quantity: { type: Type.NUMBER },
                      freeQty: { type: Type.NUMBER },
                      rate: { type: Type.NUMBER },
                      sgstPercent: { type: Type.NUMBER },
                      cgstPercent: { type: Type.NUMBER },
                      discountPercent: { type: Type.NUMBER },
                      gstPercent: { type: Type.NUMBER },
                      amount: { type: Type.NUMBER }
                    },
                    required: [
                      'hsnCode', 'itemDescription', 'oldMrp', 'pack', 'batchNo',
                      'expDate', 'mrp', 'quantity', 'freeQty', 'rate',
                      'sgstPercent', 'cgstPercent', 'discountPercent',
                      'gstPercent', 'amount'
                    ]
                  }
                }
              },
              required: ['rows']
            }
          }
        });

        if (response && response.text) {
          console.log(`Gemini invoice OCR succeeded with model: ${modelName}`);
          break;
        }
      } catch (err: any) {
        console.warn(`Model ${modelName} failed in /api/parse-invoice:`, err.message);
        lastError = err;
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error('All Gemini candidate models failed to parse invoice.');
    }

    const resultText = response.text;
    const parsedData = JSON.parse(resultText);

    // Sanitize and validate rows and totals
    if (parsedData && parsedData.rows) {
      parsedData.rows = parsedData.rows.filter((r: any) => {
        const desc = (r.itemDescription || r.description || r.name || '').toUpperCase();
        if (desc.includes('MARG') || desc.includes('BARCODE') || desc.includes('CALL') || desc.includes('BANK DETAILS') || (r.rate && r.rate > 100000)) {
          return false;
        }
        return true;
      });
    }



    return res.json(parsedData);
  } catch (err: any) {
    console.error('Error in /api/parse-invoice endpoint:', err);
    const msg = err?.message || '';
    if (msg.includes('quota') || msg.includes('resource_exhausted') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
      return res.status(429).json({ error: 'Gemini API quota exceeded. Please check your plan and billing details at https://ai.google.dev/gemini-api/docs/rate-limits.' });
    }
    return res.status(500).json({ error: msg || 'Internal server error during invoice parsing.' });
  }
});

// Serve static assets
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const browserDist = path.resolve(__dirname, '../');

const assetsDir = path.resolve(__dirname, 'assets');
if (fs.existsSync(assetsDir)) {
  app.use('/src/assets', express.static(assetsDir));
  app.use('/assets', express.static(assetsDir));
}

if (fs.existsSync(browserDist)) {
  app.use(express.static(browserDist, { maxAge: '1y', index: false }));
}

const angularApp = new AngularNodeAppEngine({
  allowedHosts: ['.run.app', 'localhost', '0.0.0.0', '127.0.0.1'],
  trustProxyHeaders: true
});

app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

export const reqHandler = createNodeRequestHandler(app);

export default reqHandler;

if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 3000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://0.0.0.0:${port}`);
  });
}
