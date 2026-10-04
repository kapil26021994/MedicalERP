import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InvoiceService } from '../../services/invoice.service';
import { CustomerService } from '../../services/customer.service';
import { ProductService } from '../../services/product.service';
import { PdfExportService } from '../../services/pdf-export.service';
import { TranslationService } from '../../services/translation.service';
import { ConfirmationService } from '../../services/confirmation.service';
import { LoaderComponent } from '../layout/loader.component';
import { Invoice, CartItem } from '../../models/invoice.model';
import { Product } from '../../models/product.model';

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, RouterLink, FormsModule, LoaderComponent],
  templateUrl: './sales.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SalesComponent implements OnInit {
  invoiceService = inject(InvoiceService);
  customerService = inject(CustomerService);
  productService = inject(ProductService);
  pdfExportService = inject(PdfExportService);
  public ts = inject(TranslationService);
  private confirmationService = inject(ConfirmationService);
  private route = inject(ActivatedRoute);

  ngOnInit() {
    this.invoiceService.fetchInvoicesFromApi(true);
    this.customerService.fetchCustomers();
    this.productService.fetchProductsFromApi(true);

    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'inventory') {
        this.activeTab.set('inventory');
      }
    });

    if (typeof window !== 'undefined' && window.location.pathname.includes('/inventory')) {
      this.activeTab.set('inventory');
    }
  }

  activeTab = signal<'register' | 'inventory' | 'items' | 'customers' | 'analytics'>('register');
  searchTerm = signal('');
  productSearchTerm = signal('');
  stockFilter = signal<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  dateFilter = signal<'all' | 'today' | 'this_week' | 'this_month'>('all');
  paymentFilter = signal<'all' | 'paid' | 'due' | 'cash' | 'upi' | 'card'>('all');

  selectedSale = signal<Invoice | null>(null);
  showDetailModal = signal(false);

  // Payment Recording Modal State
  showPaymentModal = signal(false);
  paymentSale = signal<Invoice | null>(null);
  paymentAmountInput = signal<number>(0);
  paymentModeInput = signal<'Cash' | 'UPI' | 'Card'>('UPI');

  // Sorting
  sortBy = signal<'date' | 'total' | 'due' | 'customer'>('date');
  sortDirection = signal<'asc' | 'desc'>('desc');

  // Helper function to calculate due amount on an invoice
  getDueAmount(invoice: Invoice): number {
    const paid = invoice.amountPaid ?? invoice.total;
    const due = Math.round((invoice.total - paid) * 100) / 100;
    return due > 0 ? due : 0;
  }

  getPaymentStatus(invoice: Invoice): { label: string; class: string } {
    const due = this.getDueAmount(invoice);
    if (due <= 0) {
      return { label: 'Paid', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
    const paid = invoice.amountPaid ?? 0;
    if (paid > 0) {
      return { label: 'Partial', class: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
    return { label: 'Unpaid Dues', class: 'bg-rose-50 text-rose-700 border-rose-200' };
  }

  filteredSales = computed(() => {
    let sales = [...this.invoiceService.invoices()];
    const term = this.searchTerm().toLowerCase().trim();
    const dateRange = this.dateFilter();
    const payStatus = this.paymentFilter();

    // Search filter
    if (term) {
      sales = sales.filter(s =>
        s.id.toLowerCase().includes(term) ||
        (s.customer?.name || '').toLowerCase().includes(term) ||
        (s.customer?.phone || '').includes(term) ||
        (s.paymentMode || '').toLowerCase().includes(term) ||
        s.items.some(i => (i.name || '').toLowerCase().includes(term))
      );
    }

    // Date filter
    const now = new Date();
    if (dateRange === 'today') {
      const todayStr = now.toDateString();
      sales = sales.filter(s => new Date(s.date).toDateString() === todayStr);
    } else if (dateRange === 'this_week') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      sales = sales.filter(s => new Date(s.date) >= oneWeekAgo);
    } else if (dateRange === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      sales = sales.filter(s => new Date(s.date) >= firstDay);
    }

    // Payment filter
    if (payStatus === 'paid') {
      sales = sales.filter(s => this.getDueAmount(s) <= 0);
    } else if (payStatus === 'due') {
      sales = sales.filter(s => this.getDueAmount(s) > 0);
    } else if (['cash', 'upi', 'card'].includes(payStatus)) {
      sales = sales.filter(s => (s.paymentMode || '').toLowerCase() === payStatus);
    }

    // Sort
    const sortField = this.sortBy();
    const isAsc = this.sortDirection() === 'asc';
    sales.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortField === 'total') {
        comparison = a.total - b.total;
      } else if (sortField === 'due') {
        comparison = this.getDueAmount(a) - this.getDueAmount(b);
      } else if (sortField === 'customer') {
        comparison = (a.customer?.name || '').localeCompare(b.customer?.name || '');
      }
      return isAsc ? comparison : -comparison;
    });

    return sales;
  });

  // KPI Metrics
  totalSalesVolume = computed(() => this.filteredSales().length);

  totalGrossSales = computed(() => {
    return Math.round(this.filteredSales().reduce((acc, s) => acc + s.total, 0) * 100) / 100;
  });

  totalCollected = computed(() => {
    return Math.round(this.filteredSales().reduce((acc, s) => acc + (s.amountPaid ?? s.total), 0) * 100) / 100;
  });

  totalOutstandingDues = computed(() => {
    return Math.round(this.filteredSales().reduce((acc, s) => acc + this.getDueAmount(s), 0) * 100) / 100;
  });

  collectionPercentage = computed(() => {
    const total = this.totalGrossSales();
    if (total <= 0) return 100;
    return Math.min(100, Math.round((this.totalCollected() / total) * 100));
  });

  dueSalesCount = computed(() => {
    return this.filteredSales().filter(s => this.getDueAmount(s) > 0).length;
  });

  averageOrderValue = computed(() => {
    const count = this.totalSalesVolume();
    return count > 0 ? Math.round((this.totalGrossSales() / count) * 100) / 100 : 0;
  });

  todaySalesTotal = computed(() => {
    const todayStr = new Date().toDateString();
    return Math.round(
      this.invoiceService.invoices()
        .filter(s => new Date(s.date).toDateString() === todayStr)
        .reduce((acc, s) => acc + s.total, 0) * 100
    ) / 100;
  });

  todaySalesCount = computed(() => {
    const todayStr = new Date().toDateString();
    return this.invoiceService.invoices().filter(s => new Date(s.date).toDateString() === todayStr).length;
  });

  // Analytics: Top Selling Products
  topSellingProducts = computed(() => {
    const productMap = new Map<string, { id: string; name: string; sku: string; qty: number; revenue: number }>();

    for (const sale of this.invoiceService.invoices()) {
      for (const item of sale.items) {
        const prodId = item.id || item.name;
        const existing = productMap.get(prodId) || {
          id: item.id || '',
          name: item.name,
          sku: item.sku || 'N/A',
          qty: 0,
          revenue: 0
        };
        const itemQty = item.cartQuantity || 1;
        const price = item.sellingPrice || 0;
        existing.qty += itemQty;
        existing.revenue += (price * itemQty);
        productMap.set(prodId, existing);
      }
    }

    return Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 15);
  });

  // Analytics: Customer Sales Leaderboard
  customerSalesSummary = computed(() => {
    const custMap = new Map<string, { name: string; phone: string; salesCount: number; totalSpent: number; totalDues: number }>();

    for (const sale of this.invoiceService.invoices()) {
      const custName = sale.customer?.name || 'Walk-in Customer';
      const phone = sale.customer?.phone || 'N/A';
      const key = `${custName}_${phone}`;

      const existing = custMap.get(key) || {
        name: custName,
        phone,
        salesCount: 0,
        totalSpent: 0,
        totalDues: 0
      };

      existing.salesCount += 1;
      existing.totalSpent += sale.total;
      existing.totalDues += this.getDueAmount(sale);
      custMap.set(key, existing);
    }

    return Array.from(custMap.values())
      .sort((a, b) => b.totalSpent - a.totalSpent);
  });

  // Product Stock Inventory List
  filteredInventoryProducts = computed(() => {
    let prods = [...this.productService.products()];
    const term = this.productSearchTerm().toLowerCase().trim();
    const filter = this.stockFilter();

    if (term) {
      prods = prods.filter(p => 
        (p.name || '').toLowerCase().includes(term) ||
        (p.sku || '').toLowerCase().includes(term) ||
        (p.category || '').toLowerCase().includes(term)
      );
    }

    if (filter === 'low_stock') {
      prods = prods.filter(p => p.quantity > 0 && p.quantity <= (p.minStockAlert || 5));
    } else if (filter === 'out_of_stock') {
      prods = prods.filter(p => p.quantity <= 0);
    } else if (filter === 'in_stock') {
      prods = prods.filter(p => p.quantity > (p.minStockAlert || 5));
    }

    return prods;
  });

  adjustProductStock(product: Product, delta: number) {
    this.productService.updateStock(
      product.id, 
      delta, 
      'Adjustment', 
      `Quick stock adjustment (${delta > 0 ? '+' : ''}${delta})`,
      product.sku,
      product.name
    );
  }

  // Payment Mode Breakdown
  paymentModeBreakdown = computed(() => {
    const modes: Record<string, { count: number; total: number }> = {
      'Cash': { count: 0, total: 0 },
      'UPI': { count: 0, total: 0 },
      'Card': { count: 0, total: 0 }
    };

    for (const sale of this.filteredSales()) {
      const mode = sale.paymentMode || 'Cash';
      if (!modes[mode]) {
        modes[mode] = { count: 0, total: 0 };
      }
      modes[mode].count += 1;
      modes[mode].total += sale.total;
    }

    return Object.keys(modes).map(m => ({
      mode: m,
      count: modes[m].count,
      total: Math.round(modes[m].total * 100) / 100
    }));
  });

  toggleSort(field: 'date' | 'total' | 'due' | 'customer') {
    if (this.sortBy() === field) {
      this.sortDirection.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(field);
      this.sortDirection.set(field === 'date' || field === 'total' || field === 'due' ? 'desc' : 'asc');
    }
  }

  getSortIcon(field: 'date' | 'total' | 'due' | 'customer'): string {
    if (this.sortBy() !== field) return 'unfold_more';
    return this.sortDirection() === 'asc' ? 'expand_less' : 'expand_more';
  }

  viewSaleDetails(sale: Invoice) {
    this.selectedSale.set(sale);
    this.showDetailModal.set(true);
  }

  closeModal() {
    this.showDetailModal.set(false);
    this.selectedSale.set(null);
  }

  openRecordPaymentModal(sale: Invoice, event: Event) {
    event.stopPropagation();
    const due = this.getDueAmount(sale);
    this.paymentSale.set(sale);
    this.paymentAmountInput.set(due);
    this.paymentModeInput.set('UPI');
    this.showPaymentModal.set(true);
  }

  closePaymentModal() {
    this.showPaymentModal.set(false);
    this.paymentSale.set(null);
  }

  async submitPaymentRecord() {
    const sale = this.paymentSale();
    const payAmt = Number(this.paymentAmountInput());
    if (!sale || payAmt <= 0) return;

    const currentPaid = sale.amountPaid ?? 0;
    const newPaid = Math.min(sale.total, Math.round((currentPaid + payAmt) * 100) / 100);

    const updatedSale: Invoice = {
      ...sale,
      amountPaid: newPaid,
      paymentMode: this.paymentModeInput()
    };

    await this.invoiceService.updateInvoice(updatedSale);
    this.closePaymentModal();
    if (this.selectedSale()?.id === sale.id) {
      this.selectedSale.set(updatedSale);
    }
  }

  sendWhatsAppReminder(sale: Invoice, event?: Event) {
    if (event) event.stopPropagation();
    const due = this.getDueAmount(sale);
    const custName = sale.customer?.name || 'Customer';
    const text = `Hello ${custName}, friendly reminder regarding your Bill #${sale.id} total ₹${sale.total}. Outstanding balance due is ₹${due}. Thank you for your business!`;
    window.open(`https://wa.me/${sale.customer?.phone || ''}?text=${encodeURIComponent(text)}`, '_blank');
  }

  downloadSalePdf(sale: Invoice, event?: Event) {
    if (event) event.stopPropagation();
    this.pdfExportService.generateInvoicePdf(sale);
  }

  exportSalesCsv() {
    const sales = this.filteredSales();
    if (sales.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Invoice ID,Date,Customer Name,Customer Phone,Items Count,Total Amount,Amount Paid,Due Amount,Payment Mode\n";

    sales.forEach(s => {
      const due = this.getDueAmount(s);
      const paid = s.amountPaid ?? s.total;
      const custName = (s.customer?.name || 'Walk-in').replace(/,/g, ' ');
      const phone = s.customer?.phone || '';
      const dateStr = new Date(s.date).toLocaleDateString('en-IN');
      csvContent += `${s.id},${dateStr},"${custName}",${phone},${s.items.length},${s.total},${paid},${due},${s.paymentMode}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `AdvikaERP_Sales_Register_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async deleteSale(sale: Invoice, event?: Event) {
    if (event) event.stopPropagation();
    
    const confirmed = await this.confirmationService.confirm({
      title: 'Delete Sale',
      message: `Are you sure you want to delete sale #${sale.id}?`,
      confirmText: 'Delete',
      type: 'danger'
    });

    if (confirmed) {
      await this.invoiceService.deleteInvoice(sale.id);
    }
  }

  async deleteAll() {
    const confirmed = await this.confirmationService.confirm({
      title: 'Delete All Sales',
      message: `Are you sure you want to delete ALL sales records? This action cannot be undone.`,
      confirmText: 'Delete All',
      type: 'danger'
    });

    if (confirmed) {
      await this.invoiceService.deleteAllInvoices();
    }
  }

  selectedIds = signal<Set<string>>(new Set());

  isAllSelected = computed(() => {
    const list = this.filteredSales();
    if (list.length === 0) return false;
    return list.every(s => this.selectedIds().has(s.id));
  });

  toggleSelectAll() {
    const list = this.filteredSales();
    const currentSelected = new Set(this.selectedIds());
    if (this.isAllSelected()) {
      list.forEach(s => currentSelected.delete(s.id));
    } else {
      list.forEach(s => currentSelected.add(s.id));
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
      message: `Are you sure you want to delete ${ids.length} selected sale record(s)?`,
      confirmText: 'Delete',
      type: 'danger'
    });

    if (confirmed) {
      for (const id of ids) {
        await this.invoiceService.deleteInvoice(id);
      }
      this.selectedIds.set(new Set());
    }
  }
}
