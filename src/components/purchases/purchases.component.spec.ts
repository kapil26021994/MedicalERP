import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Purchase } from '../../models/purchase.model';
import { Product } from '../../models/product.model';
import { PurchaseService } from '../../services/purchase.service';
import { ProductService } from '../../services/product.service';
import { TranslationService } from '../../services/translation.service';
import { SupabaseService } from '../../services/supabase.service';
import { ConfirmationService } from '../../services/confirmation.service';
import { ToastService } from '../../services/toast.service';
import { PurchasesComponent } from './purchases.component';

const purchases: Purchase[] = [
  {
    id: 'p1', supplier: 'North Medical', supplierInvoiceNumber: 'N-100', purchaseDate: new Date('2026-01-01'),
    items: [{ product: { id: 'item1', name: 'Bandage' }, quantity: 2, costPrice: 5 }], finalBillAmount: 20, dueAmount: 5
  },
  {
    id: 'p2', supplier: 'South Supplies', supplierInvoiceNumber: 'S-200', purchaseDate: new Date('2026-02-01'),
    items: [{ product: { id: 'item2', name: 'Gloves' }, quantity: 3, costPrice: 4 }], finalBillAmount: 30, dueAmount: 0
  }
];

describe('PurchasesComponent', () => {
  let component: PurchasesComponent;
  let purchaseService: {
    purchases: ReturnType<typeof signal<Purchase[]>>;
    procurementItems: ReturnType<typeof signal<never[]>>;
    extractProcurementItemsFromPurchases: ReturnType<typeof vi.fn>;
    addPurchase: ReturnType<typeof vi.fn>;
    updatePurchase: ReturnType<typeof vi.fn>;
    deletePurchase: ReturnType<typeof vi.fn>;
    deleteAllPurchases: ReturnType<typeof vi.fn>;
  };
  let productService: { products: ReturnType<typeof signal<Product[]>> };
  let confirmation: { confirm: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let supabaseService: { currentSession: ReturnType<typeof vi.fn>; anonKey: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    productService = { products: signal<Product[]>([]) };
    purchaseService = {
      purchases: signal(purchases), procurementItems: signal<never[]>([]),
      extractProcurementItemsFromPurchases: vi.fn(() => []),
      addPurchase: vi.fn().mockResolvedValue(undefined),
      updatePurchase: vi.fn().mockResolvedValue(undefined),
      deletePurchase: vi.fn().mockResolvedValue(undefined),
      deleteAllPurchases: vi.fn().mockResolvedValue(undefined)
    };
    confirmation = { confirm: vi.fn().mockResolvedValue(false) };
    toast = { success: vi.fn(), error: vi.fn() };
    supabaseService = { currentSession: vi.fn(() => null), anonKey: vi.fn(() => 'public-key') };
    TestBed.configureTestingModule({
      imports: [PurchasesComponent],
      providers: [
        FormBuilder,
        { provide: PurchaseService, useValue: purchaseService },
        { provide: ProductService, useValue: productService },
        { provide: TranslationService, useValue: {} },
        { provide: SupabaseService, useValue: supabaseService },
        { provide: ConfirmationService, useValue: confirmation },
        { provide: ToastService, useValue: toast }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).overrideComponent(PurchasesComponent, { set: { template: '' } });
    component = TestBed.createComponent(PurchasesComponent).componentInstance;
  });

  it('filters purchases by supplier, invoice, or item and orders the results', () => {
    component.searchTerm.set('gloves');
    expect(component.filteredPurchases().map(purchase => purchase.id)).toEqual(['p2']);

    component.searchTerm.set('');
    component.toggleSort('supplier');
    expect(component.sortDirection()).toBe('asc');
    expect(component.filteredPurchases().map(purchase => purchase.supplier)).toEqual(['North Medical', 'South Supplies']);
    component.toggleSort('supplier');
    expect(component.sortDirection()).toBe('desc');
  });

  it('resets pagination when the page size changes and rejects out-of-range pages', () => {
    component.currentPage.set(2);
    component.onPageSizeChange(1);
    expect(component.currentPage()).toBe(1);
    expect(component.totalPages()).toBe(2);
    component.goToPage(2);
    expect(component.currentPage()).toBe(2);
    component.goToPage(3);
    expect(component.currentPage()).toBe(2);
  });

  it('calculates GST, discounts, payable balance, and amount in words', () => {
    component.isFullPayment = false;
    component.recalculateTotals({
      items: [{ quantity: 2, freeQty: 1, costPrice: 50, discountPercent: 10, cgstPercent: 2.5, sgstPercent: 2.5 }],
      paidAmount: 40
    });

    expect(component.grossSubtotal()).toBe(100);
    expect(component.totalDiscount()).toBe(10);
    expect(component.taxableSubtotal()).toBe(90);
    expect(component.totalTax()).toBe(4.5);
    expect(component.calculatedTotal()).toBe(95);
    expect(component.totalArticles()).toBe(3);
    expect(component.dueAmount()).toBe(55);
    expect(component.getAmountInWords(0)).toBe('Rupees Zero Only');
    expect(component.getAmountInWords(123)).toBe('Rupees One Hundred and Twenty Three Only');
    expect(component.gstSummaryRows().find(row => row.label === 'GST 5 %')?.totalGst).toBe(4.5);
  });

  it('resets purchase entry state when creating a purchase and handles payment presets', () => {
    component.openAddModal();
    expect(component.showModal()).toBe(true);
    expect(component.items.length).toBe(1);
    component.items.at(0).patchValue({
      product: { id: 'p1', name: 'Bandage' }, quantity: 2, freeQty: 0, costPrice: 10,
      discountPercent: 0, cgstPercent: 0, sgstPercent: 0, gstPercent: 0
    });
    component.recalculateTotals();
    component.setPaymentPreset('zero');
    expect(component.dueAmount()).toBe(20);
    component.setPaymentPreset('full');
    expect(component.dueAmount()).toBe(0);
    expect(component.getItemName(0)).toBe('Bandage');
    expect(component.getLineAmount(0)).toBe(20);
    component.closeModal();
    expect(component.showModal()).toBe(false);
  });

  it('saves a validated purchase payload with an outstanding balance', async () => {
    component.openAddModal();
    component.purchaseForm.patchValue({
      supplier: 'North Medical', supplierInvoiceNumber: 'N-201',
      purchaseDate: '2026-06-01', finalBillAmount: 20, paidAmount: 5
    });
    component.items.at(0).patchValue({
      product: { id: 'p1', name: 'Bandage' }, quantity: 2, costPrice: 10,
      freeQty: 0, discountPercent: 0, gstPercent: 0, sgstPercent: 0, cgstPercent: 0
    });

    await component.savePurchase();

    expect(purchaseService.addPurchase).toHaveBeenCalledWith(expect.objectContaining({
      supplier: 'North Medical', supplierInvoiceNumber: 'N-201',
      finalBillAmount: 20, paidAmount: 5, dueAmount: 15
    }));
    expect(component.showModal()).toBe(false);
  });

  it('rejects invalid submissions, handles save errors, and updates an edited purchase', async () => {
    await component.savePurchase();
    expect(purchaseService.addPurchase).not.toHaveBeenCalled();
    expect(component.purchaseForm.touched).toBe(true);

    component.openAddModal();
    component.purchaseForm.patchValue({
      supplier: 'North Medical', supplierInvoiceNumber: 'N-202', purchaseDate: '2026-06-02',
      finalBillAmount: 10, paidAmount: 10
    });
    component.items.at(0).patchValue({ product: { id: 'x', name: 'Item' }, quantity: 1, costPrice: 10 });
    purchaseService.addPurchase.mockRejectedValueOnce('offline');
    await component.savePurchase();
    expect(toast.error).toHaveBeenCalledWith('Failed to save purchase.');

    component.openEditModal(purchases[0]);
    await component.savePurchase();
    expect(purchaseService.updatePurchase).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1', supplier: 'North Medical' }), purchases[0]
    );
    expect(toast.success).toHaveBeenCalledWith('Purchase updated.');
  });

  it('handles sorting options, search and pagination boundaries, and selection toggles', () => {
    expect(component.startItemIndex()).toBe(1);
    expect(component.endItemIndex()).toBe(2);
    component.onSearch({ target: { value: 'South' } } as unknown as Event);
    expect(component.currentPage()).toBe(1);
    expect(component.filteredPurchases()).toHaveLength(1);
    component.onSearch({ target: { value: '' } } as unknown as Event);
    component.onSortSelectChange('total-asc');
    expect(component.sortBy()).toBe('total');
    expect(component.sortDirection()).toBe('asc');
    expect(component.getSortIcon('total')).toBe('arrow_upward');
    expect(component.getSortIcon('due')).toBe('unfold_more');
    component.toggleSort('invoice');
    expect(component.sortDirection()).toBe('asc');
    component.toggleSort('due');
    expect(component.sortDirection()).toBe('desc');
    component.toggleSort('date');
    expect(component.filteredPurchases()[0].id).toBe('p2');

    component.pageSize.set(1);
    component.toggleSelection('p1');
    expect(component.isAllSelected()).toBe(false);
    component.toggleSelectAll();
    expect(component.isAllSelected()).toBe(true);
    component.toggleSelectAll();
    expect(component.isAllSelected()).toBe(false);
    component.goToPage(0);
    expect(component.currentPage()).toBe(1);
  });

  it('calculates zero-cost and split-tax rows and synchronizes payment edits', () => {
    component.openAddModal();
    component.items.at(0).patchValue({
      product: 'Manual item', quantity: 0, costPrice: 0, discountPercent: 120,
      gstPercent: 10, cgstPercent: 0, sgstPercent: 0
    });
    expect(component.getLineAmount(0)).toBe(0);
    expect(component.getItemName(0)).toBe('Manual item');
    expect(component.getItemName(20)).toBe('');
    component.items.at(0).patchValue({ quantity: 2, costPrice: 10, discountPercent: 10, gstPercent: 5, cgstPercent: 0, sgstPercent: 0 });
    expect(component.getLineAmount(0)).toBe(18.9);
    component.onFinalBillAmountChange();
    expect(component.autoSyncTotal).toBe(false);
    component.purchaseForm.patchValue({ finalBillAmount: 50, paidAmount: 80 });
    component.onPaidAmountChange();
    expect(component.dueAmount()).toBe(0);
    component.purchaseForm.patchValue({ paidAmount: 12 });
    component.onPaidAmountChange();
    expect(component.dueAmount()).toBe(38);
    component.syncInvoiceTotalWithCalculated();
    expect(component.autoSyncTotal).toBe(true);
  });

  it('searches and selects catalog items, supports multi-select toggles and empty results', () => {
    const product: Product = {
      id: 'p1', name: 'Bandage', category: 'Medical', sku: 'B-1', size: 'Free Size',
      color: '', purchasePrice: 5, sellingPrice: 10, discountPercent: 0, quantity: 4, minStockAlert: 1, imageUrls: []
    };
    productService.products.set([product]);
    purchaseService.procurementItems.set([{ id: 'row1', productName: 'Bandage', sku: 'B-1', batchNo: 'BATCH-1', quantity: 2, costPrice: 5, purchaseId: 'po1' }] as never[]);
    expect(component.inventoryCatalogCategories()).toEqual(['All', 'Medical']);
    component.toggleCatalogMultiSelect();
    component.setCatalogSearchTerm({ target: { value: 'batch-1' } } as unknown as Event);
    expect(component.filteredCatalogProducts()).toHaveLength(1);
    const entry = component.filteredCatalogProducts()[0];
    component.toggleCatalogProduct(entry.inventoryKey);
    expect(component.selectedCatalogProductCount()).toBe(1);
    component.addSelectedCatalogProducts();
    expect(component.items.at(0).get('product')?.value.name).toBe('Bandage');
    expect(component.showCatalogMultiSelect()).toBe(false);
    component.toggleCatalogMultiSelect();
    component.addSelectedCatalogProducts();
    expect(component.showCatalogMultiSelect()).toBe(true);
    component.cancelCatalogMultiSelect();
    expect(component.catalogSearchTerm()).toBe('');
    expect(component.selectedCatalogProductCount()).toBe(0);
  });

  it('manages product rows and selection, and confirms purchase deletions', async () => {
    const product: Product = {
      id: 'p1', name: 'Bandage', category: 'Medical', sku: 'B-1', size: 'Free Size',
      color: '', purchasePrice: 5, sellingPrice: 10, discountPercent: 0, quantity: 4, minStockAlert: 1, imageUrls: []
    };
    component.openAddModal();
    component.productSearchTerms.set(['ban']);
    productService.products.set([product]);
    expect(component.filteredProducts(0)).toEqual([product]);
    component.selectProduct(product, 0);
    expect(component.getItemName(0)).toBe('Bandage');
    expect(component.items.length).toBe(2);
    component.selectCustomProduct('  ', 1);
    expect(component.items.at(1).get('product')?.value.name).toBe('Purchase Item');
    component.removeItem(1);
    component.removeItem(0);
    expect(component.items.length).toBe(1);

    await component.deletePurchase(purchases[0]);
    await component.deleteAll();
    component.selectedIds.set(new Set(['p1', 'p2']));
    await component.deleteSelected();
    expect(purchaseService.deletePurchase).not.toHaveBeenCalled();
    confirmation.confirm.mockResolvedValue(true);
    await component.deletePurchase(purchases[0]);
    await component.deleteAll();
    await component.deleteSelected();
    expect(purchaseService.deletePurchase).toHaveBeenCalledWith('p1');
    expect(purchaseService.deleteAllPurchases).toHaveBeenCalledOnce();
    expect(component.selectedIds().size).toBe(0);
    expect(toast.success).toHaveBeenCalledWith('2 purchases deleted.');
  });

  it('parses structured bill rows, normalizes totals, tax and extracted item fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        supplierName: 'North', invoiceNumber: 'N-9', date: '2026-05-01',
        subtotal: 100, discount: 5, tax: 10, totalAmount: 105,
        rows: [
          {
            description: 'Gauze', qty: 2, amount: 40, hsn: '3005', sku: 'EXTRACTED',
            batch: 'B-5', expiryDate: '2027-01', mrp: 30, discountRate: 10, taxPercent: 5,
            freeQuantity: 1, packSize: '10s'
          },
          { description: 'Gloves', quantity: 1, rate: 20, sku: 'G-2', cgstRate: 2, sgstRate: 3 },
          { description: '', quantity: 99, rate: 99 }
        ]
      })
    }));
    const parse = (component as unknown as { parseInvoiceWithJS: (file: File, url: string) => Promise<any> }).parseInvoiceWithJS.bind(component);
    const result = await parse(new File(['bill'], 'bill.png'), 'data:image/png;base64,eA==');
    expect(supabaseService.anonKey).toHaveBeenCalled();
    expect(result).toMatchObject({
      supplier: 'North', supplierInvoiceNumber: 'N-9', purchaseDate: '2026-05-01',
      finalBillAmount: 105, cgst: 5, sgst: 5, totalTax: 10
    });
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      product: { name: 'Gauze', sku: 'HSN-3005', purchasePrice: 20 },
      quantity: 2, costPrice: 20, hsnCode: '3005', batchNo: 'B-5',
      freeQty: 1, discountPercent: 10, gstPercent: 5, pack: '10s'
    });
    expect(result.items[1]).toMatchObject({ product: { sku: 'G-2' }, cgstPercent: 2, sgstPercent: 3 });
    vi.unstubAllGlobals();
  });

  it('imports a selected bill image into the purchase form and handles a missing file', async () => {
    const alert = vi.fn();
    vi.stubGlobal('alert', alert);
    let fileReaderPromise: Promise<unknown> | undefined;
    vi.stubGlobal('FileReader', class {
      onload: ((event: unknown) => unknown) | null = null;
      readAsDataURL() {
        fileReaderPromise = Promise.resolve(this.onload?.({ target: { result: 'data:image/png;base64,eA==' } }));
      }
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        supplierName: 'Image Supplier', invoiceNumber: 'IMG-1', date: '2026-08-01',
        totalAmount: 12, tax: 0, rows: [{ description: 'Tape', quantity: 1, rate: 12 }]
      })
    }));
    const input = { files: [new File(['image'], 'bill.png')], value: 'bill.png' } as unknown as HTMLInputElement;
    await component.onBillImageSelected({ target: input } as unknown as Event);
    await fileReaderPromise;
    expect(input.value).toBe('');
    expect(component.isProcessingBill()).toBe(false);
    expect(component.purchaseForm.get('supplier')?.value).toBe('Image Supplier');
    expect(component.purchaseForm.get('supplierInvoiceNumber')?.value).toBe('IMG-1');
    expect(component.items.length).toBe(1);
    expect(component.productSearchTerms()).toEqual(['Tape']);
    expect(alert).not.toHaveBeenCalled();
    await component.onBillImageSelected({ target: { files: [] } } as unknown as Event);
    expect(component.items.length).toBe(1);
    vi.unstubAllGlobals();
  });

  it('rotates and reparses an existing bill image while handling an empty image URL', async () => {
    const translate = vi.fn();
    const rotate = vi.fn();
    const drawImage = vi.fn();
    const canvasContext = { translate, rotate, drawImage };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,eA==');
    vi.stubGlobal('Image', class {
      width = 100;
      height = 200;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) { this.onload?.(); }
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        supplierName: 'Rotated Supplier', invoiceNumber: 'ROT-1', date: '2026-08-02',
        totalAmount: 10, tax: 0, rows: [{ description: 'Cotton', quantity: 1, rate: 10 }]
      })
    }));
    await component.rotateBillImage();
    expect(component.isProcessingBill()).toBe(false);
    expect(component.purchaseForm.get('supplier')?.value).toBe('');
    component.purchaseForm.patchValue({ billImageUrl: 'data:image/png;base64,eA==' });
    await component.rotateBillImage();
    expect(component.purchaseForm.get('supplier')?.value).toBe('Rotated Supplier');
    expect(translate).toHaveBeenCalledWith(100, 50);
    expect(rotate).toHaveBeenCalledWith(Math.PI / 2);
    expect(drawImage).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

});
