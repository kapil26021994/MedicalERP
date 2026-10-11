import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardComponent } from './dashboard.component';
import { Product } from '../../models/product.model';
import { Invoice } from '../../models/invoice.model';
import { ProductService } from '../../services/product.service';
import { InvoiceService } from '../../services/invoice.service';
import { PurchaseService } from '../../services/purchase.service';
import { ExpenseService } from '../../services/expense.service';
import { CustomerService } from '../../services/customer.service';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let products: ReturnType<typeof signal<Product[]>>;
  let invoices: ReturnType<typeof signal<Invoice[]>>;
  let productService: {
    products: typeof products;
    isLoading: ReturnType<typeof signal<boolean>>;
    isLoaded: ReturnType<typeof vi.fn>;
    setProducts: ReturnType<typeof vi.fn>;
    getProductById: ReturnType<typeof vi.fn>;
    updateStock: ReturnType<typeof vi.fn>;
  };
  let invoiceService: {
    invoices: typeof invoices;
    isLoading: ReturnType<typeof signal<boolean>>;
    isLoaded: ReturnType<typeof vi.fn>;
    setInvoices: ReturnType<typeof vi.fn>;
  };
  let purchaseService: { purchases: ReturnType<typeof signal<{ finalBillAmount: number }[]>>; isLoading: ReturnType<typeof signal<boolean>>; setPurchases: ReturnType<typeof vi.fn> };
  let expenseService: { expenses: ReturnType<typeof signal<{ amount: number }[]>>; isLoading: ReturnType<typeof signal<boolean>>; setExpenses: ReturnType<typeof vi.fn> };
  let customerService: { customers: ReturnType<typeof signal<{ id: string; name: string; phone: string; purchaseHistory: string[] }[]>>; isLoading: ReturnType<typeof signal<boolean>>; setCustomers: ReturnType<typeof vi.fn> };
  let httpGet: ReturnType<typeof vi.fn>;
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  beforeEach(async () => {
    const product: Product = {
      id: 'p1', name: 'Bandage', category: 'Medical', sku: 'B-1', size: 'Free Size',
      color: '', purchasePrice: 5, sellingPrice: 10, discountPercent: 0,
      quantity: 2, minStockAlert: 5, imageUrls: []
    };
    const customer = { id: 'c1', name: 'Asha', phone: '123', purchaseHistory: [] };
    const invoice: Invoice = {
      id: 'i1', date: new Date(), customer, items: [
        { id: 'p1', name: 'Bandage', cartQuantity: 2, sellingPrice: 10, discountPercent: 0, isCustom: false },
        { id: 'custom', name: 'Custom', cartQuantity: 1, sellingPrice: 3, discountPercent: 0, isCustom: true }
      ], subtotal: 23, total: 23, paymentMode: 'Cash', totalDiscount: 0, amountPaid: 10
    };
    products = signal([product]);
    invoices = signal([invoice]);
    productService = {
      products, isLoading: signal(false), isLoaded: vi.fn(() => false),
      setProducts: vi.fn(), getProductById: vi.fn((id: string) => products().find(item => item.id === id)),
      updateStock: vi.fn().mockResolvedValue(undefined)
    };
    invoiceService = { invoices, isLoading: signal(false), isLoaded: vi.fn(() => false), setInvoices: vi.fn() };
    purchaseService = { purchases: signal([{ finalBillAmount: 30 }]), isLoading: signal(false), setPurchases: vi.fn() };
    expenseService = { expenses: signal([{ amount: 4 }]), isLoading: signal(false), setExpenses: vi.fn() };
    customerService = {
      customers: signal([customer]), isLoading: signal(false), setCustomers: vi.fn()
    };
    httpGet = vi.fn(() => of(null));
    toastService = { success: vi.fn(), error: vi.fn() };
    TestBed.overrideComponent(DashboardComponent, { set: { template: '' } });
    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: HttpClient, useValue: { get: httpGet } },
        { provide: ProductService, useValue: productService },
        { provide: InvoiceService, useValue: invoiceService },
        { provide: PurchaseService, useValue: purchaseService },
        { provide: ExpenseService, useValue: expenseService },
        { provide: CustomerService, useValue: customerService },
        { provide: TranslationService, useValue: {} },
        { provide: ToastService, useValue: toastService }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });
    await TestBed.compileComponents();
    component = TestBed.createComponent(DashboardComponent).componentInstance;
  });

  it('derives KPI totals, low-stock alerts, and product-level sales', () => {
    expect(component.kpiCardsData()).toEqual({ totalSale: 23, totalExpenses: 4, udhar: 13, totalPurchase: 30 });
    expect(component.lowStockProducts().map(product => product.id)).toEqual(['p1']);
    expect(component.topSellingProducts()).toEqual([{ product: products()[0], quantity: 2, revenue: 20 }]);
    expect(component.recentCustomers()[0].orderCount).toBe(1);
  });

  it('loads dashboard collections from the combined API response when neither source is loaded', () => {
    httpGet.mockReturnValue(of({ products: [], invoices: [], purchases: [], expenses: [], customers: [] }));

    component.ngOnInit();

    expect(httpGet).toHaveBeenCalledWith('/api/dashboard');
    expect(productService.setProducts).toHaveBeenCalledWith([]);
    expect(invoiceService.setInvoices).toHaveBeenCalledWith([]);
    expect(productService.isLoading()).toBe(false);
    expect(component.isLoading()).toBe(false);
  });

  it('calculates dashboard timelines and returns recent records in display order', () => {
    const customer = customerService.customers()[0];
    const previous = {
      ...invoices()[0], id: 'older', date: new Date('2020-01-01'), total: 7, amountPaid: 7,
      customer
    };
    invoices.set([previous, ...Array.from({ length: 5 }, (_, index) => ({
      ...invoices()[0], id: `new-${index}`, date: new Date(Date.now() + index * 1000), total: 10 + index,
      customer
    }))]);

    expect(component.recentInvoices()).toHaveLength(4);
    expect(component.recentInvoices()[0].id).toBe('new-4');
    expect(component.recentCustomers()[0].orderCount).toBe(6);
    expect(component.dailySalesData()).toHaveLength(30);
    expect(component.monthlySalesData()).toHaveLength(12);
    expect(component.monthlySalesData().some(month => month.total > 0)).toBe(true);
  });

  it('aggregates repeated product sales and applies fallback stock-alert thresholds', () => {
    const product = products()[0];
    const invoice = invoices()[0];
    invoices.set([
      { ...invoice, items: [{ ...invoice.items[0], cartQuantity: 2, sellingPrice: 10 }] },
      { ...invoice, id: 'repeat', items: [{ ...invoice.items[0], cartQuantity: 3, sellingPrice: 10 }] }
    ]);
    products.set([
      product,
      { ...product, id: 'fallback-alert', name: 'Low', quantity: 5, minStockAlert: 0 },
      { ...product, id: 'above-alert', name: 'In stock', quantity: 6, minStockAlert: 0 }
    ]);

    expect(component.topSellingProducts()).toEqual([{ product, quantity: 5, revenue: 50 }]);
    expect(component.lowStockProducts().map(item => item.id)).toEqual(['p1', 'fallback-alert']);
  });

  it('ranks product sales by quantity and limits the list to five products', () => {
    const rankedProducts = Array.from({ length: 6 }, (_, index) => ({
      ...products()[0],
      id: `rank-${index}`,
      name: `Product ${index}`
    }));
    products.set(rankedProducts);
    productService.getProductById.mockImplementation((id: string) => products().find(item => item.id === id));
    invoices.set([{
      ...invoices()[0],
      items: [
        ...rankedProducts.map((product, index) => ({
          id: product.id,
          name: product.name,
          cartQuantity: index + 1,
          sellingPrice: 10,
          discountPercent: 0,
          isCustom: false
        })),
        { id: 'custom', name: 'Custom', cartQuantity: 100, sellingPrice: 1, discountPercent: 0, isCustom: true }
      ]
    }]);

    expect(component.topSellingProducts().map(sale => sale.product.id)).toEqual([
      'rank-5', 'rank-4', 'rank-3', 'rank-2', 'rank-1'
    ]);
    expect(component.topSellingProducts()[0]).toMatchObject({ quantity: 6, revenue: 60 });
  });

  it('aggregates current-day and current-month invoices while excluding older periods', () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 2);
    const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 2);
    const oldDate = new Date(today.getFullYear() - 2, 0, 2);
    const baseInvoice = invoices()[0];
    const recentAndOldInvoices = [
      { ...baseInvoice, id: 'today', date: today, total: 11 },
      { ...baseInvoice, id: 'yesterday', date: yesterday, total: 7 },
      { ...baseInvoice, id: 'old', date: oldDate, total: 1000 }
    ];
    invoices.set(recentAndOldInvoices);

    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    const dailySales = component.dailySalesData();
    expect(dailySales.find(day => day.date === todayKey)?.total).toBe(11);
    expect(dailySales.find(day => day.date === yesterdayKey)?.total).toBe(7);
    expect(dailySales.reduce((total, day) => total + day.total, 0)).toBe(18);

    invoices.set([
      { ...baseInvoice, id: 'this-month', date: thisMonth, total: 13 },
      { ...baseInvoice, id: 'previous-month', date: previousMonth, total: 17 }
    ]);
    const monthlySales = component.monthlySalesData();
    const currentMonthLabel = thisMonth.toLocaleString('default', { month: 'short', year: '2-digit' });
    const previousMonthLabel = previousMonth.toLocaleString('default', { month: 'short', year: '2-digit' });
    expect(monthlySales.find(month => month.month === currentMonthLabel)?.total).toBe(13);
    expect(monthlySales.find(month => month.month === previousMonthLabel)?.total).toBe(17);
    expect(monthlySales.reduce((total, month) => total + month.total, 0)).toBe(30);
  });

  it('short-circuits already loaded data and clears every loading flag after failure or empty response', () => {
    invoiceService.isLoaded.mockReturnValue(true);
    component.ngOnInit();
    expect(httpGet).not.toHaveBeenCalled();
    expect(productService.isLoading()).toBe(false);

    invoiceService.isLoaded.mockReturnValue(false);
    httpGet.mockReturnValueOnce(of(null));
    component.ngOnInit();
    expect(component.isLoading()).toBe(false);

    httpGet.mockReturnValueOnce(throwError(() => new Error('offline')));
    component.ngOnInit();
    expect(productService.isLoading()).toBe(false);
    expect(invoiceService.isLoading()).toBe(false);
    expect(purchaseService.isLoading()).toBe(false);
    expect(expenseService.isLoading()).toBe(false);
    expect(customerService.isLoading()).toBe(false);
  });

  it('restocks only positive numeric quantities and reports update outcomes', async () => {
    vi.stubGlobal('prompt', vi.fn().mockReturnValue(null));
    await component.restockProduct(products()[0]);
    vi.stubGlobal('prompt', vi.fn().mockReturnValue('not a number'));
    await component.restockProduct(products()[0]);
    vi.stubGlobal('prompt', vi.fn().mockReturnValue('0'));
    await component.restockProduct(products()[0]);
    expect(productService.updateStock).not.toHaveBeenCalled();

    vi.stubGlobal('prompt', vi.fn().mockReturnValue('3'));
    await component.restockProduct(products()[0]);
    expect(productService.updateStock).toHaveBeenCalledWith('p1', 3, 'Purchase', 'Dashboard quick restock');
    expect(toastService.success).toHaveBeenCalledWith('3 units added to Bandage.');

    productService.updateStock.mockRejectedValueOnce(new Error('stock update failed'));
    await component.restockProduct(products()[0]);
    expect(toastService.error).toHaveBeenCalledWith('stock update failed');
    productService.updateStock.mockRejectedValueOnce('unknown error');
    await component.restockProduct(products()[0]);
    expect(toastService.error).toHaveBeenCalledWith('Failed to restock product.');
    vi.unstubAllGlobals();
  });

  it('handles missing chart hosts and both ResizeObserver availability paths', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    component.ngAfterViewInit();
    component.ngOnDestroy();

    const disconnect = vi.fn();
    const observe = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
      observe = observe;
      disconnect = disconnect;
      constructor(_callback: ResizeObserverCallback) {}
    });
    component.ngAfterViewInit();
    expect(observe).not.toHaveBeenCalled();
    component.ngOnDestroy();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('handles top-selling items without a matching product and combines the loading signals', () => {
    const invoice = invoices()[0];
    invoices.set([{
      ...invoice,
      amountPaid: invoice.total + 2,
      items: [
        { id: 'missing', name: 'Missing stock', cartQuantity: 3, sellingPrice: 5, discountPercent: 0, isCustom: false },
        { id: 'custom', name: 'Custom', cartQuantity: 4, sellingPrice: 2, discountPercent: 0, isCustom: true }
      ]
    }]);
    expect(component.topSellingProducts()).toEqual([]);
    expect(component.kpiCardsData().udhar).toBe(0);

    purchaseService.isLoading.set(true);
    expect(component.isLoading()).toBe(true);
    purchaseService.isLoading.set(false);
    customerService.isLoading.set(true);
    expect(component.isLoading()).toBe(true);
  });

  it('renders both charts when hosts exist and observes and disconnects them on resize lifecycle', () => {
    const pnl = document.createElement('div');
    const monthly = document.createElement('div');
    Object.defineProperty(pnl, 'clientWidth', { value: 420 });
    Object.defineProperty(monthly, 'clientWidth', { value: 640 });
    (component as unknown as { pnlChartContainer: { nativeElement: HTMLElement }; monthlySalesChartContainer: { nativeElement: HTMLElement } }).pnlChartContainer = { nativeElement: pnl };
    (component as unknown as { monthlySalesChartContainer: { nativeElement: HTMLElement } }).monthlySalesChartContainer = { nativeElement: monthly };

    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
      constructor(_callback: ResizeObserverCallback) {}
      observe = observe;
      disconnect = disconnect;
    });
    component.ngAfterViewInit();
    expect(pnl.querySelector('svg')).not.toBeNull();
    expect(monthly.querySelectorAll('rect.bar').length).toBe(12);
    expect(observe).toHaveBeenCalledTimes(2);
    component.ngOnDestroy();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('does not render an empty doughnut and handles non-currency chart values', () => {
    const host = document.createElement('div');
    Object.defineProperty(host, 'clientWidth', { value: 320 });
    const drawDoughnut = (component as unknown as { drawDoughnut: (element: HTMLElement, data: unknown[]) => void }).drawDoughnut.bind(component);
    (component as unknown as { pnlChartContainer: { nativeElement: HTMLElement } }).pnlChartContainer = { nativeElement: host };
    invoices.set([]);
    expenseService.expenses.set([]);
    purchaseService.purchases.set([]);
    (component as unknown as { drawPnLChart: () => void }).drawPnLChart();
    expect(host.querySelector('svg')).toBeNull();
    drawDoughnut(host, [{ label: 'Orders', value: 2, color: '#000', isCurrency: false }]);
    expect(host.querySelector('svg')).not.toBeNull();
    expect(host.querySelectorAll('path')).toHaveLength(1);
  });

  it('loads partial dashboard payloads and clears loading after the response', () => {
    invoiceService.isLoaded.mockReturnValue(false);
    httpGet.mockReturnValueOnce(of({ products: [], customers: [] }));
    component.ngOnInit();
    expect(productService.setProducts).toHaveBeenCalledWith([]);
    expect(customerService.setCustomers).toHaveBeenCalledWith([]);
    expect(invoiceService.isLoading()).toBe(false);
    expect(expenseService.isLoading()).toBe(false);
  });
});
