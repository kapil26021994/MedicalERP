import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomersComponent } from './customers.component';
import { Customer } from '../../models/customer.model';
import { Invoice } from '../../models/invoice.model';
import { CustomerService } from '../../services/customer.service';
import { InvoiceService } from '../../services/invoice.service';
import { TranslationService } from '../../services/translation.service';
import { ConfirmationService } from '../../services/confirmation.service';
import { ToastService } from '../../services/toast.service';

describe('CustomersComponent', () => {
  let component: CustomersComponent;
  let customers: ReturnType<typeof signal<Customer[]>>;
  let customerService: Record<string, any> & { customers: typeof customers };
  let confirmationService: { confirm: ReturnType<typeof vi.fn> };
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  const initialCustomers: Customer[] = [
    { id: 'c1', name: 'Zara', phone: '111', email: 'zara@example.test', purchaseHistory: [] },
    { id: 'c2', name: 'Amit', phone: '222', purchaseHistory: [] }
  ];

  afterEach(() => TestBed.resetTestingModule());

  beforeEach(async () => {
    customers = signal(initialCustomers);
    const invoices: Invoice[] = [{
      id: 'i1', date: new Date(), customer: initialCustomers[0], items: [],
      subtotal: 40, total: 40, paymentMode: 'Cash', totalDiscount: 0, amountPaid: 20
    }];
    customerService = {
      customers, fetchCustomers: vi.fn(), deleteCustomer: vi.fn().mockResolvedValue(undefined),
      addCustomer: vi.fn().mockResolvedValue(undefined), updateCustomer: vi.fn().mockResolvedValue(undefined),
      deleteAllCustomers: vi.fn().mockResolvedValue(undefined)
    };
    confirmationService = { confirm: vi.fn().mockResolvedValue(true) };
    toastService = { success: vi.fn(), error: vi.fn() };
    TestBed.overrideComponent(CustomersComponent, { set: { template: '' } });
    TestBed.configureTestingModule({
      imports: [CustomersComponent],
      providers: [
        { provide: CustomerService, useValue: customerService },
        { provide: InvoiceService, useValue: { invoices: signal(invoices) } },
        { provide: TranslationService, useValue: {} },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: ToastService, useValue: toastService }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });
    await TestBed.compileComponents();
    component = TestBed.createComponent(CustomersComponent).componentInstance;
  });

  it('enriches customers with invoice counts and spend and supports searching', () => {
    expect(component.enrichedCustomers().map(customer => [customer.id, customer.orderCount, customer.totalSpend])).toEqual([
      ['c2', 0, 0], ['c1', 1, 40]
    ]);
    component.onSearch({ target: { value: 'zara' } } as unknown as Event);
    expect(component.enrichedCustomers().map(customer => customer.id)).toEqual(['c1']);
    expect(component.currentPage()).toBe(1);
  });

  it('selects and clears the current page of customers', () => {
    component.toggleSelectAll();
    expect(component.isAllSelected()).toBe(true);
    component.toggleSelectAll();
    expect(component.selectedIds().size).toBe(0);
  });

  it('fetches customer records during initialization', () => {
    component.ngOnInit();
    expect(customerService.fetchCustomers).toHaveBeenCalledOnce();
  });

  it('supports sorting, pagination, and empty-list page boundaries', () => {
    component.toggleSort('orders');
    expect(component.sortDirection()).toBe('desc');
    expect(component.getSortIcon('orders')).toBe('arrow_downward');
    component.toggleSort('orders');
    expect(component.sortDirection()).toBe('asc');
    expect(component.getSortIcon('phone')).toBe('unfold_more');
    component.toggleSort('phone');
    expect(component.getSortIcon('phone')).toBe('arrow_upward');
    component.toggleSort('phone');
    expect(component.getSortIcon('phone')).toBe('arrow_downward');
    component.toggleSort('email');
    expect(component.enrichedCustomers()[0].id).toBe('c2');
    component.toggleSort('spend');
    expect(component.enrichedCustomers()[0].id).toBe('c1');

    component.pageSize.set(1);
    expect(component.totalPages()).toBe(2);
    component.goToPage(2);
    expect(component.currentPage()).toBe(2);
    component.onPageSizeChange(10);
    expect(component.currentPage()).toBe(1);
    component.onPageSizeChange(1);
    component.goToPage(0);
    expect(component.currentPage()).toBe(1);

    customers.set([]);
    expect(component.totalPages()).toBe(1);
    expect(component.startItemIndex()).toBe(0);
    expect(component.endItemIndex()).toBe(0);
    expect(component.isAllSelected()).toBe(false);
  });

  it('adds and updates customers through their respective valid-form paths', async () => {
    component.openAddModal();
    expect(component.showModal()).toBe(true);
    await component.saveCustomer();
    expect(component.customerForm.controls.name.touched).toBe(true);
    expect(customerService.addCustomer).not.toHaveBeenCalled();

    component.customerForm.setValue({
      id: '', name: 'New client', phone: '555', email: '', dueAmount: 0, paidAmount: 0, notes: ''
    });
    await component.saveCustomer();
    expect(customerService.addCustomer).toHaveBeenCalledWith({
      name: 'New client', phone: '555', email: '', dueAmount: 0, paidAmount: 0, notes: ''
    });
    expect(component.showModal()).toBe(false);

    component.openEditModal(initialCustomers[0]);
    expect(component.customerForm.getRawValue()).toMatchObject({ id: 'c1', name: 'Zara', phone: '111' });
    component.customerForm.patchValue({ name: 'Zara Updated' });
    await component.saveCustomer();
    expect(customerService.updateCustomer).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1', name: 'Zara Updated' }));
    expect(toastService.success).toHaveBeenCalledWith('Customer updated.');
    component.customerForm.patchValue({ name: 'Second failure' });
    customerService.updateCustomer.mockRejectedValueOnce({});
    await component.saveCustomer();
    expect(component.modalError()).toBe('Error saving client profile');
  });

  it('reports save errors and closes the edit modal cleanly', async () => {
    customerService.updateCustomer.mockRejectedValueOnce(new Error('duplicate'));
    component.openEditModal(initialCustomers[0]);
    component.customerForm.patchValue({ name: 'Duplicate' });
    await component.saveCustomer();
    expect(component.modalError()).toBe('duplicate');
    expect(component.showModal()).toBe(true);

    component.closeModal();
    expect(component.modalError()).toBeNull();
    expect(component.showModal()).toBe(false);
  });

  it('confirms individual, selected, and bulk deletions with cancel paths', async () => {
    confirmationService.confirm.mockResolvedValueOnce(false);
    await component.deleteCustomer(initialCustomers[0]);
    expect(customerService.deleteCustomer).not.toHaveBeenCalled();

    await component.deleteCustomer(initialCustomers[0]);
    expect(customerService.deleteCustomer).toHaveBeenCalledWith('c1');
    expect(toastService.success).toHaveBeenCalledWith('Customer "Zara" deleted.');

    await component.deleteSelected();
    expect(confirmationService.confirm).toHaveBeenCalledTimes(2);
    component.selectedIds.set(new Set(['c1', 'c2']));
    await component.deleteSelected();
    expect(customerService.deleteCustomer).toHaveBeenCalledWith('c2');
    expect(component.selectedIds().size).toBe(0);
    expect(toastService.success).toHaveBeenCalledWith('2 customers deleted.');
    component.selectedIds.set(new Set(['c2']));
    await component.deleteSelected();
    expect(toastService.success).toHaveBeenCalledWith('1 customer deleted.');

    confirmationService.confirm.mockResolvedValueOnce(false);
    await component.deleteAll();
    expect(customerService.deleteAllCustomers).not.toHaveBeenCalled();
    await component.deleteAll();
    expect(customerService.deleteAllCustomers).toHaveBeenCalledOnce();
    expect(toastService.success).toHaveBeenCalledWith('All customers deleted.');
  });

  it('toggles individual selection and preserves search reset behavior', () => {
    component.currentPage.set(2);
    component.onSearch({ target: { value: '222' } } as unknown as Event);
    expect(component.searchTerm()).toBe('222');
    expect(component.enrichedCustomers().map(customer => customer.id)).toEqual(['c2']);
    expect(component.currentPage()).toBe(1);
    component.onSearch({ target: { value: 'example.test' } } as unknown as Event);
    expect(component.enrichedCustomers().map(customer => customer.id)).toEqual(['c1']);
    component.toggleSelection('c1');
    expect(component.selectedIds().has('c1')).toBe(true);
    component.toggleSelection('c1');
    expect(component.selectedIds().has('c1')).toBe(false);
  });
});
