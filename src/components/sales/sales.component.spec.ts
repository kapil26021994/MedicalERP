import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Invoice } from '../../models/invoice.model';
import { Product } from '../../models/product.model';
import { InvoiceService } from '../../services/invoice.service';
import { CustomerService } from '../../services/customer.service';
import { ProductService } from '../../services/product.service';
import { PdfExportService } from '../../services/pdf-export.service';
import { TranslationService } from '../../services/translation.service';
import { ConfirmationService } from '../../services/confirmation.service';
import { ToastService } from '../../services/toast.service';
import { SalesComponent } from './sales.component';

const makeInvoice = (id: string, customerName: string, total: number, amountPaid: number): Invoice => ({
  id,
  date: new Date(),
  customer: { id: `c-${id}`, name: customerName, phone: '5551234', purchaseHistory: [] },
  items: [{ id: 'p1', name: 'Bandage', cartQuantity: 1, sellingPrice: total, discountPercent: 0, isCustom: false }],
  subtotal: total,
  total,
  paymentMode: 'Cash',
  totalDiscount: 0,
  amountPaid
});

describe('SalesComponent', () => {
  let component: SalesComponent;
  let invoices: ReturnType<typeof signal<Invoice[]>>;
  let invoiceService: {
    invoices: typeof invoices;
    fetchInvoicesFromApi: ReturnType<typeof vi.fn>;
    updateInvoice: ReturnType<typeof vi.fn>;
    deleteInvoice: ReturnType<typeof vi.fn>;
    deleteAllInvoices: ReturnType<typeof vi.fn>;
  };
  let customerService: { fetchCustomers: ReturnType<typeof vi.fn> };
  let productService: { products: ReturnType<typeof signal<Product[]>>; fetchProductsFromApi: ReturnType<typeof vi.fn>; updateStock: ReturnType<typeof vi.fn> };
  let confirmation: { confirm: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let pdf: { generateInvoicePdf: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    invoices = signal([makeInvoice('INV-1', 'Asha', 100, 40), makeInvoice('INV-2', 'Beena', 50, 50)]);
    invoiceService = {
      invoices, fetchInvoicesFromApi: vi.fn(),
      updateInvoice: vi.fn().mockResolvedValue(undefined),
      deleteInvoice: vi.fn().mockResolvedValue(undefined),
      deleteAllInvoices: vi.fn().mockResolvedValue(undefined)
    };
    customerService = { fetchCustomers: vi.fn() };
    productService = { products: signal<Product[]>([]), fetchProductsFromApi: vi.fn(), updateStock: vi.fn() };
    confirmation = { confirm: vi.fn().mockResolvedValue(false) };
    toast = { success: vi.fn(), error: vi.fn() };
    pdf = { generateInvoicePdf: vi.fn() };
    TestBed.configureTestingModule({
      imports: [SalesComponent],
      providers: [
        { provide: InvoiceService, useValue: invoiceService },
        { provide: CustomerService, useValue: customerService },
        { provide: ProductService, useValue: productService },
        { provide: PdfExportService, useValue: pdf },
        { provide: TranslationService, useValue: {} },
        { provide: ConfirmationService, useValue: confirmation },
        { provide: ToastService, useValue: toast },
        { provide: ActivatedRoute, useValue: { queryParams: of({ tab: 'inventory' }) } }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).overrideComponent(SalesComponent, { set: { template: '' } });
    component = TestBed.createComponent(SalesComponent).componentInstance;
  });

  it('derives payment metrics and filters sales by customer and due status', () => {
    expect(component.totalGrossSales()).toBe(150);
    expect(component.totalOutstandingDues()).toBe(60);
    expect(component.collectionPercentage()).toBe(60);
    expect(component.getPaymentStatus(invoices()[0]).label).toBe('Partial');

    component.searchTerm.set('asha');
    expect(component.filteredSales().map(sale => sale.id)).toEqual(['INV-1']);
    component.searchTerm.set('');
    component.paymentFilter.set('due');
    expect(component.filteredSales().map(sale => sale.id)).toEqual(['INV-1']);
  });

  it('loads its data and honors the inventory tab query parameter', () => {
    component.ngOnInit();
    expect(invoiceService.fetchInvoicesFromApi).toHaveBeenCalledWith(true);
    expect(customerService.fetchCustomers).toHaveBeenCalledOnce();
    expect(productService.fetchProductsFromApi).toHaveBeenCalledWith(true);
    expect(component.activeTab()).toBe('inventory');
  });

  it('records due payments, caps payment at the balance, and keeps the selected sale current', async () => {
    const sale = invoices()[0];
    component.viewSaleDetails(sale);
    const event = { stopPropagation: vi.fn() } as unknown as Event;
    component.openRecordPaymentModal(sale, event);
    expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(component.paymentAmountInput()).toBe(60);
    component.paymentAmountInput.set(100);
    await component.submitPaymentRecord();
    expect(invoiceService.updateInvoice).toHaveBeenCalledWith(expect.objectContaining({ amountPaid: 100, paymentMode: 'UPI' }));
    expect(component.selectedSale()?.amountPaid).toBe(100);
    expect(component.showPaymentModal()).toBe(false);
  });

  it('sorts, toggles selections, and reports stock-update errors', async () => {
    component.toggleSort('customer');
    expect(component.sortDirection()).toBe('asc');
    expect(component.getSortIcon('customer')).toBe('expand_less');
    component.toggleSelection('INV-1');
    expect(component.isAllSelected()).toBe(false);
    component.toggleSelectAll();
    expect(component.isAllSelected()).toBe(true);

    const toast = TestBed.inject(ToastService) as unknown as { error: ReturnType<typeof vi.fn> };
    const product: import('../../models/product.model').Product = {
      id: 'p1', name: 'Bandage', category: 'Medical', sku: 'B-1', size: 'Free Size',
      color: '', purchasePrice: 5, sellingPrice: 10, discountPercent: 0, quantity: 1, minStockAlert: 2, imageUrls: []
    };
    productService.updateStock.mockRejectedValue(new Error('Stock error'));
    await component.adjustProductStock(product, -1);
    expect(toast.error).toHaveBeenCalledWith('Stock error');
  });

  it('filters inventory and sales by payment, date, and item, and calculates analytics', () => {
    const todayInvoice: Invoice = { ...makeInvoice('TODAY', 'Asha', 20, 20), date: new Date(), paymentMode: 'Cash' };
    const yesterday: Invoice = { ...makeInvoice('YESTERDAY', 'Beena', 40, 0), date: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 10), paymentMode: 'UPI' };
    invoices.set([todayInvoice, yesterday]);
    component.searchTerm.set('bandage');
    expect(component.filteredSales()).toHaveLength(2);
    component.searchTerm.set('');
    component.dateFilter.set('today');
    expect(component.filteredSales().map(s => s.id)).toEqual(['TODAY']);
    component.dateFilter.set('this_week');
    expect(component.filteredSales()).toHaveLength(1);
    component.dateFilter.set('this_month');
    expect(component.filteredSales()).toHaveLength(1);
    component.dateFilter.set('all');
    component.paymentFilter.set('paid');
    expect(component.filteredSales().map(s => s.id)).toEqual(['TODAY']);
    component.paymentFilter.set('upi');
    expect(component.filteredSales().map(s => s.id)).toEqual(['YESTERDAY']);
    expect(component.customerSalesSummary()[0].name).toBe('Beena');
    expect(component.topSellingProducts()[0].qty).toBe(2);
    expect(component.paymentModeBreakdown().find(mode => mode.mode === 'UPI')?.count).toBe(1);
  });

  it('filters stock states, sorts each field, and reports stock-update outcomes', async () => {
    const product: Product = {
      id: 'p1', name: 'Bandage', category: 'Medical', sku: 'B-1', size: 'Free Size',
      color: '', purchasePrice: 5, sellingPrice: 10, discountPercent: 0, quantity: 2, minStockAlert: 3, imageUrls: []
    };
    const wellStocked = { ...product, id: 'p2', name: 'Gloves', sku: 'G-1', quantity: 10 };
    const empty = { ...product, id: 'p3', name: 'Mask', sku: 'M-1', quantity: 0 };
    productService.products.set([product, wellStocked, empty]);
    component.productSearchTerm.set('medical');
    expect(component.filteredInventoryProducts()).toHaveLength(3);
    component.stockFilter.set('low_stock');
    expect(component.filteredInventoryProducts().map(p => p.id)).toEqual(['p1']);
    component.stockFilter.set('out_of_stock');
    expect(component.filteredInventoryProducts().map(p => p.id)).toEqual(['p3']);
    component.stockFilter.set('in_stock');
    expect(component.filteredInventoryProducts().map(p => p.id)).toEqual(['p2']);

    component.sortBy.set('customer');
    component.toggleSort('customer');
    expect(component.sortDirection()).toBe('asc');
    component.toggleSort('total');
    expect(component.getSortIcon('customer')).toBe('unfold_more');
    expect(component.getSortIcon('total')).toBe('expand_more');

    productService.updateStock.mockResolvedValueOnce(undefined);
    await component.adjustProductStock(product, 2);
    expect(toast.success).toHaveBeenCalledWith('Stock updated for Bandage.');
    productService.updateStock.mockRejectedValueOnce('offline');
    await component.adjustProductStock(product, -1);
    expect(toast.error).toHaveBeenCalledWith('Failed to update product stock.');
  });

  it('supports payment cancellation, CSV/PDF exports, reminders, and detail cleanup', async () => {
    const sale = invoices()[0];
    component.viewSaleDetails(sale);
    component.closeModal();
    expect(component.selectedSale()).toBeNull();
    component.paymentSale.set(null);
    component.paymentAmountInput.set(10);
    await component.submitPaymentRecord();
    expect(invoiceService.updateInvoice).not.toHaveBeenCalled();

    component.downloadSalePdf(sale);
    expect(pdf.generateInvoicePdf).toHaveBeenCalledWith(sale);
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    component.sendWhatsAppReminder(sale, { stopPropagation: vi.fn() } as unknown as Event);
    expect(open).toHaveBeenCalledWith(expect.stringContaining('https://wa.me/5551234?text='), '_blank');
    component.exportSalesCsv();
    expect(document.querySelector('a[download]')).toBeNull();
    open.mockRestore();
  });

  it('confirms and cancels single, bulk, and selected sale deletions', async () => {
    const sale = invoices()[0];
    await component.deleteSale(sale);
    await component.deleteAll();
    component.selectedIds.set(new Set(['INV-1']));
    await component.deleteSelected();
    expect(invoiceService.deleteInvoice).not.toHaveBeenCalled();
    expect(invoiceService.deleteAllInvoices).not.toHaveBeenCalled();
    confirmation.confirm.mockResolvedValue(true);
    await component.deleteSale(sale);
    await component.deleteAll();
    await component.deleteSelected();
    expect(invoiceService.deleteInvoice).toHaveBeenCalledWith('INV-1');
    expect(invoiceService.deleteAllInvoices).toHaveBeenCalledOnce();
    expect(component.selectedIds().size).toBe(0);
    expect(toast.success).toHaveBeenCalledWith('All sales records deleted.');
  });

  it('returns defaults for missing payment data and supports selecting and clearing all rows', () => {
    const noPayment = { ...makeInvoice('WALKIN', '', 10, 0), amountPaid: undefined, customer: undefined };
    invoices.set([noPayment]);
    expect(component.getDueAmount(noPayment)).toBe(0);
    expect(component.getPaymentStatus(noPayment).label).toBe('Paid');
    component.toggleSelectAll();
    expect(component.isAllSelected()).toBe(true);
    component.toggleSelectAll();
    expect(component.isAllSelected()).toBe(false);
    component.paymentFilter.set('due');
    expect(component.collectionPercentage()).toBe(100);
    expect(component.averageOrderValue()).toBe(0);
  });
});
