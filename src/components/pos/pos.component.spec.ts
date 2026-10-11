import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Customer } from '../../models/customer.model';
import { Product } from '../../models/product.model';
import { ProductService } from '../../services/product.service';
import { CustomerService } from '../../services/customer.service';
import { InvoiceService } from '../../services/invoice.service';
import { CartService } from '../../services/cart.service';
import { PdfExportService } from '../../services/pdf-export.service';
import { ToastService } from '../../services/toast.service';
import { TranslationService } from '../../services/translation.service';
import { PosComponent } from './pos.component';

const products: Product[] = [
  { id: 'p1', name: 'Bandage', category: 'Medical', sku: 'B-1', size: 'Free Size', color: '', purchasePrice: 5, sellingPrice: 10, discountPercent: 0, quantity: 4, minStockAlert: 1, imageUrls: [] },
  { id: 'p2', name: 'Gloves', category: 'Medical', sku: 'G-1', size: 'Free Size', color: '', purchasePrice: 2, sellingPrice: 5, discountPercent: 0, quantity: 0, minStockAlert: 2, imageUrls: [] }
];

describe('PosComponent', () => {
  let component: PosComponent;
  let cartService: {
    total: ReturnType<typeof vi.fn>;
    items: ReturnType<typeof signal<Product[]>>;
    addItem: ReturnType<typeof vi.fn>;
    parkCurrentTransaction: ReturnType<typeof vi.fn>;
    restoreParkedTransaction: ReturnType<typeof vi.fn>;
    removeParkedTransaction: ReturnType<typeof vi.fn>;
    subtotal: ReturnType<typeof vi.fn>;
    totalDiscount: ReturnType<typeof vi.fn>;
    clearCart: ReturnType<typeof vi.fn>;
  };
  let productService: { products: ReturnType<typeof signal<Product[]>>; fetchProductsFromApi: ReturnType<typeof vi.fn> };
  let customerService: { customers: ReturnType<typeof signal<Customer[]>>; fetchCustomers: ReturnType<typeof vi.fn>; getWalkingCustomer: ReturnType<typeof vi.fn> };
  let invoiceService: { fetchInvoicesFromApi: ReturnType<typeof vi.fn>; generateNewInvoiceId: ReturnType<typeof vi.fn>; addInvoice: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let pdf: { generateInvoicePdf: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    cartService = {
      total: vi.fn(() => 20), items: signal<Product[]>([]), addItem: vi.fn(),
      parkCurrentTransaction: vi.fn(), restoreParkedTransaction: vi.fn(),
      removeParkedTransaction: vi.fn(), subtotal: vi.fn(() => 20),
      totalDiscount: vi.fn(() => 0), clearCart: vi.fn()
    };
    productService = { products: signal(products), fetchProductsFromApi: vi.fn() };
    customerService = {
      customers: signal([{ id: 'c1', name: 'Asha', phone: '555', email: 'asha@example.test', purchaseHistory: [] }]),
      fetchCustomers: vi.fn(), getWalkingCustomer: vi.fn(() => null)
    };
    invoiceService = { fetchInvoicesFromApi: vi.fn(), generateNewInvoiceId: vi.fn(() => 'INV-10'), addInvoice: vi.fn().mockResolvedValue(undefined) };
    router = { navigate: vi.fn() };
    pdf = { generateInvoicePdf: vi.fn() };
    toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      imports: [PosComponent],
      providers: [
        FormBuilder,
        { provide: ProductService, useValue: productService },
        { provide: CustomerService, useValue: customerService },
        { provide: InvoiceService, useValue: invoiceService },
        { provide: CartService, useValue: cartService },
        { provide: PdfExportService, useValue: pdf },
        { provide: ToastService, useValue: toast },
        { provide: TranslationService, useValue: {} },
        { provide: Router, useValue: router }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).overrideComponent(PosComponent, { set: { template: '' } });
    component = TestBed.createComponent(PosComponent).componentInstance;
  });

  it('filters the catalog by text, category, and stock and calculates change', () => {
    component.inStockOnly.set(true);
    expect(component.filteredProducts().map(product => product.id)).toEqual(['p1']);
    expect(component.categories()).toEqual(['All', 'Medical']);
    component.searchTerm.set('missing');
    expect(component.filteredProducts()).toEqual([]);

    component.tenderAmount.set(25);
    expect(component.changeDue()).toBe(5);
    component.tenderAmount.set(15);
    expect(component.changeDue()).toBe(0);
  });

  it('scans stocked products into the cart and rejects unavailable items', () => {
    component.barcodeInput.set('b-1');
    component.onScanBarcode();
    expect(cartService.addItem).toHaveBeenCalledWith(products[0]);
    expect(component.barcodeInput()).toBe('');
    expect(component.scanFeedback()?.isError).toBe(false);

    component.barcodeInput.set('g-1');
    component.onScanBarcode();
    expect(cartService.addItem).toHaveBeenCalledOnce();
    expect(component.scanFeedback()?.isError).toBe(true);
  });

  it('supports tender presets, customer switching, search reset, and stock guards', () => {
    component.setExactTender();
    expect(component.tenderAmount()).toBe(20);
    expect(component.checkoutForm.get('amountPaid')?.value).toBe(20);
    component.addTenderPreset(10);
    expect(component.tenderAmount()).toBe(30);
    component.setCustomTender(12.5);
    expect(component.checkoutForm.get('amountPaid')?.value).toBe(12.5);

    component.addToCart(products[0]);
    component.addToCart(products[1]);
    expect(cartService.addItem).toHaveBeenCalledOnce();
    const customer = customerService.customers()[0];
    component.selectCustomer(customer);
    expect(component.selectedCustomer()).toBe(customer);
    component.customerSearch.set('example.test');
    expect(component.filteredCustomers()).toEqual([customer]);
    component.searchTerm.set('band');
    component.clearSearch();
    expect(component.searchTerm()).toBe('');
    component.onSearch({ target: { value: 'glove' } } as unknown as Event);
    expect(component.searchTerm()).toBe('glove');
  });

  it('initializes service data and prepares checkout from the current total', () => {
    component.ngOnInit();
    expect(productService.fetchProductsFromApi).toHaveBeenCalledOnce();
    expect(customerService.fetchCustomers).toHaveBeenCalledOnce();
    expect(customerService.getWalkingCustomer).toHaveBeenCalledOnce();
    component.tenderAmount.set(0);
    component.openCheckout();
    expect(component.tenderAmount()).toBe(20);
    expect(component.showCheckoutModal()).toBe(true);
  });

  it('covers empty, missing, and name-matched barcode scans and prevents the scan event default', () => {
    component.onScanBarcode();
    expect(component.scanFeedback()).toBeNull();
    const event = { preventDefault: vi.fn() } as unknown as Event;
    component.barcodeInput.set('unknown');
    component.onScanBarcode(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(component.scanFeedback()?.message).toContain('No product found');
    component.barcodeInput.set('bandage');
    component.onScanBarcode();
    expect(cartService.addItem).toHaveBeenCalledWith(products[0]);
    component.barcodeInput.set('GLOVES');
    component.onScanBarcode();
    expect(component.scanFeedback()?.message).toBe('Out of stock: Gloves');
    expect(component.scanFeedback()?.isError).toBe(true);
  });

  it('switches to a walking customer and supports parked transaction success and failure paths', () => {
    const customer = customerService.customers()[0];
    customerService.getWalkingCustomer.mockReturnValue(customer);
    component.setWalkingCustomer();
    expect(component.selectedCustomer()).toBe(customer);
    expect(component.showCustomerModal()).toBe(false);

    const parked = { id: 'TXN-PARK-123', customerName: 'Asha' } as import('../../services/cart.service').ParkedTransaction;
    const parkCurrentTransaction = cartService.parkCurrentTransaction.mockReturnValueOnce(false).mockReturnValueOnce(true);
    component.parkActiveTransaction();
    expect(component.scanFeedback()).toBeNull();
    component.parkActiveTransaction();
    expect(parkCurrentTransaction).toHaveBeenCalledWith(customer.name);
    component.showParkedModal.set(true);
    component.restoreParked(parked);
    expect(cartService.restoreParkedTransaction).toHaveBeenCalledWith(parked.id);
    expect(component.activeTransactionRef()).toBe('TXN-123');
    expect(component.showParkedModal()).toBe(false);
    component.removeParked(parked.id);
    expect(cartService.removeParkedTransaction).toHaveBeenCalledWith(parked.id);
  });

  it('validates checkout, completes a sale, and supports receipt, new-sale, and invoice navigation actions', async () => {
    await component.completeSale();
    expect(invoiceService.addInvoice).not.toHaveBeenCalled();
    const items = signal<Product[]>([products[0]]);
    cartService.items = items;
    component.checkoutForm.patchValue({ amountPaid: 20, paymentMode: 'Card', notes: 'paid' });
    await component.completeSale();
    expect(invoiceService.addInvoice).toHaveBeenCalledWith(expect.objectContaining({
      id: 'INV-10', total: 20, amountPaid: 20, paymentMode: 'Card', notes: 'paid'
    }));
    expect(toast.success).toHaveBeenCalledWith('Sale INV-10 completed.');
    expect(cartService.clearCart).toHaveBeenCalledOnce();
    expect(component.showSuccessModal()).toBe(true);
    expect(pdf.generateInvoicePdf).toHaveBeenCalledWith(expect.any(Object), undefined, 'thermal');
    component.downloadInvoicePdf('modern');
    expect(pdf.generateInvoicePdf).toHaveBeenLastCalledWith(component.lastCompletedInvoice(), undefined, 'modern');
    component.startNewSale();
    expect(component.lastCompletedInvoice()).toBeNull();
    expect(component.showSuccessModal()).toBe(false);
    component.goToInvoices();
    expect(router.navigate).toHaveBeenCalledWith(['/invoices']);
  });

  it('uses walking-customer fallback and keeps explicitly entered checkout tender', () => {
    customerService.getWalkingCustomer.mockReturnValue(null);
    component.showCustomerModal.set(true);
    component.setWalkingCustomer();
    expect(component.selectedCustomer().name).toBe('Walk-in Customer');
    component.tenderAmount.set(7);
    component.openCheckout();
    expect(component.checkoutForm.get('amountPaid')?.value).toBe(7);
    expect(component.changeDue()).toBe(0);
    component.downloadInvoicePdf();
    expect(pdf.generateInvoicePdf).not.toHaveBeenCalled();
  });
});
