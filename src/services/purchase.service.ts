import { Injectable, signal, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Purchase } from '../models/purchase.model';
import { ProductService } from './product.service';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class PurchaseService {
  private productService = inject(ProductService);
  private http = inject(HttpClient);
  private supabaseService = inject(SupabaseService);
  private apiUrl = '/api/purchases';
  
  purchases = signal<Purchase[]>([]);
  procurementItems = signal<any[]>([]);
  isLoaded = signal(false);
  isLoading = signal(false);
  private requestVersion = 0;
  
  constructor() {
    // In-memory only
  }

  extractProcurementItemsFromPurchases(purchasesList: Purchase[]): any[] {
    const list: any[] = [];
    if (!Array.isArray(purchasesList)) return list;

    purchasesList.forEach(p => {
      if (Array.isArray(p.items)) {
        p.items.forEach((item, idx) => {
          const prodObj: any = item.product || {};
          const pName = prodObj.name || (typeof item.product === 'string' ? item.product : '') || 'Procured Item';
          const pSku = prodObj.sku || (item as any).sku || '';
          const qty = Number(item.quantity) || 0;
          const cost = Number(item.costPrice || (item as any).cost_price) || 0;
          const free = Number(item.freeQty || (item as any).free_qty) || 0;
          const mrp = Number(item.mrp) || 0;

          list.push({
            id: `proc-${p.id}-${idx}`,
            purchase_id: p.id,
            purchaseId: p.id,
            supplier: p.supplier || 'Medical Distributor',
            supplier_invoice_number: p.supplierInvoiceNumber || '',
            supplierInvoiceNumber: p.supplierInvoiceNumber || '',
            purchase_date: p.purchaseDate,
            purchaseDate: p.purchaseDate,
            product_id: prodObj.id || `prod-${idx}`,
            productId: prodObj.id || `prod-${idx}`,
            product_name: pName,
            productName: pName,
            hsn_code: (item as any).hsnCode || (item as any).hsn_code || '',
            hsnCode: (item as any).hsnCode || (item as any).hsn_code || '',
            sku: pSku,
            batch_no: (item as any).batchNo || (item as any).batch_no || '',
            batchNo: (item as any).batchNo || (item as any).batch_no || '',
            exp_date: (item as any).expDate || (item as any).exp_date || '',
            expDate: (item as any).expDate || (item as any).exp_date || '',
            quantity: qty,
            free_qty: free,
            freeQty: free,
            cost_price: cost,
            costPrice: cost,
            total_cost: qty * cost,
            totalCost: qty * cost,
            mrp: mrp
          });
        });
      }
    });
    return list;
  }

  setPurchases(data: Purchase[]) {
    if (!Array.isArray(data)) return;
    const mapped = data.map((p: any) => {
      let d = p.purchaseDate ? new Date(p.purchaseDate) : new Date();
      if (isNaN(d.getTime())) d = new Date();
      return { ...p, purchaseDate: d };
    });
    this.purchases.set(mapped);
    this.isLoaded.set(true);
  }

  clearAccountData(): void {
    this.requestVersion++;
    this.purchases.set([]);
    this.procurementItems.set([]);
    this.isLoaded.set(false);
    this.isLoading.set(false);
  }

  async fetchPurchasesFromApi(force: boolean = false) {
    if (!force && this.isLoaded()) return;
    const requestVersion = this.requestVersion;
    this.isLoading.set(true);

    const supabase = this.supabaseService.client();
    if (this.supabaseService.isConfigured() && supabase) {
      const currentUserId = this.supabaseService.currentUser()?.id;
      try {
        let purchasesQuery = supabase.from('purchases').select('*');
        let procQuery = supabase.from('procurement_items').select('*');
        if (currentUserId) {
          purchasesQuery = purchasesQuery.eq('user_id', currentUserId);
          procQuery = procQuery.eq('user_id', currentUserId);
        }
        let [purchasesRes, procRes] = await Promise.all([
          purchasesQuery.order('created_at', { ascending: false }),
          procQuery.order('created_at', { ascending: false })
        ]);
        if (requestVersion !== this.requestVersion) return;

        if (purchasesRes.error) {
          const fallback = currentUserId ? await supabase.from('purchases').select('*').eq('user_id', currentUserId) : await supabase.from('purchases').select('*');
          if (requestVersion !== this.requestVersion) return;
          if (!fallback.error && fallback.data) purchasesRes = fallback;
        }

        if (procRes.error) {
          const fallback = currentUserId ? await supabase.from('procurement_items').select('*').eq('user_id', currentUserId) : await supabase.from('procurement_items').select('*');
          if (requestVersion !== this.requestVersion) return;
          if (!fallback.error && fallback.data) procRes = fallback;
        }

        let mappedPurchases: Purchase[] = [];
        if (!purchasesRes.error && purchasesRes.data) {
           mappedPurchases = purchasesRes.data.map((p: any) => {
             let parsedItems = p.items;
             if (typeof parsedItems === 'string') {
               try { parsedItems = JSON.parse(parsedItems); } catch { parsedItems = []; }
             }
             let d = p.purchase_date || p.created_at;
             d = d ? new Date(d) : new Date();
             if (isNaN(d.getTime())) d = new Date();
             
             return {
                id: p.id,
                supplier: p.supplier || 'Unknown Supplier',
                supplierInvoiceNumber: p.supplier_invoice_number || '',
                purchaseDate: d,
                items: parsedItems || [],
                finalBillAmount: p.final_bill_amount || 0,
                paidAmount: p.paid_amount || 0,
                dueAmount: p.due_amount || 0,
                billImageUrl: p.bill_image_url || '',
                cgst: p.cgst || 0,
                sgst: p.sgst || 0,
                totalTax: p.total_tax || 0
             };
           });
           this.setPurchases(mappedPurchases);
        }

        let procData = (!procRes.error && procRes.data && procRes.data.length > 0) ? procRes.data : [];
        if (procData.length === 0 && mappedPurchases.length > 0) {
          procData = this.extractProcurementItemsFromPurchases(mappedPurchases);
        }
        this.procurementItems.set(procData);
        this.syncProcuredItemsIntoCatalog(this.procurementItems());

        this.isLoading.set(false);
        return;
      } catch (e) {
        if (requestVersion !== this.requestVersion) return;
        this.isLoading.set(false);
      }
    }

    this.http.get<any>(this.apiUrl).subscribe({
      next: (res) => {
        if (requestVersion !== this.requestVersion) return;
        const data = Array.isArray(res) ? res : res?.purchases;
        if (Array.isArray(data)) {
          const mapped = data.map((p: any) => {
            let d = p.purchaseDate ? new Date(p.purchaseDate) : new Date();
            if (isNaN(d.getTime())) d = new Date();
            return { ...p, purchaseDate: d };
          });
          this.purchases.set(mapped);
        }
        if (Array.isArray(res?.procurementItems)) {
          this.procurementItems.set(res.procurementItems);
        }
        this.syncProcuredItemsIntoCatalog(this.procurementItems());
        this.isLoaded.set(true);
        this.isLoading.set(false);
      },
      error: () => {
        if (requestVersion !== this.requestVersion) return;
        this.isLoading.set(false);
      }
    });

    // Also fetch procurement items via API with auto-fallback
    this.http.get<any>('/api/procurement-items').subscribe({
      next: (res) => {
        if (requestVersion !== this.requestVersion) return;
        if (Array.isArray(res?.procurementItems)) {
          this.procurementItems.set(res.procurementItems);
          this.syncProcuredItemsIntoCatalog(this.procurementItems());
        }
      },
      error: () => {}
    });
  }

  syncProcuredItemsIntoCatalog(procurementItemsList: any[]) {
    if (!Array.isArray(procurementItemsList) || procurementItemsList.length === 0) return;
    const existingProducts = this.productService.products();
    const existingNames = new Set(existingProducts.map(p => p.name.trim().toLowerCase()));
    const existingSkus = new Set(existingProducts.map(p => (p.sku || '').trim().toUpperCase()));

    procurementItemsList.forEach((item, idx) => {
      const name = (item.product_name || item.name || '').trim();
      const sku = (item.sku || '').trim();
      if (!name) return;

      if (!existingNames.has(name.toLowerCase()) && (!sku || !existingSkus.has(sku.toUpperCase()))) {
        existingNames.add(name.toLowerCase());
        if (sku) existingSkus.add(sku.toUpperCase());

        const newProdData = {
          name: name,
          category: 'General',
          sku: sku || `SKU-PROC-${Date.now().toString().slice(-4)}-${idx + 1}`,
          size: ((item.size || item.pack || 'Free Size') as any),
          color: '',
          purchasePrice: Number(item.cost_price || item.costPrice) || 0,
          sellingPrice: Number(item.mrp) || Number(item.cost_price || item.costPrice) || 0,
          discountPercent: 0,
          quantity: Number(item.quantity) || 0,
          minStockAlert: 5,
          imageUrls: ['https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop&q=80'],
          description: `Auto-synced from Procured Inventory (${item.supplier || 'Supplier'})`
        };
        this.productService.addProductLocally(newProdData);
      }
    });
  }

  async addPurchase(purchaseData: Omit<Purchase, 'id'>): Promise<Purchase> {
    const newPurchase: Purchase = {
      ...purchaseData,
      id: `purch-${Date.now()}`,
    };

    this.purchases.update(p => [newPurchase, ...p].sort((a, b) => b.purchaseDate.getTime() - a.purchaseDate.getTime()));
    
    // Generate individual item rows for procurement_items table
    const batchRows: any[] = [];
    newPurchase.items.forEach((item, idx) => {
      const prod = item.product || {};
      const pId = (prod as any).id || `prod-${idx}`;
      const pName = (prod as any).name || 'Unnamed Product';
      const pSku = (prod as any).sku || '';
      const qty = Number(item.quantity) || 0;
      const cost = Number(item.costPrice) || 0;

      const row = {
        id: `proc-item-${newPurchase.id}-${idx}`,
        purchase_id: newPurchase.id,
        purchaseId: newPurchase.id,
        supplier: newPurchase.supplier,
        supplier_invoice_number: newPurchase.supplierInvoiceNumber,
        supplierInvoiceNumber: newPurchase.supplierInvoiceNumber,
        purchase_date: newPurchase.purchaseDate,
        purchaseDate: newPurchase.purchaseDate,
        product_id: pId,
        productId: pId,
        product_name: pName,
        productName: pName,
        sku: pSku,
        batch_no: item.batchNo || '',
        batchNo: item.batchNo || '',
        exp_date: item.expDate || '',
        expDate: item.expDate || '',
        quantity: qty,
        free_qty: Number(item.freeQty) || 0,
        freeQty: Number(item.freeQty) || 0,
        cost_price: cost,
        costPrice: cost,
        total_cost: qty * cost,
        totalCost: qty * cost,
        mrp: Number(item.mrp) || 0,
        created_at: new Date().toISOString()
      };
      batchRows.push(row);
    });

    this.procurementItems.update(prev => [...batchRows, ...prev]);

    // Helper to detect generic placeholder SKUs that should never be used for matching
    const isPlaceholderSku = (sku?: string): boolean => {
      if (!sku) return true;
      const s = sku.trim().toUpperCase();
      return ['EXTRACTED', 'MANUAL', 'N/A', 'NONE', 'UNKNOWN', 'DEFAULT', 'TEST', ''].includes(s);
    };

    // Update the local catalog; the purchase API persists the purchase and catalog changes.
    newPurchase.items.forEach((item, idx) => {
      const prodObj: any = (item.product && typeof item.product === 'object') ? item.product : {};
      const prodName = (prodObj.name || (typeof item.product === 'string' ? item.product : '') || 'Procured Item').trim();
      const hsn = (item as any).hsnCode || '';
      const providedSku = (prodObj.sku && !isPlaceholderSku(prodObj.sku) ? prodObj.sku : '').trim();
      const qty = Number(item.quantity) || 0;
      const free = Number(item.freeQty) || 0;
      const totalQuantity = qty + free;
      const cost = Number(item.costPrice) || 0;
      const mrp = Number(item.mrp) || 0;

      // 1. Check if product already exists:
      // Real existing product ID check (ignore client temporary IDs like custom-* or extracted-*)
      const isTemporaryId = !prodObj.id || String(prodObj.id).startsWith('custom-') || String(prodObj.id).startsWith('extracted-');
      let existingProduct = (!isTemporaryId) ? this.productService.getProductById(prodObj.id) : undefined;
      
      // Match by exact Product Name (case-insensitive) - Primary identity
      if (!existingProduct && prodName) {
        existingProduct = this.productService.products().find(p => 
          p.name.trim().toLowerCase() === prodName.toLowerCase()
        );
      }

      // Match by SKU ONLY if it is an actual unique barcode/SKU (not a placeholder)
      if (!existingProduct && providedSku && !isPlaceholderSku(providedSku)) {
        existingProduct = this.productService.getProductBySku(providedSku);
      }

      if (existingProduct) {
        // Product already exists: Increment quantity and update cost/mrp
        const updatedQty = existingProduct.quantity + totalQuantity;
        const updatedProduct = {
          ...existingProduct,
          quantity: updatedQty,
          purchasePrice: cost > 0 ? cost : existingProduct.purchasePrice,
          sellingPrice: mrp > 0 ? mrp : existingProduct.sellingPrice
        };
        this.productService.recordPurchaseStock(
          updatedProduct,
          totalQuantity,
          `Batch procurement from ${newPurchase.supplier}`
        );
        item.product = updatedProduct;
      } else {
        // Product does not exist yet: Add it locally for immediate UI feedback.
        const cleanSku = providedSku || (hsn ? `HSN-${hsn}-${idx + 1}` : `SKU-${Date.now().toString().slice(-4)}-${idx + 1}`);
        const newProductData = {
          name: prodName,
          category: 'General',
          sku: cleanSku,
          size: ((item as any).pack || 'Free Size') as any,
          color: '',
          purchasePrice: cost,
          sellingPrice: mrp > 0 ? mrp : cost,
          discountPercent: Number(item.discountPercent) || 0,
          quantity: totalQuantity,
          minStockAlert: 5,
          imageUrls: ['https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop&q=80'],
          description: `Procured from ${newPurchase.supplier} (Batch: ${(item as any).batchNo || 'N/A'}, Exp: ${(item as any).expDate || 'N/A'})`
        };

        const createdProd = this.productService.addProductLocally(newProductData);
        item.product = createdProd;
      }
    });

    // The API is the single persistence path for purchases and procurement rows.
    const payload = {
      ...newPurchase,
      purchaseDate: newPurchase.purchaseDate instanceof Date ? newPurchase.purchaseDate.toISOString() : newPurchase.purchaseDate
    };

    await firstValueFrom(this.http.post(this.apiUrl, payload));
    return newPurchase;
  }

  async updatePurchase(updatedPurchase: Purchase, oldPurchase: Purchase): Promise<void> {
    this.purchases.update(purchases =>
      purchases.map(p => (p.id === updatedPurchase.id ? updatedPurchase : p))
       .sort((a, b) => b.purchaseDate.getTime() - a.purchaseDate.getTime())
    );

    const stockChanges = new Map<string, number>();
    // Add back old quantities
    oldPurchase.items.forEach(item => {
        if ('quantity' in item.product) {
            stockChanges.set(item.product.id, (stockChanges.get(item.product.id) || 0) - item.quantity);
        }
    });
    // Subtract new quantities
    updatedPurchase.items.forEach(item => {
        if ('quantity' in item.product) {
            stockChanges.set(item.product.id, (stockChanges.get(item.product.id) || 0) + item.quantity);
        }
    });

    // Apply net stock changes and update purchase prices
    stockChanges.forEach((change, productId) => {
        this.productService.updateStock(productId, change);
    });
    updatedPurchase.items.forEach(item => {
        if ('quantity' in item.product) {
            const productToUpdate = this.productService.getProductById(item.product.id);
            if (productToUpdate) {
                this.productService.updateProduct({ ...productToUpdate, purchasePrice: item.costPrice });
            }
        }
    });

    // Sync with backend API
    const payload = {
      ...updatedPurchase,
      purchaseDate: updatedPurchase.purchaseDate instanceof Date ? updatedPurchase.purchaseDate.toISOString() : updatedPurchase.purchaseDate
    };

    await firstValueFrom(this.http.put(`${this.apiUrl}/${updatedPurchase.id}`, payload));
  }

  async deleteAllPurchases() {
    const allPurchases = this.purchases();
    for (const purchase of allPurchases) {
      await this.deletePurchase(purchase.id);
    }
  }

  async deletePurchase(purchaseId: string) {
    const purchaseToDelete = this.purchases().find(p => p.id === purchaseId);
    if (purchaseToDelete) {
      await firstValueFrom(this.http.delete(`${this.apiUrl}/${purchaseId}`));
      this.purchases.update(p => p.filter(item => item.id !== purchaseId));
      // Revert stock for all items in the deleted purchase
      purchaseToDelete.items.forEach(item => {
        if ('quantity' in item.product) {
          this.productService.updateStock(item.product.id, -item.quantity); 
        }
      });

    }
  }
}