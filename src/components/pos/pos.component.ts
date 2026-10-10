import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { CustomerService } from '../../services/customer.service';
import { InvoiceService } from '../../services/invoice.service';
import { CartService, ParkedTransaction } from '../../services/cart.service';
import { PdfExportService } from '../../services/pdf-export.service';
import { ToastService } from '../../services/toast.service';
import { TranslationService } from '../../services/translation.service';
import { LoaderComponent } from '../layout/loader.component';
import { Product } from '../../models/product.model';
import { Customer } from '../../models/customer.model';
import { Invoice } from '../../models/invoice.model';

@Component({
  selector: 'app-pos',
  templateUrl: './pos.component.html',
  imports: [
    CommonModule, 
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    FormsModule,
    LoaderComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PosComponent implements OnInit, OnDestroy {
  productService = inject(ProductService);
  customerService = inject(CustomerService);
  invoiceService = inject(InvoiceService);
  cartService = inject(CartService);
  pdfExportService = inject(PdfExportService);
  private toastService = inject(ToastService);
  public ts = inject(TranslationService);
  private router = inject(Router);
  private fb: FormBuilder = inject(FormBuilder);

  // Search and filter state
  searchTerm = signal('');
  selectedCategory = signal('All');
  inStockOnly = signal(false);
  barcodeInput = signal('');
  scanFeedback = signal<{ message: string; isError: boolean } | null>(null);

  // Customer state
  selectedCustomer = signal<Customer>({
    id: 'cust-walkin',
    name: 'Walk-in Customer',
    phone: 'N/A',
    email: '',
    purchaseHistory: []
  });
  showCustomerModal = signal(false);
  customerSearch = signal('');

  // Cash Tender & Running Calculation State
  tenderAmount = signal<number>(0);
  showCheckoutModal = signal(false);
  showSuccessModal = signal(false);
  showParkedModal = signal(false);
  lastCompletedInvoice = signal<Invoice | null>(null);

  // Active Transaction ticket reference
  activeTransactionRef = signal<string>(`TXN-${Math.floor(1000 + Math.random() * 9000)}`);

  checkoutForm = this.fb.group({
    paymentMode: ['Cash' as 'Cash' | 'Card' | 'UPI', Validators.required],
    amountPaid: [0, [Validators.required, Validators.min(0)]],
    notes: ['']
  });

  // Derived categories with count
  categories = computed(() => ['All', ...new Set(this.productService.products().map(p => p.category))]);

  categoryCounts = computed(() => {
    const products = this.productService.products();
    const counts: Record<string, number> = { All: products.length };
    products.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return counts;
  });

  // Filtered product catalog
  filteredProducts = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const category = this.selectedCategory();
    const stockOnly = this.inStockOnly();

    return this.productService.products().filter(p => {
      const inCategory = category === 'All' || p.category === category;
      const matchesStock = !stockOnly || p.quantity > 0;
      const matchesTerm = !term || 
        p.name.toLowerCase().includes(term) || 
        p.sku.toLowerCase().includes(term) ||
        (p.description && p.description.toLowerCase().includes(term));
      
      return inCategory && matchesStock && matchesTerm;
    });
  });

  // Filtered customers for customer switcher
  filteredCustomers = computed(() => {
    const search = this.customerSearch().toLowerCase().trim();
    const list = this.customerService.customers();
    if (!search) return list;
    return list.filter(c => 
      c.name.toLowerCase().includes(search) || 
      c.phone.toLowerCase().includes(search) ||
      (c.email && c.email.toLowerCase().includes(search))
    );
  });

  // Running change due calculation
  changeDue = computed(() => {
    const paid = this.tenderAmount();
    const total = this.cartService.total();
    return paid > total ? Math.round((paid - total) * 100) / 100 : 0;
  });

  ngOnInit() {
    this.productService.fetchProductsFromApi();
    this.customerService.fetchCustomers();
    this.invoiceService.fetchInvoicesFromApi();

    const walking = this.customerService.getWalkingCustomer();
    if (walking) {
      this.selectedCustomer.set(walking);
    }
  }

  ngOnDestroy(): void {}

  // Add product to transaction
  addToCart(product: Product) {
    if (product.quantity <= 0) return;
    this.cartService.addItem(product);
  }

  // Quick Barcode / SKU Scan or enter
  onScanBarcode(event?: Event) {
    if (event) event.preventDefault();
    const code = this.barcodeInput().trim().toUpperCase();
    if (!code) return;

    const matched = this.productService.products().find(p => 
      p.sku.toUpperCase() === code || 
      p.name.toUpperCase().includes(code)
    );

    if (matched) {
      if (matched.quantity <= 0) {
        this.triggerScanFeedback(`Out of stock: ${matched.name}`, true);
      } else {
        this.cartService.addItem(matched);
        this.triggerScanFeedback(`Added: ${matched.name}`);
        this.barcodeInput.set('');
      }
    } else {
      this.triggerScanFeedback(`No product found for code "${code}"`, true);
    }
  }

  private triggerScanFeedback(message: string, isError: boolean = false) {
    this.scanFeedback.set({ message, isError });
    setTimeout(() => {
      this.scanFeedback.set(null);
    }, 2600);
  }

  onSearch(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  clearSearch() {
    this.searchTerm.set('');
  }

  // Customer Management
  selectCustomer(customer: Customer) {
    this.selectedCustomer.set(customer);
    this.showCustomerModal.set(false);
  }

  setWalkingCustomer() {
    const walking = this.customerService.getWalkingCustomer() || {
      id: 'cust-walkin',
      name: 'Walk-in Customer',
      phone: 'N/A',
      email: '',
      purchaseHistory: []
    };
    this.selectedCustomer.set(walking);
    this.showCustomerModal.set(false);
  }

  // Quick Cash Tender presets
  setExactTender() {
    this.tenderAmount.set(this.cartService.total());
    this.checkoutForm.patchValue({ amountPaid: this.cartService.total() });
  }

  addTenderPreset(amount: number) {
    const current = this.tenderAmount() || 0;
    const next = current + amount;
    this.tenderAmount.set(next);
    this.checkoutForm.patchValue({ amountPaid: next });
  }

  setCustomTender(amount: number) {
    this.tenderAmount.set(amount);
    this.checkoutForm.patchValue({ amountPaid: amount });
  }

  // Park / Hold Transaction
  parkActiveTransaction() {
    const custName = this.selectedCustomer().name;
    const ok = this.cartService.parkCurrentTransaction(custName);
    if (ok) {
      this.activeTransactionRef.set(`TXN-${Math.floor(1000 + Math.random() * 9000)}`);
      this.triggerScanFeedback(`Transaction held for ${custName}`);
    }
  }

  restoreParked(parked: ParkedTransaction) {
    this.cartService.restoreParkedTransaction(parked.id);
    this.showParkedModal.set(false);
    this.activeTransactionRef.set(parked.id.replace('TXN-PARK-', 'TXN-'));
    this.triggerScanFeedback(`Restored order for ${parked.customerName}`);
  }

  removeParked(id: string) {
    this.cartService.removeParkedTransaction(id);
  }

  // Checkout flow
  openCheckout() {
    const total = this.cartService.total();
    const paid = this.tenderAmount() > 0 ? this.tenderAmount() : total;
    this.tenderAmount.set(paid);
    this.checkoutForm.patchValue({ amountPaid: paid });
    this.showCheckoutModal.set(true);
  }

  async completeSale() {
    if (this.checkoutForm.invalid || this.cartService.items().length === 0) return;

    const val = this.checkoutForm.value;
    const items = this.cartService.items();
    const customer = this.selectedCustomer();
    const finalTotal = this.cartService.total();

    const newInvoice: Invoice = {
      id: this.invoiceService.generateNewInvoiceId(),
      date: new Date(),
      customer: customer,
      items: items,
      subtotal: this.cartService.subtotal(),
      totalDiscount: this.cartService.totalDiscount(),
      total: finalTotal,
      paymentMode: val.paymentMode || 'Cash',
      amountPaid: Number(val.amountPaid) || finalTotal,
      notes: val.notes || ''
    };

    // Save invoice & deduct product stock (centrally handled by InvoiceService)
    await this.invoiceService.addInvoice(newInvoice);
    this.toastService.success(`Sale ${newInvoice.id} completed.`);

    this.showCheckoutModal.set(false);
    this.cartService.clearCart();
    this.lastCompletedInvoice.set(newInvoice);
    this.showSuccessModal.set(true);
    this.tenderAmount.set(0);
    this.activeTransactionRef.set(`TXN-${Math.floor(1000 + Math.random() * 9000)}`);

    // Auto generate/download PDF receipt
    this.pdfExportService.generateInvoicePdf(newInvoice, undefined, 'thermal');
  }

  downloadInvoicePdf(template: 'thermal' | 'modern' = 'thermal') {
    const inv = this.lastCompletedInvoice();
    if (inv) {
      this.pdfExportService.generateInvoicePdf(inv, undefined, template);
    }
  }

  startNewSale() {
    this.showSuccessModal.set(false);
    this.lastCompletedInvoice.set(null);
    this.setWalkingCustomer();
    this.tenderAmount.set(0);
  }

  goToInvoices() {
    this.showSuccessModal.set(false);
    this.router.navigate(['/invoices']);
  }
}