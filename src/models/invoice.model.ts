import { Customer } from './customer.model';

export type InvoiceTemplateId = 'modern' | 'thermal' | 'minimal' | 'corporate' | 'bold';

export interface CartItem {
  id: string; // Product ID for standard items, or a unique ID for custom ones
  name: string;
  cartQuantity: number;
  sellingPrice: number;
  discountPercent: number;
  isCustom: boolean;
  sku?: string;
  imageUrl?: string;
}

export interface Invoice {
  id: string;
  date: Date;
  customer: Customer;
  items: CartItem[];
  subtotal: number;
  total: number;
  paymentMode: 'Cash' | 'UPI' | 'Card';
  totalDiscount: number;
  amountPaid: number;
  notes?: string;
  template?: InvoiceTemplateId;
}