import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Challan } from '../../models/challan.model';
import { Product } from '../../models/product.model';
import { ChallanService } from '../../services/challan.service';
import { ProductService } from '../../services/product.service';
import { PurchaseService } from '../../services/purchase.service';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { ChallansComponent } from './challans.component';

describe('ChallansComponent', () => {
  let component: ChallansComponent;
  let challanService: { challans: ReturnType<typeof signal<Challan[]>>; getNextChallanNumber: ReturnType<typeof vi.fn>; fetchChallans: ReturnType<typeof vi.fn>; addChallan: ReturnType<typeof vi.fn>; updateChallan: ReturnType<typeof vi.fn>; deleteChallan: ReturnType<typeof vi.fn> };
  let products: ReturnType<typeof signal<Product[]>>;
  let productService: { products: typeof products; fetchProductsFromApi: ReturnType<typeof vi.fn> };
  let purchaseService: { procurementItems: ReturnType<typeof signal<any[]>>; purchases: ReturnType<typeof signal<never[]>>; extractProcurementItemsFromPurchases: ReturnType<typeof vi.fn>; fetchPurchasesFromApi: ReturnType<typeof vi.fn> };
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    products = signal<Product[]>([{
      id: 'p1', name: 'Bandage', category: 'Medical', sku: 'B-1', size: 'Free Size', color: '',
      purchasePrice: 5, sellingPrice: 20, discountPercent: 10, quantity: 8, minStockAlert: 2, imageUrls: []
    }]);
    productService = { products, fetchProductsFromApi: vi.fn() };
    purchaseService = {
      procurementItems: signal<any[]>([{
        id: 'proc1', productId: 'p1', productName: 'Bandage', sku: 'B-1', quantity: 10,
        freeQty: 0, costPrice: 5, supplier: 'North Medical', purchaseDate: new Date('2026-01-01'),
        batchNo: 'A-1'
      }]),
      purchases: signal<never[]>([]),
      extractProcurementItemsFromPurchases: vi.fn(() => []),
      fetchPurchasesFromApi: vi.fn()
    };
    toastService = { success: vi.fn(), error: vi.fn() };
    challanService = {
      challans: signal<Challan[]>([]),
      getNextChallanNumber: vi.fn(() => 'CH-001'),
      fetchChallans: vi.fn().mockResolvedValue(undefined),
      addChallan: vi.fn().mockResolvedValue(undefined),
      updateChallan: vi.fn().mockResolvedValue(undefined),
      deleteChallan: vi.fn().mockResolvedValue(undefined)
    };
    TestBed.configureTestingModule({
      imports: [ChallansComponent],
      providers: [
        FormBuilder,
        { provide: ChallanService, useValue: challanService },
        { provide: ProductService, useValue: productService },
        { provide: PurchaseService, useValue: purchaseService },
        { provide: TranslationService, useValue: {} },
        { provide: ToastService, useValue: toastService }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).overrideComponent(ChallansComponent, { set: { template: '' } });
    component = TestBed.createComponent(ChallansComponent).componentInstance;
  });

  it('calculates discounted GST totals and clamps payment to the invoice total', () => {
    const row = component.items.at(0);
    row.patchValue({ productName: 'Gloves', quantity: 2, rate: 50, discountPercent: 10, gstPercent: 5 });
    component.addBlankItemRow();

    expect(component.subtotalAmount()).toBe(100);
    expect(component.cashDiscountAmount()).toBe(10);
    expect(component.gstAmount()).toBe(4.5);
    expect(component.totalAmount()).toBe(94.5);
    component.challanForm.get('paidAmount')?.setValue(200);
    component.onPaidAmountChange();
    expect(component.paidAmount()).toBe(94.5);
    expect(component.dueAmount()).toBe(0);
    expect(component.getArticleCount()).toBe(2);
  });

  it('validates before saving and submits a new challan when the form is complete', async () => {
    await component.submitChallan();
    expect(challanService.addChallan).not.toHaveBeenCalled();

    component.openAddModal();
    component.challanForm.patchValue({ customerName: 'Asha', status: 'Open', paidAmount: 0 });
    component.items.at(0).patchValue({ productName: 'Bandage', quantity: 1, rate: 20, gstPercent: 5 });
    await component.submitChallan();

    expect(challanService.addChallan).toHaveBeenCalledOnce();
    expect(challanService.addChallan.mock.calls[0][0].totalAmount).toBe(21);
    expect(component.showModal()).toBe(false);
  });

  it('opens and updates existing challans and exercises search and sort controls', async () => {
    const existing: Challan = {
      id: 'ch-1', challanNumber: 'CH-001', customerName: 'Asha', customerPhone: '555',
      date: '2026-01-01', dueDate: '2026-01-15', status: 'Open', notes: '',
      items: [{ id: 'line-1', productName: 'Bandage', hsnCode: '', oldMrp: 0, quantity: 2, batchNo: '', expDate: '', mrp: 20, rate: 20, discountPercent: 0, gstPercent: 0, unit: 'pcs', amount: 40 }],
      totalAmount: 40, paidAmount: 10, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z'
    };
    challanService.challans.set([existing]);
    component.openEditModal(existing);
    expect(component.editingChallan()).toBe(existing);
    expect(component.items.length).toBe(1);
    expect(component.paidAmount()).toBe(10);
    component.challanForm.patchValue({ customerName: 'Asha Updated' });
    await component.submitChallan();
    expect(challanService.updateChallan).toHaveBeenCalledWith(expect.objectContaining({
      id: 'ch-1', customerName: 'Asha Updated', totalAmount: 40
    }));
    expect(component.showModal()).toBe(false);

    component.searchTerm.set('CH-001');
    expect(component.filteredChallans()).toHaveLength(1);
    component.searchTerm.set('555');
    expect(component.filteredChallans()).toHaveLength(1);
    component.searchTerm.set('Asha');
    expect(component.filteredChallans()).toHaveLength(1);
    component.searchTerm.set('bandage');
    expect(component.filteredChallans()).toHaveLength(1);
    component.searchTerm.set('absent');
    expect(component.filteredChallans()).toHaveLength(0);
    component.toggleSort('customer');
    expect(component.sortDirection()).toBe('asc');
    expect(component.getSortIcon('customer')).toBe('arrow_upward');
    component.currentPage.set(2);
    component.onPageSizeChange(5);
    expect(component.currentPage()).toBe(1);
    component.setPaymentPreset('zero');
    expect(component.paidAmount()).toBe(0);
    component.challanForm.get('paidAmount')?.setValue(-5);
    component.onPaidAmountChange();
    expect(component.paidAmount()).toBe(0);
  });

  it('loads services, filters inventory catalog rows, and supports catalog add/cancel flows', () => {
    component.ngOnInit();
    expect(challanService.fetchChallans).toHaveBeenCalledOnce();
    expect(productService.fetchProductsFromApi).toHaveBeenCalledOnce();
    expect(purchaseService.fetchPurchasesFromApi).toHaveBeenCalledOnce();

    const entry = component.inventoryCatalogEntries()[0];
    expect(component.inventoryCatalogCategories()).toEqual(['All', 'Medical']);
    component.catalogCategoryFilter.set('Medical');
    component.catalogSearchTerm.set('b-1');
    expect(component.filteredCatalogProducts()).toHaveLength(1);
    component.catalogSearchTerm.set('A-1');
    expect(component.filteredCatalogProducts()).toHaveLength(1);
    component.setCatalogSearchTerm({ target: { value: 'missing' } } as unknown as Event);
    expect(component.filteredCatalogProducts()).toHaveLength(0);

    component.addItemRow();
    expect(component.showCatalogMultiSelect()).toBe(true);
    component.toggleCatalogProduct(entry.inventoryKey);
    expect(component.selectedCatalogProductCount()).toBe(1);
    component.addSelectedCatalogProducts();
    expect(component.items.at(0).get('productName')?.value).toBe('Bandage');
    expect(component.showCatalogMultiSelect()).toBe(false);
    expect(component.subtotalAmount()).toBe(20);

    component.openCatalogMultiSelect();
    expect(component.selectedCatalogProductIds().has(entry.inventoryKey)).toBe(true);
    component.toggleCatalogProduct(entry.inventoryKey);
    component.addSelectedCatalogProducts();
    expect(component.items.length).toBe(1);
    component.openCatalogMultiSelect();
    component.cancelCatalogMultiSelect();
    expect(component.selectedCatalogProductIds().size).toBe(0);
  });

  it('covers challan pagination, payment presets, removal rules, and sorting choices', () => {
    const second: Challan = {
      id: 'ch-2', challanNumber: 'CH-002', customerName: 'Zara', customerPhone: '777',
      date: '2026-02-01', dueDate: '2026-02-15', status: 'Closed', notes: '',
      items: [{ id: 'line-2', productName: 'Gauze', hsnCode: '', oldMrp: 0, quantity: 1, batchNo: '', expDate: '', mrp: 50, rate: 50, discountPercent: 0, gstPercent: 0, unit: 'pcs', amount: 50 }],
      totalAmount: 50, paidAmount: 50, createdAt: '2026-02-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z'
    };
    const first: Challan = {
      id: 'ch-1', challanNumber: 'CH-001', customerName: 'Asha', customerPhone: '555',
      date: '2026-01-01', dueDate: '2026-01-15', status: 'Open', notes: '',
      items: [{ id: 'line-1', productName: 'Bandage', hsnCode: '', oldMrp: 0, quantity: 1, batchNo: '', expDate: '', mrp: 20, rate: 20, discountPercent: 0, gstPercent: 0, unit: 'pcs', amount: 20 }],
      totalAmount: 20, paidAmount: 0, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z'
    };
    challanService.challans.set([first, second]);
    expect(component.totalPages()).toBe(1);
    expect(component.startItemIndex()).toBe(1);
    expect(component.endItemIndex()).toBe(2);
    component.searchTerm.set('no results');
    expect(component.startItemIndex()).toBe(0);
    expect(component.endItemIndex()).toBe(0);
    component.onSearch({ target: { value: 'Asha' } } as unknown as Event);
    expect(component.currentPage()).toBe(1);
    expect(component.filteredChallans()).toHaveLength(1);

    for (const field of ['date', 'customer', 'total', 'status'] as const) {
      component.sortBy.set(field);
      component.sortDirection.set('desc');
      component.toggleSort(field);
      expect(component.sortDirection()).toBe('asc');
      component.toggleSort(field);
      expect(component.sortDirection()).toBe('desc');
    }
    component.toggleSort('customer');
    expect(component.sortDirection()).toBe('asc');
    expect(component.getSortIcon('date')).toBe('unfold_more');
    component.searchTerm.set('');
    component.pageSize.set(1);
    component.goToPage(2);
    expect(component.currentPage()).toBe(2);
    component.goToPage(3);
    expect(component.currentPage()).toBe(2);
    component.onPageSizeChange(2);
    expect(component.currentPage()).toBe(1);

    component.openAddModal();
    component.setPaymentPreset('full');
    expect(component.paidAmount()).toBe(0);
    component.removeItemRow(0);
    expect(component.items.length).toBe(1);
  });

  it('reports load, save, and delete failures and confirms challan deletion', async () => {
    challanService.fetchChallans.mockRejectedValueOnce('network');
    component.ngOnInit();
    await Promise.resolve();
    expect(component.errorMessage()).toBe('Failed to load challans.');

    component.openAddModal();
    component.challanForm.patchValue({ customerName: 'Asha', status: 'Open' });
    component.items.at(0).patchValue({ productName: 'Bandage', quantity: 1, rate: 20 });
    challanService.addChallan.mockRejectedValueOnce(new Error('write failed'));
    await component.submitChallan();
    expect(component.errorMessage()).toBe('write failed');

    const target = { id: 'ch-1', challanNumber: 'CH-001', customerName: 'Asha' } as Challan;
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
    await component.deleteChallan(target);
    expect(challanService.deleteChallan).not.toHaveBeenCalled();

    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    challanService.deleteChallan.mockRejectedValueOnce('delete failed');
    await component.deleteChallan(target);
    expect(component.errorMessage()).toBe('Failed to delete challan.');
    challanService.deleteChallan.mockResolvedValue(undefined);
    await component.deleteChallan(target);
    expect(toastService.success).toHaveBeenCalledWith('Challan CH-001 deleted.');
  });
});
