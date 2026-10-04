import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormArray, FormGroup } from '@angular/forms';
import { Purchase, PurchaseItem } from '../../models/purchase.model';
import { PurchaseService } from '../../services/purchase.service';
import { ProductService } from '../../services/product.service';
import { TranslationService } from '../../services/translation.service';
import { SupabaseService } from '../../services/supabase.service';
import { ConfirmationService } from '../../services/confirmation.service';
import { LoaderComponent } from '../layout/loader.component';
import { Product } from '../../models/product.model';
import { convertImageToTableJS } from '../../utils/imageToTableConverter';
import { buildInventoryListItems } from '../../utils/inventory-list';

export interface GstBreakdownRow {
  label: string;
  grossTotal: number;
  sch: number;
  disc: number;
  sgst: number;
  cgst: number;
  totalGst: number;
}

@Component({
  selector: 'app-purchases',
  templateUrl: './purchases.component.html',
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    CurrencyPipe, 
    DatePipe,
    LoaderComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchasesComponent implements OnInit {
  private fb: FormBuilder = inject(FormBuilder);
  purchaseService = inject(PurchaseService);
  productService = inject(ProductService);
  public ts = inject(TranslationService);
  supabaseService = inject(SupabaseService);
  private confirmationService = inject(ConfirmationService);
  private cdr = inject(ChangeDetectorRef);

  showModal = signal(false);
  editingPurchase = signal<Purchase | null>(null);
  showCatalogMultiSelect = signal(false);
  catalogSearchTerm = signal('');
  catalogCategoryFilter = signal('All');
  selectedCatalogProductIds = signal<Set<string>>(new Set());

  inventoryCatalogEntries = computed(() => buildInventoryListItems(
    [
      ...this.purchaseService.procurementItems(),
      ...this.purchaseService.extractProcurementItemsFromPurchases(this.purchaseService.purchases())
    ],
    this.productService.products()
  ));
  inventoryCatalogCategories = computed(() => [
    'All',
    ...new Set(this.inventoryCatalogEntries().map(item => item.catalogProduct.category))
  ]);
  selectedCatalogProductCount = computed(() => {
    return this.inventoryCatalogEntries()
      .filter(item => this.selectedCatalogProductIds().has(item.inventoryKey))
      .length;
  });

  isProcessingBill = signal(false);
  viewingBillUrl = signal<string | null>(null);
  
  // Search & Sorting
  searchTerm = signal('');
  sortBy = signal<'date' | 'supplier' | 'invoice' | 'total' | 'due'>('date');
  sortDirection = signal<'asc' | 'desc'>('desc');

  // Pagination & Filtering
  currentPage = signal(1);
  pageSize = signal(10);

  filteredPurchases = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const sortField = this.sortBy();
    const direction = this.sortDirection();
    let purchases = [...this.purchaseService.purchases()];

    if (term) {
      purchases = purchases.filter(p => {
        const matchesSupplier = p.supplier.toLowerCase().includes(term);
        const matchesInvoice = p.supplierInvoiceNumber.toLowerCase().includes(term);
        const matchesItems = p.items.some(item => item.product?.name?.toLowerCase().includes(term));
        return matchesSupplier || matchesInvoice || matchesItems;
      });
    }

    purchases.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'date') {
        const dateA = new Date(a.purchaseDate).getTime();
        const dateB = new Date(b.purchaseDate).getTime();
        comparison = dateA - dateB;
      } else if (sortField === 'supplier') {
        comparison = a.supplier.localeCompare(b.supplier);
      } else if (sortField === 'invoice') {
        comparison = a.supplierInvoiceNumber.localeCompare(b.supplierInvoiceNumber);
      } else if (sortField === 'total') {
        comparison = a.finalBillAmount - b.finalBillAmount;
      } else if (sortField === 'due') {
        const dueA = a.dueAmount ?? 0;
        const dueB = b.dueAmount ?? 0;
        comparison = dueA - dueB;
      }

      return direction === 'asc' ? comparison : -comparison;
    });

    return purchases;
  });

  paginatedPurchases = computed(() => {
    const purchases = this.filteredPurchases();
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    return purchases.slice(start, start + size);
  });

  totalPages = computed(() => {
    const total = this.filteredPurchases().length;
    return Math.max(1, Math.ceil(total / this.pageSize()));
  });

  startItemIndex = computed(() => {
    if (this.filteredPurchases().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  endItemIndex = computed(() => {
    const total = this.filteredPurchases().length;
    return Math.min(this.currentPage() * this.pageSize(), total);
  });

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  onPageSizeChange(size: number) {
    this.pageSize.set(Number(size));
    this.currentPage.set(1);
  }

  onSearch(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    this.currentPage.set(1);
  }

  toggleSort(field: 'date' | 'supplier' | 'invoice' | 'total' | 'due') {
    if (this.sortBy() === field) {
      this.sortDirection.update(dir => dir === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(field);
      this.sortDirection.set(field === 'supplier' || field === 'invoice' ? 'asc' : 'desc');
    }
    this.currentPage.set(1);
  }

  getSortIcon(field: 'date' | 'supplier' | 'invoice' | 'total' | 'due'): string {
    if (this.sortBy() !== field) {
      return 'unfold_more';
    }
    return this.sortDirection() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  onSortSelectChange(value: string) {
    const [field, dir] = value.split('-');
    this.sortBy.set(field as 'date' | 'supplier' | 'invoice' | 'total' | 'due');
    this.sortDirection.set((dir as 'asc' | 'desc') || 'desc');
    this.currentPage.set(1);
  }

  productSearchTerms = signal<string[]>([]);
  activeProductSearchIndex = signal<number | null>(null);

  autoSyncTotal = true;
  isFullPayment = true;

  calculatedTotal = signal<number>(0);
  dueAmount = signal<number>(0);
  taxableSubtotal = signal<number>(0);
  cgst = signal<number>(0);
  sgst = signal<number>(0);
  totalTax = signal<number>(0);
  totalArticles = signal<number>(0);

  grossSubtotal = signal<number>(0);
  totalDiscount = signal<number>(0);
  amountInWords = signal<string>('');

  gstSummaryRows = signal<GstBreakdownRow[]>([
    { label: 'GST 5 %', grossTotal: 0, sch: 0, disc: 0, sgst: 0, cgst: 0, totalGst: 0 },
    { label: 'GST 12 %', grossTotal: 0, sch: 0, disc: 0, sgst: 0, cgst: 0, totalGst: 0 },
    { label: 'OTHER GST', grossTotal: 0, sch: 0, disc: 0, sgst: 0, cgst: 0, totalGst: 0 }
  ]);

  gstSummaryTotal = signal<GstBreakdownRow>({
    label: 'TOTAL',
    grossTotal: 0,
    sch: 0,
    disc: 0,
    sgst: 0,
    cgst: 0,
    totalGst: 0
  });

  purchaseForm = this.fb.group({
    supplier: ['', Validators.required],
    supplierInvoiceNumber: ['', Validators.required],
    purchaseDate: [new Date().toISOString().split('T')[0], Validators.required],
    dlNumber: [''],
    finalBillAmount: [0, [Validators.required, Validators.min(0)]],
    paidAmount: [0, [Validators.required, Validators.min(0)]],
    billImageUrl: [''],
    items: this.fb.array([], [Validators.required, Validators.minLength(1)]),
    cgst: [0],
    sgst: [0],
    totalTax: [0],
    notes: [''],
  });

  ngOnInit() {
    this.purchaseService.fetchPurchasesFromApi();
    this.productService.fetchProductsFromApi();
    this.purchaseForm.valueChanges.subscribe((val) => {
      this.recalculateTotals(val);
    });
  }

  get items(): FormArray {
    return this.purchaseForm.get('items') as FormArray;
  }

  recalculateTotals(val?: any) {
    const rawVal = val || this.purchaseForm.getRawValue();
    const itemsList = rawVal.items || [];
    
    let subtotalSum = 0;
    let itemsSum = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let articlesSum = 0;
    let grossSubtotalSum = 0;
    let discountSum = 0;

    const classBuckets: { [key: string]: GstBreakdownRow } = {
      'GST 5 %': { label: 'GST 5 %', grossTotal: 0, sch: 0, disc: 0, sgst: 0, cgst: 0, totalGst: 0 },
      'GST 12 %': { label: 'GST 12 %', grossTotal: 0, sch: 0, disc: 0, sgst: 0, cgst: 0, totalGst: 0 },
      'OTHER GST': { label: 'OTHER GST', grossTotal: 0, sch: 0, disc: 0, sgst: 0, cgst: 0, totalGst: 0 }
    };

    for (const item of itemsList) {
      if (item) {
        const qty = Number(item.quantity) || 0;
        const free = Number(item.freeQty) || 0;
        const costInput = Number(item.costPrice);
        const cost = costInput > 0 ? costInput : 0;
        const disc = Number(item.discountPercent) || 0;
        const cgstPct = Number(item.cgstPercent) || 0;
        const sgstPct = Number(item.sgstPercent) || 0;
        const gstPct = cgstPct + sgstPct || Number(item.gstPercent) || 0;

        articlesSum += (qty + free);

        const gross = qty * cost;
        const discAmount = gross * (Math.min(100, Math.max(0, disc)) / 100);
        const lineTaxable = gross - discAmount;
        const lineTax = lineTaxable * (gstPct / 100);
        const lineTotal = lineTaxable + lineTax;

        grossSubtotalSum += gross;
        discountSum += discAmount;
        subtotalSum += lineTaxable;
        itemsSum += lineTotal;
        totalCgst += lineTaxable * (cgstPct + sgstPct > 0 ? cgstPct : gstPct / 2) / 100;
        totalSgst += lineTaxable * (cgstPct + sgstPct > 0 ? sgstPct : gstPct / 2) / 100;

        let bucketKey = 'OTHER GST';
        if (Math.abs(gstPct - 5) < 0.1) bucketKey = 'GST 5 %';
        else if (Math.abs(gstPct - 12) < 0.1) bucketKey = 'GST 12 %';

        const bucket = classBuckets[bucketKey];
        bucket.grossTotal += gross;
        bucket.disc += discAmount;
        bucket.cgst += lineTaxable * (cgstPct + sgstPct > 0 ? cgstPct : gstPct / 2) / 100;
        bucket.sgst += lineTaxable * (cgstPct + sgstPct > 0 ? sgstPct : gstPct / 2) / 100;
        bucket.totalGst += lineTax;
      }
    }
    
    const roundedGrossSubtotal = Math.round(grossSubtotalSum * 100) / 100;
    const roundedDiscount = Math.round(discountSum * 100) / 100;
    const roundedSubtotal = Math.round(subtotalSum * 100) / 100;
    const roundedCgst = Math.round(totalCgst * 100) / 100;
    const roundedSgst = Math.round(totalSgst * 100) / 100;
    const roundedTax = Math.round((totalCgst + totalSgst) * 100) / 100;
    const roundedTotal = Math.round(itemsSum);

    const rows: GstBreakdownRow[] = Object.values(classBuckets).map(b => ({
      ...b,
      grossTotal: Math.round(b.grossTotal * 100) / 100,
      disc: Math.round(b.disc * 100) / 100,
      sgst: Math.round(b.sgst * 100) / 100,
      cgst: Math.round(b.cgst * 100) / 100,
      totalGst: Math.round(b.totalGst * 100) / 100,
    }));

    const totalRow: GstBreakdownRow = {
      label: 'TOTAL',
      grossTotal: roundedGrossSubtotal,
      sch: 0,
      disc: roundedDiscount,
      sgst: roundedSgst,
      cgst: roundedCgst,
      totalGst: roundedTax
    };

    this.grossSubtotal.set(roundedGrossSubtotal);
    this.totalDiscount.set(roundedDiscount);
    this.taxableSubtotal.set(roundedSubtotal);
    this.cgst.set(roundedCgst);
    this.sgst.set(roundedSgst);
    this.totalTax.set(roundedTax);
    this.calculatedTotal.set(roundedTotal);
    this.totalArticles.set(articlesSum);
    this.gstSummaryRows.set(rows);
    this.gstSummaryTotal.set(totalRow);
    this.amountInWords.set(this.getAmountInWords(roundedTotal));

    this.purchaseForm.patchValue({
      cgst: roundedCgst,
      sgst: roundedSgst,
      totalTax: roundedTax,
      finalBillAmount: roundedTotal
    }, { emitEvent: false });

    let finalBill = roundedTotal;
    let paid = Number(rawVal.paidAmount);
    if (isNaN(paid)) paid = 0;

    if (this.isFullPayment) {
      paid = finalBill;
      this.purchaseForm.patchValue({
        paidAmount: finalBill
      }, { emitEvent: false });
    }

    const due = Math.max(0, finalBill - paid);
    this.dueAmount.set(due);

    this.cdr.markForCheck();
  }

  getAmountInWords(num: number): string {
    const val = Math.round(num);
    if (!val || val <= 0) return 'Rupees Zero Only';

    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const inWords = (n: number): string => {
      let str = '';
      if (n >= 10000000) {
        str += inWords(Math.floor(n / 10000000)) + 'Crore ';
        n %= 10000000;
      }
      if (n >= 100000) {
        str += inWords(Math.floor(n / 100000)) + 'Lakh ';
        n %= 100000;
      }
      if (n >= 1000) {
        str += inWords(Math.floor(n / 1000)) + 'Thousand ';
        n %= 1000;
      }
      if (n >= 100) {
        str += inWords(Math.floor(n / 100)) + 'Hundred ';
        n %= 100;
      }
      if (n > 0) {
        if (str !== '') str += 'and ';
        if (n < 20) {
          str += a[n];
        } else {
          str += b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : ' ');
        }
      }
      return str;
    };

    const words = inWords(val).trim();
    return `Rupees ${words} Only`;
  }

  filteredProducts(index: number) {
    const term = this.productSearchTerms()[index]?.toLowerCase() || '';
    if (!term) return [];
    return this.productService.products().filter(
      p => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)
    );
  }

  filteredCatalogProducts() {
    const term = this.catalogSearchTerm().trim().toLowerCase();
    const category = this.catalogCategoryFilter();
    return this.inventoryCatalogEntries().filter(item => {
      const product = item.catalogProduct;
      const matchesCategory = category === 'All' || product.category === category;
      const matchesTerm = !term ||
        product.name.toLowerCase().includes(term) ||
        (product.sku || '').toLowerCase().includes(term) ||
        String(item.batchNo || item.batch_no || '').toLowerCase().includes(term);
      return matchesCategory && matchesTerm;
    });
  }

  toggleCatalogMultiSelect() {
    this.catalogSearchTerm.set('');
    this.catalogCategoryFilter.set('All');
    this.selectedCatalogProductIds.set(new Set());
    this.showCatalogMultiSelect.set(true);
  }

  setCatalogSearchTerm(event: Event) {
    this.catalogSearchTerm.set((event.target as HTMLInputElement).value);
  }

  cancelCatalogMultiSelect() {
    this.showCatalogMultiSelect.set(false);
    this.selectedCatalogProductIds.set(new Set());
    this.catalogSearchTerm.set('');
    this.catalogCategoryFilter.set('All');
  }

  toggleCatalogProduct(productId: string) {
    this.selectedCatalogProductIds.update(selected => {
      const next = new Set(selected);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }

  addSelectedCatalogProducts() {
    const selectedIds = this.selectedCatalogProductIds();
    const selectedEntries = this.inventoryCatalogEntries()
      .filter(entry => selectedIds.has(entry.inventoryKey));
    if (selectedEntries.length === 0) return;

    const nextSearchTerms = [...this.productSearchTerms()];
    const availableEmptyRows = this.items.controls
      .map((control, index) => ({ control, index }))
      .filter(({ control }) => {
        const product = control.get('product')?.value;
        return !product || !product.name?.trim();
      });

    selectedEntries.forEach((entry, entryIndex) => {
      const product = entry.catalogProduct;
      const itemData = {
        product,
        oldMrp: product.sellingPrice || 0,
        batchNo: entry.batchNo || entry.batch_no || '',
        expDate: entry.expDate || entry.exp_date || '',
        mrp: Number(entry.mrp) || product.sellingPrice || 0,
        quantity: Number(entry.quantity) || 1,
        freeQty: Number(entry.freeQty || entry.free_qty) || 0,
        costPrice: Number(entry.costPrice || entry.cost_price) || product.purchasePrice || 0
      };
      const emptyRow = availableEmptyRows[entryIndex];
      if (emptyRow) {
        emptyRow.control.patchValue(itemData);
        nextSearchTerms[emptyRow.index] = product.name;
      } else {
        this.items.push(this.createItem(itemData));
        nextSearchTerms.push(product.name);
      }
    });

    this.productSearchTerms.set(nextSearchTerms);
    this.selectedCatalogProductIds.set(new Set());
    this.catalogSearchTerm.set('');
    this.catalogCategoryFilter.set('All');
    this.showCatalogMultiSelect.set(false);
    this.recalculateTotals();
  }

  createItem(data?: { 
    hsnCode?: string, 
    product?: any, 
    oldMrp?: number,
    pack?: string,
    batchNo?: string,
    expDate?: string,
    mrp?: number,
    quantity?: number, 
    freeQty?: number,
    costPrice?: number, 
    discountPercent?: number,
    gstPercent?: number,
    sgstPercent?: number,
    cgstPercent?: number,
  }): FormGroup {
    const gstPercent = data?.gstPercent ?? 5;
    const cgstPercent = data?.cgstPercent ?? gstPercent / 2;
    const sgstPercent = data?.sgstPercent ?? gstPercent - cgstPercent;
    return this.fb.group({
      hsnCode: [data?.hsnCode || ''],
      product: [data?.product || null, Validators.required],
      oldMrp: [data?.oldMrp !== undefined && data?.oldMrp !== null ? data.oldMrp : 0, [Validators.min(0)]],
      pack: [data?.pack || ''],
      batchNo: [data?.batchNo || ''],
      expDate: [data?.expDate || ''],
      mrp: [data?.mrp !== undefined && data?.mrp !== null ? data.mrp : 0, [Validators.min(0)]],
      quantity: [data?.quantity !== undefined && data?.quantity !== null ? data.quantity : 1, [Validators.required, Validators.min(0.01)]],
      freeQty: [data?.freeQty !== undefined && data?.freeQty !== null ? data.freeQty : 0, [Validators.min(0)]],
      costPrice: [data?.costPrice !== undefined && data?.costPrice !== null ? data.costPrice : 0, [Validators.required, Validators.min(0)]],
      discountPercent: [data?.discountPercent || 0, [Validators.min(0), Validators.max(100)]],
      gstPercent: [gstPercent, [Validators.min(0), Validators.max(100)]],
      sgstPercent: [sgstPercent, [Validators.min(0), Validators.max(100)]],
      cgstPercent: [cgstPercent, [Validators.min(0), Validators.max(100)]]
    });
  }

  addItem() {
    this.items.push(this.createItem());
    this.productSearchTerms.update(terms => [...terms, '']);
    this.recalculateTotals();
  }

  removeItem(index: number) {
    this.items.removeAt(index);
    this.productSearchTerms.update(terms => terms.filter((_, i) => i !== index));
    if (this.items.length === 0) {
      this.addItem();
    } else {
      this.recalculateTotals();
    }
  }

  syncInvoiceTotalWithCalculated() {
    this.autoSyncTotal = true;
    this.recalculateTotals();
  }

  onFinalBillAmountChange() {
    this.autoSyncTotal = false;
    const finalBill = Number(this.purchaseForm.get('finalBillAmount')?.value) || 0;
    if (this.isFullPayment) {
      this.purchaseForm.patchValue({ paidAmount: finalBill }, { emitEvent: false });
    }
    this.recalculateTotals();
  }

  onPaidAmountChange() {
    this.isFullPayment = false;
    const finalBill = Number(this.purchaseForm.get('finalBillAmount')?.value) || 0;
    const paid = Number(this.purchaseForm.get('paidAmount')?.value) || 0;
    const due = Math.max(0, finalBill - paid);
    this.dueAmount.set(due);
  }

  setPaymentPreset(type: 'full' | 'zero') {
    const finalBill = Number(this.calculatedTotal()) || Number(this.purchaseForm.get('finalBillAmount')?.value) || 0;
    if (type === 'full') {
      this.isFullPayment = true;
      this.purchaseForm.patchValue({ paidAmount: finalBill });
    } else {
      this.isFullPayment = false;
      this.purchaseForm.patchValue({ paidAmount: 0 });
    }
    this.recalculateTotals();
  }
  
  openAddModal() {
    this.editingPurchase.set(null);
    this.autoSyncTotal = true;
    this.isFullPayment = false;
    this.purchaseForm.reset({
      supplier: '',
      supplierInvoiceNumber: '',
      purchaseDate: new Date().toISOString().split('T')[0],
      dlNumber: '',
      finalBillAmount: 0,
      paidAmount: 0,
      billImageUrl: '',
      cgst: 0,
      sgst: 0,
      totalTax: 0,
      notes: '',
    });
    this.items.clear();
    this.productSearchTerms.set([]);
    this.addItem(); // Start with 1 fresh item row

    this.showModal.set(true);
    this.recalculateTotals();
    this.cdr.detectChanges();
  }

  openEditModal(purchase: Purchase) {
    this.editingPurchase.set(purchase);
    const finalBill = purchase.finalBillAmount ?? 0;
    const paid = purchase.paidAmount !== undefined ? purchase.paidAmount : finalBill;
    this.isFullPayment = (paid >= finalBill && finalBill > 0);
    this.autoSyncTotal = false;

    this.purchaseForm.patchValue({
      supplier: purchase.supplier,
      supplierInvoiceNumber: purchase.supplierInvoiceNumber,
      purchaseDate: new Date(purchase.purchaseDate).toISOString().split('T')[0],
      dlNumber: purchase.dlNumber || '',
      finalBillAmount: finalBill,
      paidAmount: paid,
      billImageUrl: purchase.billImageUrl,
      cgst: purchase.cgst ?? 0,
      sgst: purchase.sgst ?? 0,
      totalTax: purchase.totalTax ?? 0,
      notes: purchase.notes ?? '',
    });
    
    this.items.clear();
    const searchTerms: string[] = [];
    purchase.items.forEach(item => {
      this.items.push(this.createItem(item));
      searchTerms.push(item.product.name);
    });
    this.productSearchTerms.set(searchTerms);

    this.showModal.set(true);
    this.recalculateTotals();
    this.cdr.detectChanges();
  }
  
  closeModal() {
    this.showModal.set(false);
  }

  async deletePurchase(purchase: Purchase) {
    const confirmed = await this.confirmationService.confirm({
      title: 'Delete Purchase',
      message: `Are you sure you want to delete this purchase from ${purchase.supplier}? This will reduce the stock for all associated items.`,
      confirmText: 'Delete',
      type: 'danger'
    });

    if (confirmed) {
      await this.purchaseService.deletePurchase(purchase.id);
    }
  }

  async deleteAll() {
    const confirmed = await this.confirmationService.confirm({
      title: 'Delete All Purchases',
      message: `Are you sure you want to delete ALL purchases? This will reduce the stock for all associated items and the action cannot be undone.`,
      confirmText: 'Delete All',
      type: 'danger'
    });

    if (confirmed) {
      await this.purchaseService.deleteAllPurchases();
    }
  }

  selectedIds = signal<Set<string>>(new Set());

  isAllSelected = computed(() => {
    const list = this.paginatedPurchases();
    if (list.length === 0) return false;
    return list.every(p => this.selectedIds().has(p.id));
  });

  toggleSelectAll() {
    const list = this.paginatedPurchases();
    const currentSelected = new Set(this.selectedIds());
    if (this.isAllSelected()) {
      list.forEach(p => currentSelected.delete(p.id));
    } else {
      list.forEach(p => currentSelected.add(p.id));
    }
    this.selectedIds.set(currentSelected);
  }

  toggleSelection(id: string) {
    const currentSelected = new Set(this.selectedIds());
    if (currentSelected.has(id)) {
      currentSelected.delete(id);
    } else {
      currentSelected.add(id);
    }
    this.selectedIds.set(currentSelected);
  }

  async deleteSelected() {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;

    const confirmed = await this.confirmationService.confirm({
      title: 'Delete Selected',
      message: `Are you sure you want to delete ${ids.length} selected purchase(s)?`,
      confirmText: 'Delete',
      type: 'danger'
    });

    if (confirmed) {
      for (const id of ids) {
        await this.purchaseService.deletePurchase(id);
      }
      this.selectedIds.set(new Set());
    }
  }

  savePurchase() {
    if (this.purchaseForm.invalid) {
      this.purchaseForm.markAllAsTouched();
      return;
    }
    const formValue = this.purchaseForm.getRawValue();
    const finalBill = Number(formValue.finalBillAmount) || 0;
    const paid = Number(formValue.paidAmount) || 0;
    const due = Math.max(0, finalBill - paid);

    const purchaseData: Omit<Purchase, 'id'> = {
      supplier: formValue.supplier,
      supplierInvoiceNumber: formValue.supplierInvoiceNumber,
      purchaseDate: new Date(formValue.purchaseDate),
      dlNumber: formValue.dlNumber || '',
      items: formValue.items.map((item: any) => ({
        hsnCode: item.hsnCode || '',
        product: item.product,
        oldMrp: Number(item.oldMrp) || 0,
        pack: item.pack || '',
        batchNo: item.batchNo || '',
        expDate: item.expDate || '',
        mrp: Number(item.mrp) || 0,
        quantity: Number(item.quantity) || 1,
        freeQty: Number(item.freeQty) || 0,
        costPrice: Number(item.costPrice) || 0,
        discountPercent: Number(item.discountPercent) || 0,
        gstPercent: Number(item.gstPercent) || 0,
        sgstPercent: Number(item.sgstPercent) || 0,
        cgstPercent: Number(item.cgstPercent) || 0,
      })),
      finalBillAmount: finalBill,
      paidAmount: paid,
      dueAmount: due,
      billImageUrl: formValue.billImageUrl,
      cgst: formValue.cgst,
      sgst: formValue.sgst,
      totalTax: formValue.totalTax,
      notes: formValue.notes,
    };

    if (this.editingPurchase()) {
      const updatedPurchase = { ...this.editingPurchase()!, ...purchaseData };
      this.purchaseService.updatePurchase(updatedPurchase, this.editingPurchase()!);
    } else {
      this.purchaseService.addPurchase(purchaseData);
    }
    this.closeModal();
  }
  
  getItemName(index: number): string {
    const terms = this.productSearchTerms();
    if (terms && terms[index]) return terms[index];
    const item = this.items.at(index);
    if (!item) return '';
    const prod = item.get('product')?.value;
    if (typeof prod === 'string') return prod;
    if (prod && typeof prod === 'object' && prod.name) return prod.name;
    return '';
  }

  getLineAmount(index: number): number {
    const item = this.items.at(index);
    if (!item) return 0;
    const qty = Number(item.get('quantity')?.value) || 0;
    const costInput = Number(item.get('costPrice')?.value);
    const cost = costInput > 0 ? costInput : 0;
    const disc = Number(item.get('discountPercent')?.value) || 0;
    const sgstPct = Number(item.get('sgstPercent')?.value) || 0;
    const cgstPct = Number(item.get('cgstPercent')?.value) || 0;
    const legacyGstPct = Number(item.get('gstPercent')?.value) || 0;
    const gstPct = sgstPct + cgstPct || legacyGstPct;
    const gross = qty * cost;
    const discAmount = gross * (Math.min(100, Math.max(0, disc)) / 100);
    const lineTaxable = gross - discAmount;
    const lineTax = lineTaxable * (gstPct / 100);
    return Math.round((lineTaxable + lineTax) * 100) / 100;
  }

  onItemInputChange(index: number, field?: string) {
    const item = this.items.at(index);
    if (!item) return;

    if (field === 'mrp') {
      const mrpVal = Number(item.get('mrp')?.value) || 0;
      const costVal = Number(item.get('costPrice')?.value) || 0;
      if (costVal === 0 && mrpVal > 0) {
        item.patchValue({ costPrice: mrpVal }, { emitEvent: false });
      }
    }
    this.recalculateTotals();
  }

  onProductSearch(event: Event, index: number) {
    const term = (event.target as HTMLInputElement).value;
    this.productSearchTerms.update(terms => {
      const copy = [...terms];
      copy[index] = term;
      return copy;
    });
    this.activeProductSearchIndex.set(index);

    const itemGroup = this.items.at(index);
    const currProd = itemGroup.get('product')?.value;
    itemGroup.patchValue({
      product: {
        id: currProd?.id || `custom-p-${Date.now()}-${index}`,
        name: term,
        sku: 'MANUAL',
        purchasePrice: itemGroup.get('costPrice')?.value || 0,
        quantity: 0
      }
    });
  }

  selectProduct(product: Product, index: number) {
    const item = this.items.at(index);
    item.patchValue({ 
      product: product,
      costPrice: product.purchasePrice || product.sellingPrice || 0
    });
    this.productSearchTerms.update(terms => {
      terms[index] = product.name;
      return [...terms];
    });
    this.activeProductSearchIndex.set(null);

    this.recalculateTotals();

    if (index === this.items.length - 1) {
      this.addItem();
    }
  }

  selectCustomProduct(searchTerm: string, index: number) {
    const name = searchTerm.trim() || 'Purchase Item';
    const item = this.items.at(index);
    const customProd = {
      id: `custom-p-${Date.now()}`,
      name: name,
      sku: 'MANUAL',
      purchasePrice: item.get('costPrice')?.value || 0,
      quantity: 0
    };

    item.patchValue({
      product: customProd
    });
    this.productSearchTerms.update(terms => {
      terms[index] = name;
      return [...terms];
    });
    this.activeProductSearchIndex.set(null);

    this.recalculateTotals();

    if (index === this.items.length - 1) {
      this.addItem();
    }
  }

  async onBillImageSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.isProcessingBill.set(true);
    this.cdr.markForCheck();
    this.cdr.detectChanges();

    const reader = new FileReader();
    reader.onload = async (e) => {
      const fullBase64 = e.target?.result as string;
      this.purchaseForm.patchValue({ billImageUrl: fullBase64 });

      try {
        const parsed = await this.parseInvoiceWithJS(file, fullBase64);
        
        this.purchaseForm.patchValue({
          supplier: parsed.supplier,
          supplierInvoiceNumber: parsed.supplierInvoiceNumber,
          purchaseDate: parsed.purchaseDate,
          finalBillAmount: parsed.finalBillAmount,
          paidAmount: parsed.finalBillAmount,
          cgst: parsed.cgst,
          sgst: parsed.sgst,
          totalTax: parsed.totalTax,
        });

        this.items.clear();
        const searchTerms: string[] = [];
        if (parsed.items && parsed.items.length > 0) {
          parsed.items.forEach((item) => {
            const newFormGroup = this.createItem({
              hsnCode: item.hsnCode,
              product: item.product,
              oldMrp: item.oldMrp,
              pack: item.pack,
              batchNo: item.batchNo,
              expDate: item.expDate,
              mrp: item.mrp,
              quantity: item.quantity,
              freeQty: item.freeQty,
              costPrice: item.costPrice,
              discountPercent: item.discountPercent,
              gstPercent: item.gstPercent,
              sgstPercent: item.sgstPercent,
              cgstPercent: item.cgstPercent,
            });
            this.items.push(newFormGroup);
            const pName = typeof item.product === 'string' ? item.product : (item.product?.name || 'Pharma Item');
            searchTerms.push(pName);
          });
        } else {
          this.addItem();
          alert('No product line items were detected in the bill. Please check the image or add the items manually.');
        }
        this.productSearchTerms.set(searchTerms);
        this.autoSyncTotal = false;
        this.recalculateTotals();

      } catch (error) {
        console.error('Error parsing bill:', error);
        alert('Could not parse the bill. Please check the image and add the items manually.');
      } finally {
        this.isProcessingBill.set(false);
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      }
    };
    reader.readAsDataURL(file);
    (event.target as HTMLInputElement).value = '';
  }

  async rotateBillImage() {
    const currentUrl = this.purchaseForm.get('billImageUrl')?.value;
    if (!currentUrl) return;

    this.isProcessingBill.set(true);
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = currentUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
      }

      const rotatedBase64 = canvas.toDataURL('image/jpeg', 0.9);
      this.purchaseForm.patchValue({ billImageUrl: rotatedBase64 });

      const arr = rotatedBase64.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const rotatedFile = new File([blob], 'rotated_bill.jpg', { type: 'image/jpeg' });

      const parsed = await this.parseInvoiceWithJS(rotatedFile, rotatedBase64);
      this.purchaseForm.patchValue({
        supplier: parsed.supplier,
        supplierInvoiceNumber: parsed.supplierInvoiceNumber,
        purchaseDate: parsed.purchaseDate,
        finalBillAmount: parsed.finalBillAmount,
        paidAmount: parsed.finalBillAmount,
        cgst: parsed.cgst,
        sgst: parsed.sgst,
        totalTax: parsed.totalTax,
      });

      this.items.clear();
      const searchTerms: string[] = [];
      if (parsed.items && parsed.items.length > 0) {
        parsed.items.forEach((item:any) => {
          const newFormGroup = this.createItem({
            hsnCode: item.hsnCode,
            product: item.product,
            oldMrp: item.oldMrp,
            pack: item.pack,
            batchNo: item.batchNo,
            expDate: item.expDate,
            mrp: item.mrp,
            quantity: item.quantity,
            freeQty: item.freeQty,
            costPrice: item.costPrice,
            discountPercent: item.discountPercent,
            gstPercent: item.gstPercent,
            sgstPercent: item.sgstPercent,
            cgstPercent: item.cgstPercent,
          });
          this.items.push(newFormGroup);
          const pName = typeof item.product === 'string' ? item.product : (item.product?.name || 'Pharma Item');
          searchTerms.push(pName);
        });
      } else {
        this.addItem();
        alert('No product line items were detected in the bill. Please check the image or add the items manually.');
      }
      this.productSearchTerms.set(searchTerms);
      this.autoSyncTotal = false;
      this.recalculateTotals();
    } catch (err) {
      console.error('Error rotating bill:', err);
      alert('Could not rotate image. Please try again.');
    } finally {
      this.isProcessingBill.set(false);
      this.cdr.markForCheck();
      this.cdr.detectChanges();
    }
  }

  private async parseInvoiceWithJS(file: File, base64Url: string): Promise<{
    supplier: string;
    supplierInvoiceNumber: string;
    purchaseDate: string;
    finalBillAmount: number;
    cgst: number;
    sgst: number;
    totalTax: number;
    items: {
      hsnCode: string;
      product: any;
      oldMrp: number;
      pack: string;
      batchNo: string;
      expDate: string;
      mrp: number;
      quantity: number;
      freeQty: number;
      costPrice: number;
      discountPercent: number;
      gstPercent: number;
      sgstPercent: number;
      cgstPercent: number;
    }[];
  }> {
    let extractedData: any = null;
    let fallbackToJS = false;

    try {
      const sessionToken = this.supabaseService.currentSession()?.access_token || this.supabaseService.anonKey();
      const anonKey = this.supabaseService.anonKey();
      const reqHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionToken) reqHeaders['Authorization'] = `Bearer ${sessionToken}`;
      if (anonKey) reqHeaders['apikey'] = anonKey;

      const apiResponse = await fetch('/api/parse-invoice', {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({ image: base64Url })
      });

      if (!apiResponse.ok) {
        throw new Error(`Server returned status ${apiResponse.status}`);
      }

      extractedData = await apiResponse.json();
      console.log('Successfully extracted structured data via server-side Gemini:', extractedData);
    } catch (apiError) {
      console.warn('Gemini server OCR failed, falling back to local client-side OCR:', apiError);
      fallbackToJS = true;
    }

    if (fallbackToJS || !extractedData || !extractedData.rows || extractedData.rows.length === 0) {
      extractedData = await convertImageToTableJS(file);
    }

    const subtotal = Number(extractedData.subtotal) || 0;
    const globalDiscount = Number(extractedData.discount) || 0;
    const extractedRows = [
      extractedData.rows,
      extractedData.items,
      extractedData.lineItems,
      extractedData.line_items
    ].find(Array.isArray) || [];
    const readValue = (row: any, ...keys: string[]) =>
      keys.map(key => row?.[key]).find(value => value !== undefined && value !== null && value !== '');
    const readText = (row: any, ...keys: string[]) => String(readValue(row, ...keys) ?? '').trim();
    const readNumber = (row: any, fallback: number, ...keys: string[]) => {
      const value = readValue(row, ...keys);
      if (value === undefined) return fallback;
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    };
    const rows = extractedRows.filter((row: any) =>
      readText(row, 'itemDescription', 'description', 'name', 'productName', 'product_name', 'itemName', 'item_name', 'medicineName').length > 0
    );
    const items = rows.map((row: any) => {
      const rowName = readText(row, 'itemDescription', 'description', 'name', 'productName', 'product_name', 'itemName', 'item_name', 'medicineName');
      const quantity = readNumber(row, 0, 'quantity', 'qty', 'billedQuantity', 'billed_quantity');
      const rowAmount = readNumber(row, 0, 'amount', 'lineAmount', 'line_amount', 'netAmount', 'net_amount', 'total');
      const rateKeys = ['rate', 'costPrice', 'cost_price', 'unitRate', 'unit_rate', 'purchaseRate', 'purchase_rate'];
      const rateValue = readValue(row, ...rateKeys);
      const rateVal = rateValue !== undefined
        ? readNumber(row, 0, ...rateKeys)
        : (quantity > 0 && rowAmount > 0 ? rowAmount / quantity : 0);
      const mrpVal = readNumber(row, 0, 'mrp', 'maximumRetailPrice', 'maximum_retail_price');
      const oldMrpVal = readNumber(row, 0, 'oldMrp', 'oldMRP', 'old_mrp', 'previousMrp', 'previous_mrp');
      const hsnCode = readText(row, 'hsnCode', 'hsn', 'hsn_code');

      const suppliedSku = readText(row, 'sku');
      const cleanRowSku = suppliedSku && !['EXTRACTED', 'MANUAL', 'N/A'].includes(suppliedSku.toUpperCase())
        ? suppliedSku
        : hsnCode ? `HSN-${hsnCode}` : `OCR-${Date.now().toString().slice(-6)}`;

      const productObj = {
        id: `extracted-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: rowName,
        sku: cleanRowSku,
        purchasePrice: rateVal,
        quantity: 0
      };

      const rowDiscount = readNumber(row, 0, 'discountPercent', 'discount_percent', 'discountRate', 'discount_rate');
      const totalGstPercent = readNumber(row, 0, 'gstPercent', 'taxPercent', 'gst_percent', 'tax_percent');
      const cgstKeys = ['cgstPercent', 'cgstRate', 'cgst_percent', 'cgst_rate'];
      const sgstKeys = ['sgstPercent', 'sgstRate', 'sgst_percent', 'sgst_rate'];
      const hasCgst = readValue(row, ...cgstKeys) !== undefined;
      const hasSgst = readValue(row, ...sgstKeys) !== undefined;
      const cgstPercent = hasCgst ? readNumber(row, 0, ...cgstKeys) : totalGstPercent / 2;
      const sgstPercent = hasSgst
        ? readNumber(row, 0, ...sgstKeys)
        : Math.max(0, totalGstPercent - cgstPercent);

      return {
        hsnCode,
        product: productObj,
        oldMrp: oldMrpVal,
        pack: readText(row, 'pack', 'packSize', 'pack_size'),
        batchNo: readText(row, 'batchNo', 'batch', 'batchNumber', 'batch_number'),
        expDate: readText(row, 'expDate', 'expiryDate', 'expiry', 'exp_date', 'expiry_date'),
        mrp: mrpVal,
        quantity,
        freeQty: readNumber(row, 0, 'freeQty', 'freeQuantity', 'free_qty', 'free_quantity'),
        costPrice: rateVal,
        discountPercent: rowDiscount,
        gstPercent: totalGstPercent || cgstPercent + sgstPercent,
        sgstPercent,
        cgstPercent
      };
    });

    const totalTax = extractedData.tax !== undefined ? extractedData.tax : 0;
    const cgst = Math.round((totalTax / 2) * 100) / 100;
    const sgst = Math.round((totalTax / 2) * 100) / 100;

    let safeDate = new Date().toISOString().split('T')[0];
    try {
      if (extractedData.date) {
        const d = new Date(extractedData.date);
        if (!isNaN(d.getTime())) {
          safeDate = d.toISOString().split('T')[0];
        }
      }
    } catch (e) {}

    return {
      supplier: extractedData.supplierName || '',
      supplierInvoiceNumber: extractedData.invoiceNumber || '',
      purchaseDate: safeDate,
      finalBillAmount: extractedData.totalAmount || (subtotal + totalTax - globalDiscount),
      cgst,
      sgst,
      totalTax,
      items
    };
  }
}
