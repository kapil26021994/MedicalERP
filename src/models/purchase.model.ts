import { Product } from './product.model';

export interface PurchaseItem {
  hsnCode?: string;
  product: Product | { id: string; name: string; isNew?: boolean; sku?: string };
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
}

export interface Purchase {
  id: string;
  supplier: string;
  supplierInvoiceNumber: string;
  purchaseDate: Date;
  dlNumber?: string;
  items: PurchaseItem[];
  subtotal?: number;
  discountAmount?: number;
  finalBillAmount: number;
  paidAmount?: number;
  dueAmount?: number;
  billImageUrl?: string;
  cgst?: number;
  sgst?: number;
  totalTax?: number;
  notes?: string;
}

export interface ProcuredItemRecord {
  id: string;
  purchaseId: string;
  supplier: string;
  supplierInvoiceNumber: string;
  purchaseDate: Date;
  productId: string;
  productName: string;
  sku: string;
  batchNo?: string;
  expDate?: string;
  quantity: number;
  freeQty?: number;
  costPrice: number;
  totalCost: number;
  mrp?: number;
}
