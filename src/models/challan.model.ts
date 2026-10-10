export type ChallanStatus = 'Draft' | 'Open' | 'Partial' | 'Closed';

export interface ChallanItem {
  id: string;
  hsnCode?: string;
  productName: string;
  oldMrp?: number;
  quantity: number;
  batchNo?: string;
  expDate?: string;
  mrp?: number;
  rate: number;
  discountPercent?: number;
  gstPercent?: number;
  unit: string;
  amount: number;
}

export interface Challan {
  id: string;
  challanNumber: string;
  customerName: string;
  customerPhone?: string;
  date: string | Date;
  dueDate: string | Date;
  status: ChallanStatus;
  items: ChallanItem[];
  totalAmount: number;
  paidAmount?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}
