export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  purchaseHistory: string[]; // Array of invoice IDs
  dueAmount?: number;
  paidAmount?: number;
  notes?: string;
}