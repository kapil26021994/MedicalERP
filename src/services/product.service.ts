
import { Injectable, signal, effect, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Product } from '../models/product.model';
import { InventoryLog } from '../models/inventory-log.model';
import { SupabaseService } from './supabase.service';

const DEFAULT_SEED_PRODUCTS: Product[] = [
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

@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient);
  private supabaseService = inject(SupabaseService);
  private apiUrl = '/api/products';
  
  products = signal<Product[]>([...DEFAULT_SEED_PRODUCTS]);
  inventoryLogs = signal<InventoryLog[]>([]);
  isLoaded = signal(false);
  isLoading = signal(false);

  constructor() {
    // In-memory initialization only, no localStorage
  }

  setProducts(data: Product[]) {
    if (!Array.isArray(data)) return;
    this.products.set(data);
    this.isLoaded.set(true);
  }

  async fetchProductsFromApi(force: boolean = false) {
    if (!force && this.isLoaded()) return;
    this.isLoading.set(true);

    const supabase = this.supabaseService.client();
    if (this.supabaseService.isConfigured() && supabase) {
      try {
        let { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
        if (error) {
          const fallback = await supabase.from('products').select('*');
          data = fallback.data;
          error = fallback.error;
        }
        if (error || !data || data.length === 0) {
          // Check singular 'product' table name
          const fallbackSingle = await supabase.from('product').select('*');
          if (!fallbackSingle.error && fallbackSingle.data && fallbackSingle.data.length > 0) {
            data = fallbackSingle.data;
            error = null;
          }
        }
        if (!error && data) {
           const mapped = data.map(p => {
             let imgs = p.image_urls || p.imageUrls || p.images || [];
             if (typeof imgs === 'string') {
               try { imgs = JSON.parse(imgs); } catch { imgs = [imgs]; }
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
                description: String(p.description || p.details || '')
             };
           });
           this.products.set(mapped);
           this.isLoaded.set(true);
           this.isLoading.set(false);
           return;
        }
      } catch (e) {
        this.isLoading.set(false);
      }
    }

    this.http.get<any>(this.apiUrl).subscribe({
      next: (res) => {
        const data = Array.isArray(res) ? res : res?.products;
        if (Array.isArray(data)) {
          this.products.set(data);
        }
        this.isLoaded.set(true);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  addProduct(product: Omit<Product, 'id'>): Product {
    // 1. STRICT DUPLICATE CHECK: Normalize name and non-placeholder SKU
    const cleanName = product.name?.trim().toLowerCase();
    const cleanSku = product.sku?.trim().toUpperCase();
    const isPlaceholderSku = (sku?: string) => !sku || ['EXTRACTED', 'MANUAL', 'N/A', 'NONE', 'UNKNOWN', 'DEFAULT', 'TEST', ''].includes(sku);

    const existing = this.products().find(p => {
      const matchName = cleanName && p.name?.trim().toLowerCase() === cleanName;
      const matchSku = !isPlaceholderSku(cleanSku) && !isPlaceholderSku(p.sku) && p.sku?.trim().toUpperCase() === cleanSku;
      return matchName || matchSku;
    });

    if (existing) {
      // Duplicate found! Update existing product instead of creating a duplicate row
      const mergedQty = existing.quantity + (product.quantity || 0);
      const updatedProduct: Product = {
        ...existing,
        quantity: mergedQty,
        purchasePrice: (product.purchasePrice && product.purchasePrice > 0) ? product.purchasePrice : existing.purchasePrice,
        sellingPrice: (product.sellingPrice && product.sellingPrice > 0) ? product.sellingPrice : existing.sellingPrice,
        size: product.size || existing.size,
        category: product.category || existing.category,
        description: product.description || existing.description
      };
      this.updateProduct(updatedProduct);
      this.addLog(existing.id, existing.name, product.quantity || 0, 'Purchase', 'Stock added to existing product');
      return updatedProduct;
    }

    const newProduct: Product = { ...product, id: `prod-${Date.now()}` };
    this.products.update(products => [newProduct, ...products]);
    this.addLog(newProduct.id, newProduct.name, newProduct.quantity, 'Initial', 'Initial stock entry');
    this.http.post(this.apiUrl, newProduct).subscribe({ 
      error: (err) => {
        if (this.supabaseService.isAuthenticated()) console.warn('API sync addProduct error:', err);
      } 
    });

    const supabase = this.supabaseService.client();
    if (this.supabaseService.isConfigured() && supabase) {
      // Use upsert or query first to guarantee no duplicate reaches the DB
      supabase.from('products').select('id').ilike('name', product.name.trim()).then(({ data: dbExisting }) => {
        if (dbExisting && dbExisting.length > 0) {
          // Exists in Supabase: Update it instead
          supabase.from('products').update({
            quantity: newProduct.quantity,
            purchase_price: newProduct.purchasePrice,
            selling_price: newProduct.sellingPrice
          }).eq('id', dbExisting[0].id).then();
        } else {
          // Does not exist: Insert clean record
          supabase.from('products').insert([{
            id: newProduct.id, name: newProduct.name, category: newProduct.category, sku: newProduct.sku,
            size: newProduct.size, color: newProduct.color, purchase_price: newProduct.purchasePrice,
            selling_price: newProduct.sellingPrice, discount_percent: newProduct.discountPercent,
            quantity: newProduct.quantity, min_stock_alert: newProduct.minStockAlert,
            image_urls: newProduct.imageUrls, description: newProduct.description
          }]).then();
        }
      });
    }
    return newProduct;
  }

  addProductLocally(product: Omit<Product, 'id'>): Product {
    const newProduct: Product = {
      ...product,
      id: `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    };
    this.products.update(products => [newProduct, ...products]);
    this.addLog(newProduct.id, newProduct.name, newProduct.quantity, 'Initial', 'Initial stock entry');
    return newProduct;
  }

  recordPurchaseStock(updatedProduct: Product, quantityChange: number, reason: string): void {
    this.products.update(products => products.map(product =>
      product.id === updatedProduct.id ? updatedProduct : product
    ));
    this.addLog(updatedProduct.id, updatedProduct.name, quantityChange, 'Purchase', reason);
  }

  updateProduct(updatedProduct: Product) {
    this.products.update(products => products.map(p => p.id === updatedProduct.id ? updatedProduct : p));
    this.http.put(`${this.apiUrl}/${updatedProduct.id}`, updatedProduct).subscribe({ 
      error: (err) => {
        if (this.supabaseService.isAuthenticated()) console.warn('API sync updateProduct error:', err);
      } 
    });

    const supabase = this.supabaseService.client();
    if (this.supabaseService.isConfigured() && supabase) {
      supabase.from('products').update({
        name: updatedProduct.name, category: updatedProduct.category, sku: updatedProduct.sku,
        size: updatedProduct.size, color: updatedProduct.color, purchase_price: updatedProduct.purchasePrice,
        selling_price: updatedProduct.sellingPrice, discount_percent: updatedProduct.discountPercent,
        quantity: updatedProduct.quantity, min_stock_alert: updatedProduct.minStockAlert,
        image_urls: updatedProduct.imageUrls, description: updatedProduct.description
      }).eq('id', updatedProduct.id).then();
    }
  }

  async deleteProduct(productId: string) {
    this.products.update(products => products.filter(p => p.id !== productId));
    try {
      await firstValueFrom(this.http.delete(`${this.apiUrl}/${productId}`));
    } catch (err) {
      if (this.supabaseService.isAuthenticated()) console.warn('API sync deleteProduct error:', err);
    }

    const supabase = this.supabaseService.client();
    if (this.supabaseService.isConfigured() && supabase) {
      await supabase.from('products').delete().eq('id', productId);
    }
  }

  getProductById(id: string): Product | undefined {
    if (!id) return undefined;
    return this.products().find(p => p.id === id);
  }
  
  getProductBySku(sku: string): Product | undefined {
    if (!sku) return undefined;
    const cleanSku = sku.trim().toUpperCase();
    return this.products().find(p => p.sku && p.sku.trim().toUpperCase() === cleanSku);
  }

  findProduct(idOrSkuOrName?: string): Product | undefined {
    if (!idOrSkuOrName) return undefined;
    const clean = idOrSkuOrName.trim().toLowerCase();
    return this.products().find(p => 
      p.id.toLowerCase() === clean || 
      (p.sku && p.sku.toLowerCase() === clean) || 
      (p.name && p.name.trim().toLowerCase() === clean)
    );
  }

  async updateStock(
    productId: string, 
    quantityChange: number, 
    type: InventoryLog['type'] = 'Adjustment', 
    reason: string = 'Stock update',
    sku?: string,
    name?: string
  ) {
    let product = this.getProductById(productId);
    if (!product && sku) product = this.getProductBySku(sku);
    if (!product && name) {
      const cleanName = name.trim().toLowerCase();
      product = this.products().find(p => p.name && p.name.trim().toLowerCase() === cleanName);
    }
    if (!product) {
      console.warn(`Product not found for stock update: ID=${productId}, SKU=${sku}, Name=${name}`);
      return;
    }

    const realId = product.id;
    const newQty = Math.max(0, Number(product.quantity || 0) + Number(quantityChange || 0));
    const updatedProduct: Product = { ...product, quantity: newQty };

    this.products.update(products => products.map(p => 
        p.id === realId ? updatedProduct : p
    ));
    
    this.addLog(realId, product.name, quantityChange, type, reason);

    // HTTP API call so backend in-memory products and database stay in sync
    try {
      await firstValueFrom(this.http.put(`${this.apiUrl}/${realId}`, updatedProduct));
    } catch (err) {
      console.warn('Stock update API note:', err);
    }

    const supabase = this.supabaseService.client();
    if (this.supabaseService.isConfigured() && supabase) {
      try {
        const { error } = await supabase.from('products').update({
          quantity: updatedProduct.quantity
        }).eq('id', realId);
        if (error) console.error('Supabase direct stock update error:', error);
      } catch (error) {
        console.error('Supabase direct stock update error:', error);
      }
    }
  }

  addOrUpdateProductsBatch(productsData: Partial<Product>[]): { added: number, updated: number, errors: number } {
    let added = 0;
    let updated = 0;
    let errors = 0;

    this.products.update(currentProducts => {
      const productSkuMap = new Map<string, Product>(currentProducts.map(p => [p.sku, p]));
      
      productsData.forEach(pData => {
        const productData: any = pData;
        if (!productData.sku || !productData.name) {
          errors++;
          return;
        }

        const existingProduct = productSkuMap.get(productData.sku);
        const quantity = Number(productData.quantity) || 0;

        if (existingProduct) {
          const updatedProduct: Product = { ...existingProduct, quantity: existingProduct.quantity + quantity };
          productSkuMap.set(updatedProduct.sku, updatedProduct);
          this.addLog(updatedProduct.id, updatedProduct.name, quantity, 'Adjustment', 'Bulk import update');
          this.http.put(`${this.apiUrl}/${updatedProduct.id}`, updatedProduct).subscribe({ error: () => {} });
          
          const supabase = this.supabaseService.client();
          if (this.supabaseService.isConfigured() && supabase) {
            supabase.from('products').update({ quantity: updatedProduct.quantity }).eq('id', updatedProduct.id).then();
          }
          
          updated++;
        } else {
          const newProduct: Product = {
            id: `prod-${Date.now()}-${Math.floor(Math.random()*1000)}`,
            name: productData.name,
            category: productData.category || 'Uncategorized',
            sku: productData.sku,
            size: (productData.size as Product['size']) || 'Free Size',
            color: productData.color || 'N/A',
            purchasePrice: Number(productData.purchasePrice) || 0,
            sellingPrice: Number(productData.sellingPrice) || 0,
            discountPercent: Number(productData.discountPercent) || 0,
            quantity: quantity,
            minStockAlert: Number(productData.minStockAlert) || 5,
            imageUrls: productData.imageUrls || ['https://images.unsplash.com/photo-1581655353564-df123a5fae20?q=80&w=400&auto=format&fit=crop'],
            description: productData.description || ''
          };
          productSkuMap.set(newProduct.sku, newProduct);
          this.addLog(newProduct.id, newProduct.name, newProduct.quantity, 'Initial', 'Bulk import creation');
          this.http.post(this.apiUrl, newProduct).subscribe({ error: () => {} });
          
          const supabase = this.supabaseService.client();
          if (this.supabaseService.isConfigured() && supabase) {
            supabase.from('products').insert([{
              id: newProduct.id, name: newProduct.name, category: newProduct.category, sku: newProduct.sku,
              size: newProduct.size, color: newProduct.color, purchase_price: newProduct.purchasePrice,
              selling_price: newProduct.sellingPrice, discount_percent: newProduct.discountPercent,
              quantity: newProduct.quantity, min_stock_alert: newProduct.minStockAlert,
              image_urls: newProduct.imageUrls, description: newProduct.description
            }]).then();
          }
          
          added++;
        }
      });
      return Array.from(productSkuMap.values());
    });
    
    return { added, updated, errors };
  }

  private addLog(productId: string, productName: string, change: number, type: InventoryLog['type'], reason: string) {
    const newLog: InventoryLog = {
      id: `log-${Date.now()}`,
      productId,
      productName,
      type,
      quantityChange: change,
      reason,
      date: new Date()
    };
    this.inventoryLogs.update(logs => [newLog, ...logs].slice(0, 100));
  }
}
