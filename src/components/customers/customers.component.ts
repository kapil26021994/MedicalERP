import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Customer } from '../../models/customer.model';
import { CustomerService } from '../../services/customer.service';
import { InvoiceService } from '../../services/invoice.service';
import { TranslationService } from '../../services/translation.service';
import { ConfirmationService } from '../../services/confirmation.service';
import { LoaderComponent } from '../layout/loader.component';

@Component({
  selector: 'app-customers',
  templateUrl: './customers.component.html',
  imports: [
    CommonModule, 
    ReactiveFormsModule,
    CurrencyPipe,
    RouterLink,
    LoaderComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomersComponent implements OnInit {
  private fb: FormBuilder = inject(FormBuilder);
  customerService = inject(CustomerService);
  invoiceService = inject(InvoiceService);
  public ts = inject(TranslationService);
  private confirmationService = inject(ConfirmationService);

  showModal = signal(false);
  editingCustomer = signal<Customer | null>(null);
  searchTerm = signal('');
  
  displayedColumns: string[] = ['name', 'phone', 'email', 'orders', 'spend', 'actions'];
  
  sortBy = signal<'name' | 'phone' | 'email' | 'orders' | 'spend'>('name');
  sortDirection = signal<'asc' | 'desc'>('asc');

  ngOnInit() {
    this.customerService.fetchCustomers();
  }

  // Enrich customers with spending data
  enrichedCustomers = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const invoices = this.invoiceService.invoices();
    const sortField = this.sortBy();
    const direction = this.sortDirection();
    
    let customers = this.customerService.customers()
      .filter(c => 
        c.name.toLowerCase().includes(term) || 
        c.phone.includes(term) || 
        (c.email && c.email.toLowerCase().includes(term))
      )
      .map(customer => {
        const customerInvoices = invoices.filter(inv => inv.customer?.id === customer.id);
        const totalSpend = customerInvoices.reduce((sum, inv) => sum + inv.total, 0);
        return {
          ...customer,
          orderCount: customerInvoices.length,
          totalSpend
        };
      });

    customers.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'phone') {
        comparison = a.phone.localeCompare(b.phone);
      } else if (sortField === 'email') {
        comparison = (a.email || '').localeCompare(b.email || '');
      } else if (sortField === 'orders') {
        comparison = a.orderCount - b.orderCount;
      } else if (sortField === 'spend') {
        comparison = a.totalSpend - b.totalSpend;
      }
      return direction === 'asc' ? comparison : -comparison;
    });

    return customers;
  });

  toggleSort(field: 'name' | 'phone' | 'email' | 'orders' | 'spend') {
    if (this.sortBy() === field) {
      this.sortDirection.update(dir => dir === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(field);
      this.sortDirection.set(field === 'orders' || field === 'spend' ? 'desc' : 'asc');
    }
    this.currentPage.set(1);
  }

  getSortIcon(field: 'name' | 'phone' | 'email' | 'orders' | 'spend'): string {
    if (this.sortBy() !== field) {
      return 'unfold_more';
    }
    return this.sortDirection() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  // Pagination
  currentPage = signal(1);
  pageSize = signal(10);

  paginatedCustomers = computed(() => {
    const customers = this.enrichedCustomers();
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    return customers.slice(start, start + size);
  });

  totalPages = computed(() => {
    const total = this.enrichedCustomers().length;
    return Math.max(1, Math.ceil(total / this.pageSize()));
  });

  startItemIndex = computed(() => {
    if (this.enrichedCustomers().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  endItemIndex = computed(() => {
    const total = this.enrichedCustomers().length;
    return Math.min(this.currentPage() * this.pageSize(), total);
  });

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  onPageSizeChange(size: number) {
    this.pageSize.set(Number(size));
    this.currentPage.set(1);
  }

  customerForm = this.fb.group({
    id: [''],
    name: ['', Validators.required],
    phone: ['', [Validators.required]],
    email: ['', Validators.email],
    dueAmount: [0],
    paidAmount: [0],
    notes: [''],
  });

  modalError = signal<string | null>(null);

  onSearch(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    this.currentPage.set(1);
  }

  openAddModal() {
    this.editingCustomer.set(null);
    this.modalError.set(null);
    this.customerForm.reset();
    this.showModal.set(true);
  }

  openEditModal(customer: Customer) {
    this.editingCustomer.set(customer);
    this.modalError.set(null);
    const { purchaseHistory, ...customerData } = customer;
    this.customerForm.setValue({
      id: customerData.id,
      name: customerData.name,
      phone: customerData.phone,
      email: customerData.email ?? '',
      dueAmount: customerData.dueAmount ?? 0,
      paidAmount: customerData.paidAmount ?? 0,
      notes: customerData.notes ?? ''
    });
    this.showModal.set(true);
  }
  
  closeModal() {
    this.modalError.set(null);
    this.showModal.set(false);
  }

  async deleteCustomer(customer: Customer) {
    const confirmed = await this.confirmationService.confirm({
      title: 'Delete Customer',
      message: `Are you sure you want to delete ${customer.name}? This will remove their record from the database.`,
      confirmText: 'Delete',
      type: 'danger'
    });

    if (confirmed) {
      await this.customerService.deleteCustomer(customer.id);
    }
  }

  selectedIds = signal<Set<string>>(new Set());

  isAllSelected = computed(() => {
    const list = this.paginatedCustomers();
    if (list.length === 0) return false;
    return list.every(c => this.selectedIds().has(c.id));
  });

  toggleSelectAll() {
    const list = this.paginatedCustomers();
    const currentSelected = new Set(this.selectedIds());
    if (this.isAllSelected()) {
      list.forEach(c => currentSelected.delete(c.id));
    } else {
      list.forEach(c => currentSelected.add(c.id));
    }
    this.selectedIds.set(currentSelected);
  }

  toggleSelection(id: string) {
    const currentSelected = new Set(this.selectedIds());
    if (currentSelected.has(id)) {
      currentSelected.delete(id);
    } else {
      currentSelected.add(id);
    }
    this.selectedIds.set(currentSelected);
  }

  async deleteSelected() {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;

    const confirmed = await this.confirmationService.confirm({
      title: 'Delete Selected',
      message: `Are you sure you want to delete ${ids.length} selected customer(s)?`,
      confirmText: 'Delete',
      type: 'danger'
    });

    if (confirmed) {
      for (const id of ids) {
        await this.customerService.deleteCustomer(id);
      }
      this.selectedIds.set(new Set());
    }
  }

  async deleteAll() {
    const confirmed = await this.confirmationService.confirm({
      title: 'Delete All Customers',
      message: `Are you sure you want to delete ALL customers? This action cannot be undone.`,
      confirmText: 'Delete All',
      type: 'danger'
    });

    if (confirmed) {
      await this.customerService.deleteAllCustomers();
    }
  }

  async saveCustomer() {
    if (this.customerForm.invalid) {
      this.customerForm.markAllAsTouched();
      return;
    }
    this.modalError.set(null);
    const formValue = this.customerForm.getRawValue();

    try {
      if (this.editingCustomer()) {
        const updatedCustomer = { ...this.editingCustomer()!, ...formValue } as Customer;
        await this.customerService.updateCustomer(updatedCustomer);
      } else {
        const { id, ...newCustomerData } = formValue;
        await this.customerService.addCustomer(newCustomerData as Omit<Customer, 'id' | 'purchaseHistory'>);
      }
      this.closeModal();
    } catch (err: any) {
      this.modalError.set(err.message || 'Error saving client profile');
    }
  }
}
