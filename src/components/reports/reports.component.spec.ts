import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportsComponent } from './reports.component';
import { Invoice } from '../../models/invoice.model';
import { Product } from '../../models/product.model';
import { InvoiceService } from '../../services/invoice.service';
import { ProductService } from '../../services/product.service';
import { PurchaseService } from '../../services/purchase.service';
import { ExpenseService } from '../../services/expense.service';
import { TranslationService } from '../../services/translation.service';

describe('ReportsComponent', () => {
  let component: ReportsComponent;
  let invoices: ReturnType<typeof signal<Invoice[]>>;
  let expenses: ReturnType<typeof signal<{ id: string; date: Date; category: string; description: string; amount: number }[]>>;
  let products: ReturnType<typeof signal<Product[]>>;
  let httpGet: ReturnType<typeof vi.fn>;
  let invoiceService: { invoices: typeof invoices; isLoading: ReturnType<typeof signal<boolean>>; isLoaded: ReturnType<typeof vi.fn>; setInvoices: ReturnType<typeof vi.fn> };
  let productService: { products: typeof products; isLoading: ReturnType<typeof signal<boolean>>; isLoaded: ReturnType<typeof vi.fn>; setProducts: ReturnType<typeof vi.fn> };
  let purchaseService: { purchases: ReturnType<typeof signal<any[]>>; isLoading: ReturnType<typeof signal<boolean>>; setPurchases: ReturnType<typeof vi.fn> };
  let expenseService: { expenses: typeof expenses; isLoading: ReturnType<typeof signal<boolean>>; setExpenses: ReturnType<typeof vi.fn> };

  afterEach(() => TestBed.resetTestingModule());

  beforeEach(async () => {
    const customer = { id: 'c1', name: 'Mina', phone: '555', purchaseHistory: [] };
    const invoice: Invoice = {
      id: 'inv-1', date: new Date(), customer, items: [
        { id: 'p1', name: 'Gauze', cartQuantity: 2, sellingPrice: 12, discountPercent: 0, isCustom: false },
        { id: 'custom', name: 'Custom', cartQuantity: 1, sellingPrice: 5, discountPercent: 0, isCustom: true }
      ], subtotal: 29, total: 29, paymentMode: 'Cash', totalDiscount: 0, amountPaid: 29
    };
    const product: Product = {
      id: 'p1', name: 'Gauze', category: 'Medical', sku: 'G-1', size: 'Free Size',
      color: '', purchasePrice: 7, sellingPrice: 12, discountPercent: 0,
      quantity: 10, minStockAlert: 5, imageUrls: []
    };
    invoices = signal([invoice]);
    products = signal([product]);
    expenses = signal([{ id: 'e1', date: new Date(), category: 'Rent', description: 'Rent', amount: 3 }]);
    httpGet = vi.fn(() => of(null));
    invoiceService = { invoices, isLoading: signal(false), isLoaded: vi.fn(() => true), setInvoices: vi.fn() };
    productService = { products, isLoading: signal(false), isLoaded: vi.fn(() => true), setProducts: vi.fn() };
    purchaseService = { purchases: signal<any[]>([]), isLoading: signal(false), setPurchases: vi.fn() };
    expenseService = { expenses, isLoading: signal(false), setExpenses: vi.fn() };
    TestBed.overrideComponent(ReportsComponent, { set: { template: '' } });
    TestBed.configureTestingModule({
      imports: [ReportsComponent],
      providers: [
        { provide: HttpClient, useValue: { get: httpGet } },
        { provide: InvoiceService, useValue: invoiceService },
        { provide: ProductService, useValue: productService },
        { provide: PurchaseService, useValue: purchaseService },
        { provide: ExpenseService, useValue: expenseService },
        { provide: TranslationService, useValue: {} }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });
    await TestBed.compileComponents();
    component = TestBed.createComponent(ReportsComponent).componentInstance;
  });

  it('summarizes selected-period sales, product costs, and expenses', () => {
    component.setTimeRange('all');
    expect(component.timeRange()).toBe('all');
    expect(component.reportData().kpis).toEqual({
      totalRevenue: 29, totalInvoices: 1, avgOrderValue: 29, netProfit: 12
    });
    expect(component.reportData().salesOverTime).toHaveLength(1);
    expect(component.reportData().pnlData[0]).toMatchObject({
      revenue: 29, cogs: 14, expenses: 3, profit: 12
    });
  });

  it('excludes records outside the selected date range', () => {
    invoices.set([{ ...invoices()[0], date: new Date('2000-01-01T00:00:00Z') }]);
    expect(component.reportData().kpis).toEqual({
      totalRevenue: 0, totalInvoices: 0, avgOrderValue: 0, netProfit: -3
    });
  });

  it('applies short date ranges and excludes invalid dates while aggregating same-day invoices', () => {
    const today = new Date();
    const sameDay = new Date(today);
    sameDay.setHours(12, 0, 0, 0);
    const oldInvoice = { ...invoices()[0], id: 'old', date: new Date('2000-01-01'), total: 1000 };
    const duplicate = { ...invoices()[0], id: 'duplicate', date: sameDay, total: 11 };
    const invalid = { ...invoices()[0], id: 'invalid', date: new Date('invalid'), total: 500 };
    invoices.set([{ ...invoices()[0], date: today }, duplicate, oldInvoice, invalid]);

    component.setTimeRange('7d');
    expect(component.reportData().kpis.totalInvoices).toBe(2);
    expect(component.reportData().kpis.totalRevenue).toBe(40);
    expect(component.reportData().salesOverTime).toHaveLength(1);
    expect(component.reportData().salesOverTime[0].total).toBe(40);
    component.setTimeRange('30d');
    expect(component.reportData().kpis.totalInvoices).toBe(2);
  });

  it('skips loading when data is already loaded and toggles pending flags for API results', () => {
    component.ngOnInit();
    expect(invoiceService.isLoading()).toBe(false);
    expect(httpGet).toHaveBeenCalledWith('/api/reports/summary');
    expect(httpGet).not.toHaveBeenCalledWith('/api/dashboard');

    invoiceService.isLoaded.mockReturnValue(false);
    productService.isLoaded.mockReturnValue(false);
    httpGet.mockReturnValueOnce(of({
      products: [], invoices: [], purchases: [], expenses: []
    }));
    component.ngOnInit();
    expect(invoiceService.setInvoices).toHaveBeenCalledWith([]);
    expect(productService.setProducts).toHaveBeenCalledWith([]);
    expect(purchaseService.setPurchases).toHaveBeenCalledWith([]);
    expect(expenseService.setExpenses).toHaveBeenCalledWith([]);
    expect(component.isLoading()).toBe(false);
  });

  it('clears loading for an empty summary payload and only stores collections returned by the dashboard', () => {
    invoiceService.isLoaded.mockReturnValue(false);
    productService.isLoaded.mockReturnValue(false);
    httpGet.mockReturnValueOnce(of({ products: [] }));

    component.ngOnInit();

    expect(productService.setProducts).toHaveBeenCalledWith([]);
    expect(invoiceService.setInvoices).not.toHaveBeenCalled();
    expect(purchaseService.setPurchases).not.toHaveBeenCalled();
    expect(expenseService.setExpenses).not.toHaveBeenCalled();
    expect(productService.isLoading()).toBe(false);
    expect(invoiceService.isLoading()).toBe(false);
    expect(purchaseService.isLoading()).toBe(false);
    expect(expenseService.isLoading()).toBe(false);
    expect(component.isLoading()).toBe(false);
  });

  it('clears loading indicators after a dashboard API failure and ignores summary-request errors', () => {
    invoiceService.isLoaded.mockReturnValue(false);
    productService.isLoaded.mockReturnValue(false);
    httpGet.mockReturnValueOnce({ subscribe: ({ error }: { error: () => void }) => error() });
    component.ngOnInit();
    expect(invoiceService.isLoading()).toBe(false);
    expect(productService.isLoading()).toBe(false);
    expect(component.isLoading()).toBe(false);

    httpGet.mockReturnValueOnce(throwError(() => new Error('summary endpoint unavailable')));
    expect(() => TestBed.runInInjectionContext(() => new ReportsComponent())).not.toThrow();
  });

  it('handles missing products and non-Date expense records without adding cost or expense', () => {
    const currentInvoice = invoices()[0];
    invoices.set([{
      ...currentInvoice,
      items: [
        { id: 'deleted-product', name: 'Archived item', cartQuantity: 4, sellingPrice: 2, discountPercent: 0, isCustom: false },
        { id: 'custom', name: 'Custom', cartQuantity: 1, sellingPrice: 3, discountPercent: 0, isCustom: true }
      ]
    }]);
    expenses.set([
      ...expenses(),
      { id: 'invalid', date: 'not a date' as unknown as Date, category: 'Other', description: 'Invalid date', amount: 100 },
      { id: 'old', date: new Date('2000-01-01'), category: 'Other', description: 'Old', amount: 100 }
    ]);
    component.setTimeRange('7d');

    expect(component.reportData().kpis.netProfit).toBe(26);
    expect(component.reportData().pnlData[0].cogs).toBe(0);
  });

  it('updates chart data through the view lifecycle without depending on D3 rendering', () => {
    const drawSalesChart = vi.fn();
    const drawPnlChart = vi.fn();
    const privateComponent = component as unknown as {
      drawSalesChart: (data: unknown[]) => void;
      drawPnlChart: (data: unknown[]) => void;
    };
    vi.spyOn(privateComponent, 'drawSalesChart').mockImplementation(drawSalesChart);
    vi.spyOn(privateComponent, 'drawPnlChart').mockImplementation(drawPnlChart);

    component.ngAfterViewInit();

    expect(drawSalesChart).toHaveBeenCalledWith(component.reportData().salesOverTime);
    expect(drawPnlChart).toHaveBeenCalledWith(component.reportData().pnlData);
    productService.isLoading.set(true);
    expect(component.isLoading()).toBe(true);
    productService.isLoading.set(false);
    expenseService.isLoading.set(true);
    expect(component.isLoading()).toBe(true);
  });

  it('draws populated sales and P&L chart DOM and replaces previous SVGs on refresh', () => {
    component.setTimeRange('all');
    const sales = document.createElement('div');
    const pnl = document.createElement('div');
    Object.defineProperty(sales, 'clientWidth', { value: 640 });
    Object.defineProperty(pnl, 'clientWidth', { value: 420 });
    (component as unknown as { salesChartContainer: { nativeElement: HTMLElement }; pnlChartContainer: { nativeElement: HTMLElement } }).salesChartContainer = { nativeElement: sales };
    (component as unknown as { pnlChartContainer: { nativeElement: HTMLElement } }).pnlChartContainer = { nativeElement: pnl };

    component.ngAfterViewInit();
    expect(sales.querySelectorAll('rect.bar')).toHaveLength(1);
    expect(pnl.querySelectorAll('path')).toHaveLength(3);
    component.setTimeRange('7d');
    expect(sales.querySelectorAll('svg')).toHaveLength(1);
    expect(pnl.querySelectorAll('svg')).toHaveLength(1);
  });

  it('clears chart hosts for empty sales and zero-revenue P&L inputs', () => {
    const sales = document.createElement('div');
    const pnl = document.createElement('div');
    const drawSalesChart = (component as unknown as { drawSalesChart: (data: unknown[]) => void }).drawSalesChart.bind(component);
    const drawPnlChart = (component as unknown as { drawPnlChart: (data: unknown[]) => void }).drawPnlChart.bind(component);
    sales.innerHTML = '<svg></svg>';
    pnl.innerHTML = '<svg></svg>';
    (component as unknown as { salesChartContainer: { nativeElement: HTMLElement }; pnlChartContainer: { nativeElement: HTMLElement } }).salesChartContainer = { nativeElement: sales };
    (component as unknown as { pnlChartContainer: { nativeElement: HTMLElement } }).pnlChartContainer = { nativeElement: pnl };
    drawSalesChart([]);
    drawPnlChart([{ period: 'Selected Period', revenue: 0, cogs: 0, expenses: 0, profit: 0 }]);
    expect(sales.querySelector('svg')).toBeNull();
    expect(pnl.querySelector('svg')).toBeNull();
  });

  it('omits negative profit slices from the P&L chart while retaining positive costs', () => {
    const pnl = document.createElement('div');
    Object.defineProperty(pnl, 'clientWidth', { value: 420 });
    const drawPnlChart = (component as unknown as {
      drawPnlChart: (data: unknown[]) => void;
    }).drawPnlChart.bind(component);
    (component as unknown as {
      pnlChartContainer: { nativeElement: HTMLElement };
    }).pnlChartContainer = { nativeElement: pnl };

    drawPnlChart([{
      period: 'Selected Period',
      revenue: 10,
      cogs: 14,
      expenses: 3,
      profit: -7
    }]);

    expect(Array.from(pnl.querySelectorAll('path')).map(path => path.getAttribute('fill'))).toEqual([
      '#f59e0b',
      '#f43f5e'
    ]);
  });

  it('uses stored purchase-price fallback and handles an empty period without division errors', () => {
    products.set([]);
    invoices.set([{ ...invoices()[0], total: 0, items: [
      { id: 'missing', name: 'Missing', cartQuantity: 2, sellingPrice: 4, discountPercent: 0, isCustom: false },
      { id: 'custom', name: 'Custom', cartQuantity: 1, sellingPrice: 5, discountPercent: 0, isCustom: true }
    ] }]);
    expenses.set([]);
    component.setTimeRange('all');
    expect(component.reportData().kpis).toEqual({ totalRevenue: 0, totalInvoices: 1, avgOrderValue: 0, netProfit: 0 });
    expect(component.reportData().pnlData[0].cogs).toBe(0);
  });
});
