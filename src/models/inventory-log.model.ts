export interface InventoryLog {
  id: string;
  productId: string;
  productName: string;
  type: 'Purchase' | 'Sale' | 'Adjustment' | 'Initial';
  quantityChange: number;
  reason: string;
  date: Date;
}