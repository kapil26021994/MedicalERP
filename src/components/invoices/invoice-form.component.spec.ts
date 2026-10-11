import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Customer } from '../../models/customer.model';
import { Product } from '../../models/product.model';
import { InvoiceService } from '../../services/invoice.service';
import { CustomerService } from '../../services/customer.service';
import { ProductService } from '../../services/product.service';
import { PurchaseService } from '../../services/purchase.service';
import { SettingsService } from '../../services/settings.service';
import { PdfExportService } from '../../services/pdf-export.service';
import { SupabaseService } from '../../services/supabase.service';
import { ToastService } from '../../services/toast.service';
import { InvoiceFormComponent } from './invoice-form.component';

const product: Product = {
  id: 'p1', name: 'Bandage', category: 'Medical', sku: 'B-1', size: 'Free Size',
  color: '', purchasePrice: 5, sellingPrice: 20, discountPercent: 10,
  quantity: 8, minStockAlert: 2, imageUrls: []
};

describe('InvoiceFormComponent', () => {
  let component: InvoiceFormComponent;
  let customer: Customer;
  let invoiceService: {
    fetchInvoicesFromApi: ReturnType<typeof vi.fn>;
    getInvoiceById: ReturnType<typeof vi.fn>;
    addInvoice: ReturnType<typeof vi.fn>;
    updateInvoice: ReturnType<typeof vi.fn>;
    generateNewInvoiceId: ReturnType<typeof vi.fn>;
  };
  let customerService: { customers: ReturnType<typeof signal<Customer[]>>; addCustomer: ReturnType<typeof vi.fn> };
  let productService: { products: ReturnType<typeof signal<Product[]>>; fetchProductsFromApi: ReturnType<typeof vi.fn>; getProductById: ReturnType<typeof vi.fn> };
  let purchaseService: { procurementItems: ReturnType<typeof signal<never[]>>; purchases: ReturnType<typeof signal<never[]>>; extractProcurementItemsFromPurchases: ReturnType<typeof vi.fn>; fetchPurchasesFromApi: ReturnType<typeof vi.fn> };
  let routeParams: BehaviorSubject<{ id?: string }>;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let supabaseService: { currentSession: ReturnType<typeof vi.fn>; anonKey: ReturnType<typeof vi.fn> };

  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    routeParams = new BehaviorSubject<{ id?: string }>({});
    customer = { id: 'c1', name: 'Asha', phone: '5551234567', purchaseHistory: [] };
    invoiceService = {
      fetchInvoicesFromApi: vi.fn(), getInvoiceById: vi.fn(),
      addInvoice: vi.fn().mockResolvedValue(undefined),
      updateInvoice: vi.fn().mockResolvedValue(undefined),
      generateNewInvoiceId: vi.fn(() => 'INV-NEW')
    };
    customerService = { customers: signal([customer]), addCustomer: vi.fn() };
    productService = {
      products: signal([product]), fetchProductsFromApi: vi.fn(), getProductById: vi.fn((id: string) => id === product.id ? product : undefined)
    };
    purchaseService = {
      procurementItems: signal<never[]>([]), purchases: signal<never[]>([]),
      extractProcurementItemsFromPurchases: vi.fn(() => []), fetchPurchasesFromApi: vi.fn()
    };
    router = { navigate: vi.fn() };
    toastService = { success: vi.fn(), error: vi.fn() };
    supabaseService = { currentSession: vi.fn(() => null), anonKey: vi.fn(() => '') };
    TestBed.configureTestingModule({
      imports: [InvoiceFormComponent],
      providers: [
        FormBuilder,
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { params: routeParams } },
        { provide: InvoiceService, useValue: invoiceService },
        { provide: CustomerService, useValue: customerService },
        { provide: ProductService, useValue: productService },
        { provide: PurchaseService, useValue: purchaseService },
        { provide: SettingsService, useValue: { defaultTemplate: () => 'modern' } },
        { provide: PdfExportService, useValue: { generateInvoicePdf: vi.fn() } },
        { provide: SupabaseService, useValue: supabaseService },
        { provide: ToastService, useValue: toastService }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).overrideComponent(InvoiceFormComponent, { set: { template: '' } });
    component = TestBed.createComponent(InvoiceFormComponent).componentInstance;
  });

  it('adds and removes rows while maintaining discounted totals', () => {
    component.ngOnInit();
    expect(component.items.length).toBe(1);
    component.items.at(0).patchValue({ product, cartQuantity: 2, sellingPrice: 20, discountPercent: 25 });
    expect(component.totals()).toEqual({ subtotal: 40, discount: 10, total: 30 });
    expect(component.getItemLineTotal(component.items.at(0).value)).toBe(30);

    component.selectProduct(product, 0);
    expect(component.items.length).toBe(2);
    component.removeItem(1);
    expect(component.items.length).toBe(1);
  });

  it('selects customers and creates a useful preview for an empty draft', () => {
    component.selectCustomer(customer);
    expect(component.invoiceForm.get('customer')?.value).toEqual(customer);
    expect(component.invoiceForm.get('phone')?.value).toBe(customer.phone);
    expect(component.displayCustomer(customer)).toBe('Asha');

    expect(component.previewInvoiceData().items[0].name).toBe('Sample Item Line');
    component.selectTemplate('thermal');
    expect(component.selectedTemplate()).toBe('thermal');
  });

  it('handles product lookup, custom rows, search dropdown state, and template controls', () => {
    component.ngOnInit();
    expect(component.filteredProducts(0).map(item => item.sku)).toEqual(['B-1']);
    component.onProductInputChange('B-1', 0);
    expect(component.items.at(0).get('product')?.value).toEqual(product);
    expect(component.activeProductDropdown()).toBeNull();

    component.selectCustomProduct('   ', 1);
    expect(component.items.at(1).get('product')?.value.name).toBe('Custom Item');
    expect(component.displayProduct(product)).toBe('Bandage');
    component.onProductInputChange('Manual note', 2);
    expect(component.filteredProducts(2)).toEqual([]);
    expect(component.activeProductDropdown()).toBe(2);
    component.onProductInputEnter(0);
    expect(component.activeProductDropdown()).toBeNull();

    component.toggleTemplatePreview();
    component.toggleFullScreenPreview();
    expect(component.showTemplatePreviewModal()).toBe(true);
    expect(component.isFullScreenPreview()).toBe(true);
    component.openInventoryModal(0);
    expect(component.showInventoryModal()).toBe(true);
    expect(component.targetRowIndex()).toBe(0);
    component.closeInventoryModal();
    expect(component.targetRowIndex()).toBeNull();
  });

  it('saves a valid new invoice with computed totals and navigates to the register', async () => {
    component.ngOnInit();
    component.selectCustomer(customer);
    component.items.at(0).patchValue({
      product, cartQuantity: 2, sellingPrice: 20, discountPercent: 10
    });
    component.invoiceForm.patchValue({ amountPaid: 36, paymentMode: 'Card', notes: 'Counter sale' });

    await component.saveInvoice();

    expect(invoiceService.addInvoice).toHaveBeenCalledWith(expect.objectContaining({
      id: 'INV-NEW',
      customer,
      total: 36,
      amountPaid: 36,
      paymentMode: 'Card',
      notes: 'Counter sale'
    }));
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/invoices']);
  });

  it('filters customers and handles quick-add validation and successful selection', async () => {
    component.customerSearchControl.setValue('asha');
    expect(component.filteredCustomers().map(item => item.id)).toEqual(['c1']);
    component.customerSearchControl.setValue({ name: 'Asha' } as unknown as string);
    expect(component.filteredCustomers()).toHaveLength(1);
    component.customerSearchControl.setValue('none');
    expect(component.filteredCustomers()).toEqual([]);

    component.openAddCustomerModal();
    await component.saveNewCustomer();
    expect(customerService.addCustomer).not.toHaveBeenCalled();

    const added = { id: 'c2', name: 'Mira', phone: '5559999999', purchaseHistory: [] };
    customerService.addCustomer.mockResolvedValue(added);
    component.newCustomerForm.setValue({ name: 'Mira', phone: '5559999999', email: '' });
    await component.saveNewCustomer();
    expect(customerService.addCustomer).toHaveBeenCalledOnce();
    expect(component.invoiceForm.get('customer')?.value).toEqual(added);
    expect(component.showAddCustomerModal()).toBe(false);
    expect(toastService.success).toHaveBeenCalledWith('Customer added.');
  });

  it('filters inventory, toggles bulk selection, and inserts selected stock rows', () => {
    component.ngOnInit();
    const entry = component.inventoryCatalogProducts()[0];
    expect(component.inventoryCategories()).toContain('Medical');
    component.inventoryCategoryFilter.set('Medical');
    component.inventorySearchTerm.set('b-1');
    expect(component.filteredInventoryProducts()).toHaveLength(1);
    component.inventorySearchTerm.set('unknown');
    expect(component.filteredInventoryProducts()).toEqual([]);
    component.inventorySearchTerm.set('');

    component.openInventoryModal(0);
    expect(component.showInventoryModal()).toBe(true);
    expect(component.areAllFilteredInventoryProductsSelected()).toBe(false);
    component.toggleSelectAllInventoryProducts();
    expect(component.areAllFilteredInventoryProductsSelected()).toBe(true);
    expect(component.selectedInventoryProductCount()).toBe(1);
    component.toggleInventoryProduct(entry.inventoryKey);
    expect(component.areAllFilteredInventoryProductsSelected()).toBe(false);
    component.toggleInventoryProduct(entry.inventoryKey);
    component.addSelectedInventoryProducts();

    expect(component.items.at(0).get('product')?.value).toEqual(product);
    expect(component.showInventoryModal()).toBe(false);
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('populates edit invoices and saves updates; redirects for a missing invoice', async () => {
    const existing = {
      id: 'INV-EDIT',
      date: new Date('2026-04-01'),
      customer,
      items: [{ id: 'p1', name: 'Bandage', cartQuantity: 2, sellingPrice: 20, discountPercent: 10, isCustom: false }],
      subtotal: 40,
      total: 36,
      paymentMode: 'Cash' as const,
      amountPaid: 10,
      totalDiscount: 4,
      notes: 'Existing',
      template: 'thermal' as const
    };
    routeParams.next({ id: 'INV-EDIT' });
    invoiceService.getInvoiceById.mockReturnValue(existing);
    component.ngOnInit();
    expect(component.isEditMode()).toBe(true);
    expect(component.pageTitle()).toBe('Edit Transaction');
    expect(component.selectedTemplate()).toBe('thermal');
    expect(component.items.length).toBe(1);
    expect(component.items.at(0).get('product')?.value).toEqual(product);
    await component.saveInvoice();
    expect(invoiceService.updateInvoice).toHaveBeenCalledWith(expect.objectContaining({
      id: 'INV-EDIT', total: 36, notes: 'Existing'
    }));
    expect(toastService.success).toHaveBeenCalledWith('Invoice updated.');

    routeParams.next({ id: 'missing' });
    invoiceService.getInvoiceById.mockReturnValue(undefined);
    component.ngOnInit();
    expect(router.navigate).toHaveBeenCalledWith(['/invoices']);
  });

  it('handles PDF guards and export, failed saves, and OCR-extracted invoice rows', async () => {
    component.downloadInvoicePdf();
    expect(TestBed.inject(PdfExportService).generateInvoicePdf).not.toHaveBeenCalled();
    component.ngOnInit();
    component.selectCustomer(customer);
    component.items.at(0).patchValue({ product, cartQuantity: 1, sellingPrice: 20, discountPercent: 0 });
    component.downloadInvoicePdf();
    expect(TestBed.inject(PdfExportService).generateInvoicePdf).toHaveBeenCalledWith(
      expect.objectContaining({ customer, total: 20 }), undefined, 'modern'
    );

    invoiceService.addInvoice.mockRejectedValueOnce(new Error('offline'));
    const alert = vi.fn();
    vi.stubGlobal('alert', alert);
    await component.saveInvoice();
    expect(alert).toHaveBeenCalledWith(expect.stringContaining('offline'));
    expect(router.navigate).not.toHaveBeenCalled();

    let reader: { onload: ((event: any) => Promise<void>) | null; readAsDataURL: ReturnType<typeof vi.fn> };
    class MockFileReader {
      onload: ((event: any) => Promise<void>) | null = null;
      readAsDataURL = vi.fn();
      constructor() { reader = this; }
    }
    vi.stubGlobal('FileReader', MockFileReader);
    supabaseService.currentSession.mockReturnValue({ access_token: 'token-1' });
    supabaseService.anonKey.mockReturnValue('public-key');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        supplierName: 'Asha',
        date: '2026-03-02',
        totalAmount: 44,
        rows: [
          { itemDescription: 'Bandage', quantity: 2, mrp: 20, discountPercent: 10 },
          { description: 'Manual gauze', quantity: 1, rate: 4, hsnCode: 'H-2' },
          { name: '   ' }
        ]
      })
    });
    vi.stubGlobal('fetch', fetchMock);
    const input = { files: [new File(['invoice'], 'invoice.png')], value: 'invoice.png' };
    await component.onInvoiceImageSelected({ target: input } as unknown as Event);
    await reader!.onload!({ target: { result: 'data:image/png;base64,AA==' } });
    expect(fetchMock).toHaveBeenCalledWith('/api/parse-invoice', expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: expect.stringContaining('token-1'),
        apikey: 'public-key'
      })
    }));
    expect(component.items.length).toBe(2);
    expect(component.items.at(0).get('product')?.value).toEqual(product);
    expect(component.items.at(1).get('product')?.value.name).toBe('Manual gauze');
    expect(component.invoiceForm.get('date')?.value).toBe('2026-03-02');
    expect(component.invoiceForm.get('amountPaid')?.value).toBe(44);
    expect(component.isProcessingInvoice()).toBe(false);
    expect(input.value).toBe('');
  });

  it('ignores invoice-image selections without a file', async () => {
    const fileInput = { files: [], value: '' };
    await component.onInvoiceImageSelected({ target: fileInput } as unknown as Event);
    expect(component.isProcessingInvoice()).toBe(false);
  });
});
