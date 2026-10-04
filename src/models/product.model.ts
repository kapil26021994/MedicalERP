export interface Product {
  id: string;
  name: string;
  category: string;
  sku: string;
  size: 'S' | 'M' | 'L' | 'XL' | 'Free Size';
  color: string;
  purchasePrice: number;
  sellingPrice: number;
  discountPercent: number;
  quantity: number;
  minStockAlert: number;
  imageUrls: string[];
  imageUrl?: string;
  description?: string;
}