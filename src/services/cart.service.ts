import { Injectable, signal, computed } from '@angular/core';
import { CartItem } from '../models/invoice.model';
import { Product } from '../models/product.model';

export interface ParkedTransaction {
  id: string;
  date: Date;
  customerName: string;
  items: CartItem[];
  subtotal: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  items = signal<CartItem[]>([]);
  taxRate = signal<number>(5); // 5% GST standard retail
  enableTax = signal<boolean>(false); // Retail billing default: inclusive or optional tax
  parkedTransactions = signal<ParkedTransaction[]>([]);

  // Running Subtotal (sum of sellingPrice * cartQuantity)
  subtotal = computed(() => this.items().reduce((acc, item) => acc + (item.sellingPrice * item.cartQuantity), 0));
  
  // Total line discounts
  totalDiscount = computed(() => this.items().reduce((acc, item) => {
    const itemTotal = item.sellingPrice * item.cartQuantity;
    const discount = (itemTotal * (item.discountPercent || 0)) / 100;
    return acc + discount;
  }, 0));

  // Net amount after discount, before tax
  netBeforeTax = computed(() => Math.max(0, this.subtotal() - this.totalDiscount()));

  // Running Tax Amount
  taxAmount = computed(() => {
    if (!this.enableTax()) return 0;
    return Math.round((this.netBeforeTax() * (this.taxRate() / 100)) * 100) / 100;
  });

  // Final Net Payable Grand Total
  total = computed(() => Math.round((this.netBeforeTax() + this.taxAmount()) * 100) / 100);

  // Total distinct line items
  itemCount = computed(() => this.items().length);

  // Total units across all items
  totalUnits = computed(() => this.items().reduce((acc, item) => acc + item.cartQuantity, 0));

  clearAccountData(): void {
    this.items.set([]);
    this.parkedTransactions.set([]);
  }

  getItemQuantity(productId: string): number {
    const found = this.items().find(item => item.id === productId);
    return found ? found.cartQuantity : 0;
  }

  addItem(product: Product, quantity: number = 1) {
    const existingItem = this.items().find(item => item.id === product.id);
    if (existingItem) {
      this.updateQuantity(product.id, existingItem.cartQuantity + quantity);
    } else {
      const cartItem: CartItem = {
        id: product.id,
        name: product.name,
        cartQuantity: Math.max(1, quantity),
        sellingPrice: product.sellingPrice,
        discountPercent: product.discountPercent || 0,
        isCustom: false,
        sku: product.sku,
        imageUrl: product.imageUrls?.[0] || '',
      };
      this.items.update(items => [...items, cartItem]);
    }
  }

  removeItem(productId: string) {
    this.items.update(items => items.filter(item => item.id !== productId));
  }

  updateQuantity(productId: string, newQuantity: number) {
    if (newQuantity <= 0) {
      this.removeItem(productId);
      return;
    }
    this.items.update(items =>
      items.map(item =>
        item.id === productId ? { ...item, cartQuantity: newQuantity } : item
      )
    );
  }

  updateItemDiscount(productId: string, discountPercent: number) {
    const clampedDiscount = Math.min(100, Math.max(0, discountPercent));
    this.items.update(items =>
      items.map(item =>
        item.id === productId ? { ...item, discountPercent: clampedDiscount } : item
      )
    );
  }

  parkCurrentTransaction(customerName: string = 'Walk-in Customer'): boolean {
    if (this.items().length === 0) return false;
    const parked: ParkedTransaction = {
      id: `TXN-PARK-${Date.now().toString().slice(-4)}`,
      date: new Date(),
      customerName,
      items: [...this.items()],
      subtotal: this.subtotal(),
      total: this.total()
    };
    this.parkedTransactions.update(list => [parked, ...list]);
    this.clearCart();
    return true;
  }

  restoreParkedTransaction(id: string): boolean {
    const target = this.parkedTransactions().find(p => p.id === id);
    if (!target) return false;
    this.items.set(target.items);
    this.parkedTransactions.update(list => list.filter(p => p.id !== id));
    return true;
  }

  removeParkedTransaction(id: string) {
    this.parkedTransactions.update(list => list.filter(p => p.id !== id));
  }
  
  clearCart() {
    this.items.set([]);
  }
}