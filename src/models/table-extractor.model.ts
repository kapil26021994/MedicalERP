export interface ExtractedTableRow {
  id: string;
  hsnCode?: string;
  itemDescription: string;
  oldMrp?: number;
  pack?: string;
  batchNo?: string;
  expDate?: string;
  mrp?: number;
  quantity: number;
  freeQty?: number;
  rate: number;
  discountPercent?: number;
  gstPercent?: number;
  amount: number;
}

export interface ExtractedTableData {
  supplierName: string;
  invoiceNumber: string;
  date: string;
  subtotal: number;
  discount?: number;
  tax: number;
  totalAmount: number;
  rows: ExtractedTableRow[];
  rawExtractedText: string;
}
