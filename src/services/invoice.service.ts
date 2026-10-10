import { Injectable, signal, effect, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CartItem, Invoice } from '../models/invoice.model';
import { SupabaseService } from './supabase.service';
import { ProductService } from './product.service';

@Injectable({ providedIn: 'root' })
export class InvoiceService {
  private http = inject(HttpClient);
  private supabaseService = inject(SupabaseService);
  private productService = inject(ProductService);
  private apiUrl = '/api/invoices';

  invoices = signal<Invoice[]>([]);
  private lastInvoiceNumber = signal(1001);
  isLoaded = signal(false);
  isLoading = signal(false);
  private requestVersion = 0;

  constructor() {
    // In-memory only
  }

  setInvoices(data: Invoice[]) {
    if (!Array.isArray(data)) return;
    const mapped = data.map((inv: any) => {
      let d = inv.date ? new Date(inv.date) : new Date();
      if (isNaN(d.getTime())) d = new Date();
      return { ...inv, date: d };
    });
    this.invoices.set(mapped);
    this.isLoaded.set(true);

    // Dynamic auto-increment: Find the maximum numerical invoice number to prevent collisions
    let maxNum = 1001;
    mapped.forEach(inv => {
      const numStr = inv.invoiceNumber || inv.id;
      const match = numStr?.match(/INV-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) {
          maxNum = num;
        }
      }
    });
    this.lastInvoiceNumber.set(maxNum);
  }

  clearAccountData(): void {
    this.requestVersion++;
    this.invoices.set([]);
    this.lastInvoiceNumber.set(1001);
    this.isLoaded.set(false);
    this.isLoading.set(false);
  }

  async fetchInvoicesFromApi(force: boolean = false) {
    if (!force && this.isLoaded()) return;
    const requestVersion = this.requestVersion;
    this.isLoading.set(true);

    const supabase = this.supabaseService.client();
    if (this.supabaseService.isConfigured() && supabase) {
      const currentUserId = this.supabaseService.currentUser()?.id;
      try {
        let query = supabase.from('invoices').select('*');
        if (currentUserId) {
          query = query.eq('user_id', currentUserId);
        }
        const { data, error } = await query.order('created_at', { ascending: false });
        if (!error && data) {
           if (requestVersion !== this.requestVersion) return;
           const mapped = data.map(i => {
             let parsedCust = i.customer;
             if (typeof parsedCust === 'string') {
               try { parsedCust = JSON.parse(parsedCust); } catch { parsedCust = {}; }
             }
             let parsedItems = i.items;
             if (typeof parsedItems === 'string') {
               try { parsedItems = JSON.parse(parsedItems); } catch { parsedItems = []; }
             }
             return {
                id: i.id,
                date: i.date || i.created_at,
                customer: parsedCust,
                items: parsedItems || [],
                subtotal: i.subtotal || 0,
                total: i.total || 0,
                paymentMode: i.payment_mode || 'Cash',
                totalDiscount: i.total_discount || 0,
                amountPaid: i.amount_paid || 0,
                notes: i.notes || ''
             };
           });
           this.setInvoices(mapped);
           this.isLoading.set(false);
           return;
        }
      } catch (e) {
        if (requestVersion !== this.requestVersion) return;
        this.isLoading.set(false);
      }
    }

    this.http.get<any>(this.apiUrl).subscribe({
      next: (res) => {
        if (requestVersion !== this.requestVersion) return;
        const data = Array.isArray(res) ? res : res?.invoices;
        if (Array.isArray(data)) {
          this.setInvoices(data);
        }
        this.isLoaded.set(true);
        this.isLoading.set(false);
      },
      error: () => {
        if (requestVersion !== this.requestVersion) return;
        this.isLoading.set(false);
      }
    });
  }

  generateNewInvoiceId(): string {
      this.lastInvoiceNumber.update(n => n + 1);
      return `INV-${this.lastInvoiceNumber()}`;
  }

  async addInvoice(invoice: Invoice) {
    await this.applyInvoiceStockChange(undefined, invoice);
    this.invoices.update(invoices => [invoice, ...invoices]);

    // Always trigger HTTP POST request for DevTools Network tab logging
    this.http.post(this.apiUrl, invoice).subscribe({ error: () => {} });

    try {
      const client = this.supabaseService.client();
      const currentUserId = this.supabaseService.currentUser()?.id;
      if (this.supabaseService.isConfigured() && client && currentUserId) {
        await client.from('invoices').insert([{
          id: invoice.id,
          date: invoice.date instanceof Date ? invoice.date.toISOString() : invoice.date,
          customer: invoice.customer,
          items: invoice.items,
          subtotal: invoice.subtotal,
          total: invoice.total,
          payment_mode: invoice.paymentMode,
          total_discount: invoice.totalDiscount || 0,
          amount_paid: invoice.amountPaid || invoice.total,
          notes: invoice.notes || '',
          user_id: currentUserId
        }]);
      }
    } catch (e) {}
  }
  
  getInvoiceById(id: string): Invoice | undefined {
    return this.invoices().find(inv => inv.id === id);
  }

  async updateInvoice(updatedInvoice: Invoice) {
    const previousInvoice = this.getInvoiceById(updatedInvoice.id);
    await this.applyInvoiceStockChange(previousInvoice, updatedInvoice);
    this.invoices.update(invoices => 
      invoices.map(inv => inv.id === updatedInvoice.id ? updatedInvoice : inv)
    );
    // Always trigger HTTP PUT request for DevTools Network tab logging
    this.http.put(`${this.apiUrl}/${updatedInvoice.id}`, updatedInvoice).subscribe({
      next: () => {},
      error: () => {}
    });

    try {
      const client = this.supabaseService.client();
      const currentUserId = this.supabaseService.currentUser()?.id;
      if (this.supabaseService.isConfigured() && client && currentUserId) {
        await client.from('invoices').update({
          customer: updatedInvoice.customer,
          items: updatedInvoice.items,
          subtotal: updatedInvoice.subtotal,
          total: updatedInvoice.total,
          payment_mode: updatedInvoice.paymentMode,
          total_discount: updatedInvoice.totalDiscount,
          amount_paid: updatedInvoice.amountPaid,
          notes: updatedInvoice.notes,
          user_id: currentUserId
        }).eq('id', updatedInvoice.id).eq('user_id', currentUserId);
      }
    } catch (e) {}
  }

  async deleteInvoice(invoiceId: string) {
    const target = this.getInvoiceById(invoiceId);
    if (target) await this.applyInvoiceStockChange(target, undefined);

    this.invoices.update(invoices => invoices.filter(inv => inv.id !== invoiceId));
    // Always trigger HTTP DELETE request for DevTools Network tab logging
    try {
      await firstValueFrom(this.http.delete(`${this.apiUrl}/${invoiceId}`));
    } catch (e) {}

    try {
      const client = this.supabaseService.client();
      const currentUserId = this.supabaseService.currentUser()?.id;
      if (this.supabaseService.isConfigured() && client && currentUserId) {
        await client.from('invoices').delete().eq('id', invoiceId).eq('user_id', currentUserId);
      }
    } catch (e) {}
  }

  async deleteAllInvoices() {
    for (const invoice of this.invoices()) {
      await this.applyInvoiceStockChange(invoice, undefined);
    }
    this.invoices.set([]);
    try {
      await firstValueFrom(this.http.delete(`${this.apiUrl}/all`));
    } catch (e) {}

    try {
      const client = this.supabaseService.client();
      const currentUserId = this.supabaseService.currentUser()?.id;
      if (this.supabaseService.isConfigured() && client && currentUserId) {
        await client.from('invoices').delete().eq('user_id', currentUserId);
      }
    } catch (e) {}
  }

  private async applyInvoiceStockChange(previous?: Invoice, current?: Invoice) {
    const quantitiesFor = (invoice?: Invoice) => {
      const quantities = new Map<string, { item: CartItem; quantity: number }>();
      for (const item of invoice?.items || []) {
        if (!item || item.isCustom) continue;

        const product = this.productService.findProduct(item.id)
          || this.productService.findProduct(item.sku)
          || this.productService.findProduct(item.name);

        if (!product) {
          continue;
        }

        const existing = quantities.get(product.id);
        quantities.set(product.id, {
          item,
          quantity: (existing?.quantity || 0) + Math.max(0, Number(item.cartQuantity) || 0)
        });
      }
      return quantities;
    };

    const previousQuantities = quantitiesFor(previous);
    const currentQuantities = quantitiesFor(current);
    const productIds = new Set([...previousQuantities.keys(), ...currentQuantities.keys()]);

    const stockUpdates: Promise<void>[] = [];
    for (const productId of productIds) {
      const previousItem = previousQuantities.get(productId);
      const currentItem = currentQuantities.get(productId);
      const quantityChange = (previousItem?.quantity || 0) - (currentItem?.quantity || 0);
      if (quantityChange === 0) continue;

      const item = currentItem?.item || previousItem?.item;
      if (!item) continue;
      stockUpdates.push(this.productService.updateStock(
        productId,
        quantityChange,
        currentItem ? 'Sale' : 'Adjustment',
        currentItem ? `Invoice Sale (${current?.id})` : `Deleted/Cancelled Invoice (${previous?.id})`,
        item.sku,
        item.name
      ));
    }
    await Promise.all(stockUpdates);
  }
}