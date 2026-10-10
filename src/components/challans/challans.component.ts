import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Challan, ChallanItem } from '../../models/challan.model';
import { ChallanService } from '../../services/challan.service';
import { ProductService } from '../../services/product.service';
import { PurchaseService } from '../../services/purchase.service';
import { TranslationService } from '../../services/translation.service';
import { InventoryListItem, buildInventoryListItems } from '../../utils/inventory-list';
import { Product } from '../../models/product.model';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-challans',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CurrencyPipe, DatePipe],
  templateUrl: './challans.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChallansComponent implements OnInit {
  private fb = inject(FormBuilder);
  challanService = inject(ChallanService);
  productService = inject(ProductService);
  purchaseService = inject(PurchaseService);
  ts = inject(TranslationService);
  private toastService = inject(ToastService);

  showModal = signal(false);
  showCatalogMultiSelect = signal(false);
  errorMessage = signal<string | null>(null);
  catalogSearchTerm = signal('');
  catalogCategoryFilter = signal('All');
  selectedCatalogProductIds = signal<Set<string>>(new Set());
  editingChallan = signal<Challan | null>(null);
  searchTerm = signal('');
  currentPage = signal(1);
  pageSize = signal(10);
  sortBy = signal<'date' | 'customer' | 'total' | 'status'>('date');
  sortDirection = signal<'asc' | 'desc'>('desc');
  subtotalAmount = signal(0);
  cashDiscountAmount = signal(0);
  gstAmount = signal(0);
  paidAmount = signal(0);
  totalAmount = signal(0);
  dueAmount = computed(() => Math.max(0, this.totalAmount() - this.paidAmount()));

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
  selectedCatalogProductCount = computed(() => this.inventoryCatalogEntries()
    .filter(item => this.selectedCatalogProductIds().has(item.inventoryKey)).length);

  challanForm = this.fb.group({
    id: [''],
    challanNumber: ['', Validators.required],
    customerName: ['', Validators.required],
    customerPhone: [''],
    date: [new Date().toISOString().split('T')[0], Validators.required],
    dueDate: [new Date().toISOString().split('T')[0], Validators.required],
    status: ['Open', Validators.required],
    notes: [''],
    paidAmount: [0, [Validators.required, Validators.min(0)]],
    items: this.fb.array([this.createItemRow()], Validators.required)
  });

  get items(): FormArray {
    return this.challanForm.get('items') as FormArray;
  }

  ngOnInit(): void {
    void this.challanService.fetchChallans().catch(error => {
      this.errorMessage.set(error instanceof Error ? error.message : 'Failed to load challans.');
    });
    void this.productService.fetchProductsFromApi();
    void this.purchaseService.fetchPurchasesFromApi();
  }

  filteredChallans = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const sortField = this.sortBy();
    const direction = this.sortDirection();
    let list = [...this.challanService.challans()];

    if (term) {
      list = list.filter(challan =>
        challan.challanNumber.toLowerCase().includes(term) ||
        challan.customerName.toLowerCase().includes(term) ||
        (challan.customerPhone || '').toLowerCase().includes(term) ||
        challan.items.some(item => item.productName.toLowerCase().includes(term))
      );
    }

    list.sort((a, b) => {
      let comparison = 0;

      if (sortField === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortField === 'customer') {
        comparison = a.customerName.localeCompare(b.customerName);
      } else if (sortField === 'total') {
        comparison = a.totalAmount - b.totalAmount;
      } else if (sortField === 'status') {
        comparison = a.status.localeCompare(b.status);
      }

      return direction === 'asc' ? comparison : -comparison;
    });

    return list;
  });

  paginatedChallans = computed(() => {
    const list = this.filteredChallans();
    const start = (this.currentPage() - 1) * this.pageSize();
    return list.slice(start, start + this.pageSize());
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredChallans().length / this.pageSize())));

  startItemIndex = computed(() => {
    if (this.filteredChallans().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  endItemIndex = computed(() => {
    const total = this.filteredChallans().length;
    return Math.min(this.currentPage() * this.pageSize(), total);
  });

  static makeId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private static calculateLineAmount(quantity: number, rate: number, discountPercent = 0, gstPercent = 0): number {
    const gross = Number(quantity || 0) * Number(rate || 0);
    const discount = gross * Math.min(100, Math.max(0, Number(discountPercent) || 0)) / 100;
    const taxable = gross - discount;
    const tax = taxable * Math.min(100, Math.max(0, Number(gstPercent) || 0)) / 100;
    return Number((taxable + tax).toFixed(2));
  }

  createItemRow(item?: Partial<ChallanItem>): FormGroup {
    const quantity = Number(item?.quantity ?? 1);
    const rate = Number(item?.rate ?? 0);

    return this.fb.group({
      id: [item?.id ?? ChallansComponent.makeId('line')],
      hsnCode: [item?.hsnCode ?? ''],
      productName: [item?.productName ?? '', Validators.required],
      oldMrp: [Number(item?.oldMrp ?? 0), [Validators.min(0)]],
      quantity: [quantity, [Validators.required, Validators.min(1)]],
      batchNo: [item?.batchNo ?? ''],
      expDate: [item?.expDate ?? ''],
      mrp: [Number(item?.mrp ?? 0), [Validators.min(0)]],
      rate: [rate, [Validators.required, Validators.min(0)]],
      discountPercent: [Number(item?.discountPercent ?? 0), [Validators.min(0), Validators.max(100)]],
      gstPercent: [Number(item?.gstPercent ?? 0), [Validators.min(0), Validators.max(100)]],
      unit: [item?.unit ?? 'pcs'],
      amount: [item?.amount ?? ChallansComponent.calculateLineAmount(quantity, rate, Number(item?.discountPercent ?? 0), Number(item?.gstPercent ?? 0))]
    });
  }

  addItemRow(): void {
    this.openCatalogMultiSelect();
  }

  addBlankItemRow(): void {
    this.items.push(this.createItemRow());
    this.recalculateTotal();
  }

  filteredCatalogProducts(): InventoryListItem[] {
    const term = this.catalogSearchTerm().trim().toLowerCase();
    const category = this.catalogCategoryFilter();
    return this.inventoryCatalogEntries().filter(entry => {
      const product = entry.catalogProduct;
      const matchesCategory = category === 'All' || product.category === category;
      const matchesTerm = !term ||
        product.name.toLowerCase().includes(term) ||
        (product.sku || '').toLowerCase().includes(term) ||
        String(entry.batchNo || entry.batch_no || '').toLowerCase().includes(term);
      return matchesCategory && matchesTerm;
    });
  }

  openCatalogMultiSelect(): void {
    this.catalogSearchTerm.set('');
    this.catalogCategoryFilter.set('All');
    const existingItems = this.items.getRawValue() as ChallanItem[];
    const selectedIds = this.inventoryCatalogEntries()
      .filter(entry => existingItems.some(item => this.matchesCatalogEntry(item, entry)))
      .map(entry => entry.inventoryKey);
    this.selectedCatalogProductIds.set(new Set(selectedIds));
    this.showCatalogMultiSelect.set(true);
  }

  private matchesCatalogEntry(item: Partial<ChallanItem>, entry: InventoryListItem): boolean {
    const itemName = String(item.productName || '').trim().toLowerCase();
    const entryName = String(entry.catalogProduct.name || entry.productName || entry.product_name || '').trim().toLowerCase();
    const itemBatch = String(item.batchNo || '').trim().toLowerCase();
    const entryBatch = String(entry.batchNo || entry.batch_no || '').trim().toLowerCase();
    return itemName.length > 0 && itemName === entryName && itemBatch === entryBatch;
  }

  setCatalogSearchTerm(event: Event): void {
    this.catalogSearchTerm.set((event.target as HTMLInputElement).value);
  }

  cancelCatalogMultiSelect(): void {
    this.showCatalogMultiSelect.set(false);
    this.selectedCatalogProductIds.set(new Set());
    this.catalogSearchTerm.set('');
    this.catalogCategoryFilter.set('All');
  }

  toggleCatalogProduct(inventoryKey: string): void {
    this.selectedCatalogProductIds.update(selected => {
      const next = new Set(selected);
      if (next.has(inventoryKey)) next.delete(inventoryKey);
      else next.add(inventoryKey);
      return next;
    });
  }

  addSelectedCatalogProducts(): void {
    const selectedIds = this.selectedCatalogProductIds();
    const existingItems = this.items.getRawValue() as ChallanItem[];
    const selectedEntries = this.inventoryCatalogEntries()
      .filter(entry => selectedIds.has(entry.inventoryKey));
    const newEntries = selectedEntries.filter(entry =>
      !existingItems.some(item => this.matchesCatalogEntry(item, entry))
    );
    if (newEntries.length === 0) {
      this.cancelCatalogMultiSelect();
      return;
    }

    const emptyRows = this.items.controls
      .map((control, index) => ({ control, index }))
      .filter(({ control }) => !String(control.get('productName')?.value || '').trim());

    newEntries.forEach((entry, entryIndex) => {
      const product: Product = entry.catalogProduct;
      const rate = Number(product.sellingPrice || entry.mrp || entry.costPrice || 0);
      const itemData = {
        hsnCode: String(entry.hsnCode || entry.hsn_code || ''),
        productName: product.name,
        oldMrp: Number(entry.oldMrp || entry.mrp || product.sellingPrice || 0),
        quantity: 1,
        batchNo: String(entry.batchNo || entry.batch_no || ''),
        expDate: String(entry.expDate || entry.exp_date || ''),
        mrp: Number(entry.mrp || product.sellingPrice || 0),
        rate,
        discountPercent: Number(product.discountPercent || 0),
        gstPercent: 0,
        unit: 'pcs'
      };
      const emptyRow = emptyRows[entryIndex];
      if (emptyRow) {
        emptyRow.control.patchValue(itemData);
        this.syncLineAmount(emptyRow.index);
      } else {
        const newRow = this.createItemRow(itemData);
        this.items.push(newRow);
      }
    });

    this.cancelCatalogMultiSelect();
    this.recalculateTotal();
  }

  removeItemRow(index: number): void {
    if (this.items.length > 1) {
      this.items.removeAt(index);
      this.recalculateTotal();
    }
  }

  syncLineAmount(index: number): void {
    const row = this.items.at(index) as FormGroup;
    const quantity = Number(row.get('quantity')?.value || 0);
    const rate = Number(row.get('rate')?.value || 0);
    const discountPercent = Number(row.get('discountPercent')?.value || 0);
    const gstPercent = Number(row.get('gstPercent')?.value || 0);
    row.patchValue({ amount: ChallansComponent.calculateLineAmount(quantity, rate, discountPercent, gstPercent) }, { emitEvent: false });
    this.recalculateTotal();
  }

  getItemCount(): number {
    return (this.items.getRawValue() as ChallanItem[]).filter(item => String(item.productName || '').trim().length > 0).length;
  }

  getArticleCount(): number {
    return (this.items.getRawValue() as ChallanItem[])
      .filter(item => String(item.productName || '').trim().length > 0)
      .reduce((count, item) => count + (Number(item.quantity) || 0), 0);
  }

  private recalculateTotal(): void {
    const rows = (this.items.getRawValue() as ChallanItem[])
      .filter(item => String(item.productName || '').trim().length > 0);
    let subtotal = 0;
    let discount = 0;
    let gst = 0;
    let total = 0;

    for (const item of rows) {
      const gross = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
      const discountPercent = Math.min(100, Math.max(0, Number(item.discountPercent) || 0));
      const gstPercent = Math.min(100, Math.max(0, Number(item.gstPercent) || 0));
      const lineDiscount = gross * discountPercent / 100;
      const taxable = gross - lineDiscount;
      const lineGst = taxable * gstPercent / 100;

      subtotal += gross;
      discount += lineDiscount;
      gst += lineGst;
      total += taxable + lineGst;
    }

    this.subtotalAmount.set(Number(subtotal.toFixed(2)));
    this.cashDiscountAmount.set(Number(discount.toFixed(2)));
    this.gstAmount.set(Number(gst.toFixed(2)));
    this.totalAmount.set(Number(total.toFixed(2)));
    this.onPaidAmountChange();
  }

  onPaidAmountChange(): void {
    const enteredAmount = Number(this.challanForm.get('paidAmount')?.value) || 0;
    const amount = Math.min(Math.max(0, enteredAmount), this.totalAmount());
    this.paidAmount.set(amount);
    if (amount !== enteredAmount) {
      this.challanForm.get('paidAmount')?.setValue(amount, { emitEvent: false });
    }
  }

  setPaymentPreset(type: 'full' | 'zero'): void {
    const amount = type === 'full' ? this.totalAmount() : 0;
    this.challanForm.patchValue({ paidAmount: amount });
    this.paidAmount.set(amount);
  }

  openAddModal(): void {
    this.errorMessage.set(null);
    this.editingChallan.set(null);
    this.challanForm.reset({
      id: '',
      challanNumber: this.challanService.getNextChallanNumber(),
      customerName: '',
      customerPhone: '',
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0],
      status: 'Open',
      notes: '',
      paidAmount: 0,
      items: []
    });

    this.items.clear();
    this.items.push(this.createItemRow());
    this.paidAmount.set(0);
    this.recalculateTotal();
    this.showModal.set(true);
  }

  openEditModal(challan: Challan): void {
    this.errorMessage.set(null);
    this.editingChallan.set(challan);
    this.challanForm.reset({
      id: challan.id,
      challanNumber: challan.challanNumber,
      customerName: challan.customerName,
      customerPhone: challan.customerPhone || '',
      date: new Date(challan.date).toISOString().split('T')[0],
      dueDate: new Date(challan.dueDate).toISOString().split('T')[0],
      status: challan.status,
      notes: challan.notes || '',
      paidAmount: challan.paidAmount ?? 0,
      items: []
    });

    this.items.clear();
    challan.items.forEach(item => this.items.push(this.createItemRow(item)));
    if (this.items.length === 0) {
      this.items.push(this.createItemRow());
    }
    this.paidAmount.set(challan.paidAmount ?? 0);
    this.recalculateTotal();
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editingChallan.set(null);
    this.challanForm.reset({
      id: '',
      challanNumber: this.challanService.getNextChallanNumber(),
      customerName: '',
      customerPhone: '',
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0],
      status: 'Open',
      notes: '',
      paidAmount: 0,
      items: []
    });
    this.items.clear();
    this.items.push(this.createItemRow());
    this.paidAmount.set(0);
    this.recalculateTotal();
  }

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    this.currentPage.set(1);
  }

  onPageSizeChange(value: number): void {
    this.pageSize.set(Number(value));
    this.currentPage.set(1);
  }

  toggleSort(field: 'date' | 'customer' | 'total' | 'status'): void {
    if (this.sortBy() === field) {
      this.sortDirection.update(dir => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortBy.set(field);
      this.sortDirection.set(field === 'customer' || field === 'status' ? 'asc' : 'desc');
    }
  }

  getSortIcon(field: 'date' | 'customer' | 'total' | 'status'): string {
    return this.sortBy() === field
      ? (this.sortDirection() === 'asc' ? 'arrow_upward' : 'arrow_downward')
      : 'unfold_more';
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  async deleteChallan(challan: Challan): Promise<void> {
    const confirmed = window.confirm(`Delete challan ${challan.challanNumber} for ${challan.customerName}?`);
    if (!confirmed) return;
    this.errorMessage.set(null);
    try {
      await this.challanService.deleteChallan(challan.id);
      this.toastService.success(`Challan ${challan.challanNumber} deleted.`);
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Failed to delete challan.');
    }
  }

  async submitChallan(): Promise<void> {
    if (this.challanForm.invalid) {
      this.challanForm.markAllAsTouched();
      return;
    }
    this.errorMessage.set(null);

    const formValue = this.challanForm.getRawValue();
    const items: ChallanItem[] = (formValue.items as any[])
      .map((item, index) => {
        const productName = String(item.productName || '').trim();
        const quantity = Number(item.quantity || 0);
        const rate = Number(item.rate || 0);
        const discountPercent = Math.min(100, Math.max(0, Number(item.discountPercent) || 0));
        const gstPercent = Math.min(100, Math.max(0, Number(item.gstPercent) || 0));
        return {
          id: item.id || `line-${index}-${Date.now()}`,
          hsnCode: String(item.hsnCode || '').trim(),
          productName,
          oldMrp: Number(item.oldMrp) || 0,
          quantity,
          batchNo: String(item.batchNo || '').trim(),
          expDate: String(item.expDate || '').trim(),
          mrp: Number(item.mrp) || 0,
          rate,
          discountPercent,
          gstPercent,
          unit: item.unit || 'pcs',
          amount: ChallansComponent.calculateLineAmount(
            quantity * rate * (1 - discountPercent / 100),
            1,
            0,
            gstPercent
          )
        };
      })
      .filter(item => item.productName.length > 0);

    if (items.length === 0) {
      return;
    }

    this.recalculateTotal();
    const totalAmount = this.totalAmount();
    const paidAmount = Math.min(
      Math.max(0, Number(formValue.paidAmount) || 0),
      totalAmount
    );
    const payload: Challan = {
      id: formValue.id || `challan-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      challanNumber: formValue.challanNumber || this.challanService.getNextChallanNumber(),
      customerName: String(formValue.customerName || '').trim(),
      customerPhone: String(formValue.customerPhone || '').trim(),
      date: formValue.date,
      dueDate: formValue.dueDate,
      status: formValue.status as Challan['status'],
      notes: formValue.notes || '',
      items,
      totalAmount,
      paidAmount,
      createdAt: this.editingChallan()?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      if (this.editingChallan()) {
        await this.challanService.updateChallan(payload);
        this.toastService.success(`Challan ${payload.challanNumber} updated.`);
      } else {
        await this.challanService.addChallan(payload);
        this.toastService.success(`Challan ${payload.challanNumber} created.`);
      }
      this.closeModal();
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Failed to save challan.');
    }
  }
}
