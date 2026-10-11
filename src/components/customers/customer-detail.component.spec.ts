import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CustomerDetailComponent } from './customer-detail.component';
import { Customer } from '../../models/customer.model';
import { Invoice } from '../../models/invoice.model';
import { CustomerService } from '../../services/customer.service';
import { InvoiceService } from '../../services/invoice.service';

describe('CustomerDetailComponent', () => {
  let component: CustomerDetailComponent;
  const params = new BehaviorSubject<{ id: string }>({ id: 'c1' });
  const customer: Customer = { id: 'c1', name: 'Asha', phone: '123', email: 'asha@example.test', purchaseHistory: [] };
  let customers: ReturnType<typeof signal<Customer[]>>;
  let invoices: ReturnType<typeof signal<Invoice[]>>;
  let customerLoading: ReturnType<typeof signal<boolean>>;
  let invoiceLoading: ReturnType<typeof signal<boolean>>;

  afterEach(() => TestBed.resetTestingModule());

  beforeEach(async () => {
    params.next({ id: 'c1' });
    const initialInvoices: Invoice[] = [
      { id: 'older', date: new Date('2024-01-01'), customer, items: [], subtotal: 20, total: 20, paymentMode: 'Cash', totalDiscount: 0, amountPaid: 10 },
      { id: 'newer', date: new Date('2024-02-01'), customer, items: [], subtotal: 30, total: 30, paymentMode: 'UPI', totalDiscount: 0, amountPaid: 25 },
      { id: 'other', date: new Date('2024-03-01'), customer: { ...customer, id: 'c2' }, items: [], subtotal: 50, total: 50, paymentMode: 'Card', totalDiscount: 0, amountPaid: 50 }
    ];
    customers = signal([customer]);
    invoices = signal(initialInvoices);
    customerLoading = signal(false);
    invoiceLoading = signal(false);
    TestBed.configureTestingModule({
      imports: [CustomerDetailComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { params } },
        { provide: CustomerService, useValue: { customers, isLoading: customerLoading } },
        { provide: InvoiceService, useValue: { invoices, isLoading: invoiceLoading } }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });
    await TestBed.compileComponents();
    const fixture = TestBed.createComponent(CustomerDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows only the selected customer invoices and computes payment totals', () => {
    expect(component.customer()?.id).toBe('c1');
    expect(component.invoices().map(invoice => invoice.id)).toEqual(['newer', 'older']);
    expect(component.totalSpend()).toBe(50);
    expect(component.totalPaid()).toBe(35);
    expect(component.totalOutstanding()).toBe(15);
    expect(component.lastPaymentDate()?.toISOString()).toContain('2024-02-01');
  });

  it('returns an empty ledger when the route points at an unknown customer', () => {
    params.next({ id: 'missing' });
    expect(component.customer()).toBeUndefined();
    expect(component.invoices()).toEqual([]);
    expect(component.lastPaymentDate()).toBeNull();
  });

  it('exposes combined service loading state and handles a route without an id', () => {
    expect(component.isLoading()).toBe(false);
    customerLoading.set(true);
    expect(component.isLoading()).toBe(true);
    customerLoading.set(false);
    invoiceLoading.set(true);
    expect(component.isLoading()).toBe(true);
    invoiceLoading.set(false);

    params.next({} as { id: string });
    expect(component.customer()).toBeNull();
    expect(component.invoices()).toEqual([]);
    expect(component.totalSpend()).toBe(0);
    expect(component.totalPaid()).toBe(0);
    expect(component.totalOutstanding()).toBe(0);
  });

  it('renders the customer ledger, optional contact details, loading state, and empty history', () => {
    const fixture = TestBed.createComponent(CustomerDetailComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Asha');
    expect(fixture.nativeElement.textContent).toContain('Purchase History & Invoices');
    expect(fixture.nativeElement.textContent).toContain('newer');

    customerLoading.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Syncing Profile Data...');
    customerLoading.set(false);

    params.next({ id: 'missing' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Customer Profile Not Found');

    params.next({ id: 'c1' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Customer Profile Not Found');
  });

  it('renders a profile without optional contact details or invoice history', () => {
    customers.set([{ ...customer, email: undefined }]);
    invoices.set([]);
    params.next({ id: 'c1' });

    const fixture = TestBed.createComponent(CustomerDetailComponent);
    fixture.detectChanges();

    expect(component.invoices()).toEqual([]);
    expect(component.totalSpend()).toBe(0);
    expect(component.totalPaid()).toBe(0);
    expect(component.totalOutstanding()).toBe(0);
    expect(component.lastPaymentDate()).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('asha@example.test');
    expect(fixture.nativeElement.textContent).toContain('No purchase records for this customer');
    expect(fixture.nativeElement.textContent).not.toContain('Last Transaction:');
  });

  it('treats an unset invoice payment as zero paid with the full bill outstanding', () => {
    invoices.set([{
      id: 'unpaid',
      date: new Date('2024-04-01'),
      customer,
      items: [],
      subtotal: 45,
      total: 45,
      paymentMode: 'Cash',
      totalDiscount: 0,
      amountPaid: 0
    }]);

    expect(component.totalPaid()).toBe(0);
    expect(component.totalOutstanding()).toBe(45);
  });
});
