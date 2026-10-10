import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, DOCUMENT } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormArray, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { InvoiceService } from '../../services/invoice.service';
import { CustomerService } from '../../services/customer.service';
import { ProductService } from '../../services/product.service';
import { PurchaseService } from '../../services/purchase.service';
import { SettingsService, INVOICE_TEMPLATES } from '../../services/settings.service';
import { PdfExportService } from '../../services/pdf-export.service';
import { SupabaseService } from '../../services/supabase.service';
import { ToastService } from '../../services/toast.service';
import { Customer } from '../../models/customer.model';
import { Product } from '../../models/product.model';
import { Invoice, CartItem, InvoiceTemplateId } from '../../models/invoice.model';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, startWith } from 'rxjs';
import { convertImageToTableJS } from '../../utils/imageToTableConverter';
import { buildInventoryListItems } from '../../utils/inventory-list';
import { InvoiceTemplatePreviewComponent } from './invoice-template-preview.component';

@Component({
  selector: 'app-invoice-form',
  templateUrl: './invoice-form.component.html',
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    RouterLink, 
    CurrencyPipe,
    InvoiceTemplatePreviewComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceFormComponent implements OnInit, OnDestroy {
  private fb: FormBuilder = inject(FormBuilder);
  private document = inject(DOCUMENT);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private invoiceService = inject(InvoiceService);
  customerService = inject(CustomerService);
  productService = inject(ProductService);
  private purchaseService = inject(PurchaseService);
  settingsService = inject(SettingsService);
  pdfExportService = inject(PdfExportService);
  supabaseService = inject(SupabaseService);
  private toastService = inject(ToastService);

  @ViewChild('invoicePreview') invoicePreview!: ElementRef<HTMLDivElement>;

  invoiceForm: FormGroup = this.fb.group({
    customer: [null],
    phone: [''],
    date: [new Date().toISOString().split('T')[0], Validators.required],
    paymentMode: ['Cash' as const, Validators.required],
    items: this.fb.array([]),
    amountPaid: [0],
    dueAmount: [0],
    notes: ['']
  });
  
  // State
  invoiceId = toSignal(this.route.params.pipe(map(p => p['id'])));
  isEditMode = computed(() => !!this.invoiceId());
  pageTitle = computed(() => this.isEditMode() ? 'Edit Transaction' : 'New Sales Voucher');
  draftInvoiceId = `DRAFT-${Math.floor(1000 + Math.random() * 9000)}`;

  // Template Selection
  templateOptions = INVOICE_TEMPLATES;
  selectedTemplate = signal<InvoiceTemplateId>('modern');
  showTemplatePreviewModal = signal(false);
  isFullScreenPreview = signal(false);

  selectTemplate(templateId: InvoiceTemplateId) {
    this.selectedTemplate.set(templateId);
  }

  toggleTemplatePreview() {
    this.showTemplatePreviewModal.update(v => !v);
  }

  toggleFullScreenPreview() {
    this.isFullScreenPreview.update(v => !v);
  }

  previewInvoiceData = computed<Invoice>(() => {
    const formValue = this.invoiceForm.getRawValue();
    const invoiceItems: CartItem[] = (formValue.items || []).map((item: any, idx: number): CartItem => ({
      id: item.product?.id || `preview-${idx}`,
      name: item.product?.name || this.productSearchTerms()[idx] || 'Sample Item',
      cartQuantity: Number(item.cartQuantity) || 1,
      sellingPrice: Number(item.sellingPrice) || 0,
      discountPercent: Number(item.discountPercent) || 0,
      isCustom: true,
      sku: item.product?.sku || 'PREVIEW'
    }));

    return {
      id: this.isEditMode() ? this.invoiceId()! : this.draftInvoiceId,
      date: formValue.date ? new Date(formValue.date) : new Date(),
      customer: formValue.customer || { name: this.customerSearchControl.value || 'Walk-in Customer', phone: '9999999999' },
      items: invoiceItems.length > 0 ? invoiceItems : [
        { id: '1', name: 'Sample Item Line', cartQuantity: 1, sellingPrice: 499, discountPercent: 0, isCustom: false }
      ],
      subtotal: this.totals().subtotal || 499,
      totalDiscount: this.totals().discount || 0,
      total: this.roundedTotal() || 499,
      paymentMode: formValue.paymentMode || 'Cash',
      amountPaid: formValue.amountPaid || 499,
      notes: formValue.notes || '',
      template: this.selectedTemplate()
    };
  });
  
  // Customer Search
  customerSearchControl = this.fb.control('');
  filteredCustomers = toSignal(
    this.customerSearchControl.valueChanges.pipe(
      startWith(''),
      map(value => {
        const term = (typeof value === 'string' ? value : (value as any)?.name || '').toLowerCase();
        return this.customerService.customers().filter(c => 
          c.name.toLowerCase().includes(term) || c.phone.includes(term)
        );
      })
    ), { initialValue: [] as Customer[] }
  );

  // Quick Add State
  showAddCustomerModal = signal(false);
  newCustomerForm = this.fb.group({
    name: ['', Validators.required],
    phone: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
    email: ['', Validators.email]
  });

  // Product Search State
  productSearchTerms = signal<string[]>([]);
  showAddProductModal = signal(false);
  activeProductDropdown = signal<number | null>(null);
  showCustomerDropdown = signal<boolean>(false);

  // Inventory Modal State for loading items from inventory section
  showInventoryModal = signal(false);
  inventorySearchTerm = signal('');
  inventoryCategoryFilter = signal('All');
  targetRowIndex = signal<number | null>(null);
  selectedInventoryProductIds = signal<Set<string>>(new Set());
  private previousDocumentOverflow: { body: string; root: string } | null = null;

  inventoryCatalogProducts = computed(() => {
    const procurementRows = [
      ...this.purchaseService.procurementItems(),
      ...this.purchaseService.extractProcurementItemsFromPurchases(this.purchaseService.purchases())
    ];
    return buildInventoryListItems(procurementRows, this.productService.products());
  });

  inventoryCategories = computed(() => [
    'All',
    ...new Set(this.inventoryCatalogProducts().map(item => item.catalogProduct.category))
  ]);

  filteredInventoryProducts = computed(() => {
    const term = this.inventorySearchTerm().toLowerCase().trim();
    const cat = this.inventoryCategoryFilter();
    return this.inventoryCatalogProducts().filter(p => {
      const matchCat = cat === 'All' || p.catalogProduct.category === cat;
      const matchTerm = !term ||
        p.catalogProduct.name.toLowerCase().includes(term) ||
        p.catalogProduct.sku.toLowerCase().includes(term) ||
        String(p.batchNo || p.batch_no || '').toLowerCase().includes(term);
      return matchCat && matchTerm;
    });
  });

  selectedInventoryProductCount = computed(() => {
    const selectedIds = this.selectedInventoryProductIds();
    return new Set(
      this.inventoryCatalogProducts()
        .filter(item => selectedIds.has(item.inventoryKey))
        .map(item => item.catalogProduct.id)
    ).size;
  });

  openInventoryModal(rowIndex?: number) {
    this.targetRowIndex.set(rowIndex !== undefined ? rowIndex : null);
    this.inventorySearchTerm.set('');
    this.inventoryCategoryFilter.set('All');
    this.selectedInventoryProductIds.set(new Set());
    this.lockDocumentScroll();
    this.showInventoryModal.set(true);
  }

  closeInventoryModal() {
    this.showInventoryModal.set(false);
    this.targetRowIndex.set(null);
    this.selectedInventoryProductIds.set(new Set());
    this.restoreDocumentScroll();
  }

  ngOnDestroy(): void {
    this.restoreDocumentScroll();
  }

  private lockDocumentScroll(): void {
    if (this.previousDocumentOverflow) return;
    const body = this.document.body;
    const root = this.document.documentElement;
    this.previousDocumentOverflow = {
      body: body.style.overflow,
      root: root.style.overflow
    };
    body.style.overflow = 'hidden';
    root.style.overflow = 'hidden';
  }

  private restoreDocumentScroll(): void {
    if (!this.previousDocumentOverflow) return;
    this.document.body.style.overflow = this.previousDocumentOverflow.body;
    this.document.documentElement.style.overflow = this.previousDocumentOverflow.root;
    this.previousDocumentOverflow = null;
  }

  toggleInventoryProduct(productId: string): void {
    this.selectedInventoryProductIds.update(selected => {
      const updated = new Set(selected);
      if (updated.has(productId)) {
        updated.delete(productId);
      } else {
        updated.add(productId);
      }
      return updated;
    });
  }

  areAllFilteredInventoryProductsSelected(): boolean {
    const products = this.filteredInventoryProducts();
    const selected = this.selectedInventoryProductIds();
    return products.length > 0 && products.every(product => selected.has(product.inventoryKey));
  }

  toggleSelectAllInventoryProducts(): void {
    const products = this.filteredInventoryProducts();
    if (this.areAllFilteredInventoryProductsSelected()) {
      this.selectedInventoryProductIds.update(selected => {
        const updated = new Set(selected);
        products.forEach(product => updated.delete(product.inventoryKey));
        return updated;
      });
      return;
    }

    this.selectedInventoryProductIds.update(selected => {
      const updated = new Set(selected);
      products.forEach(product => updated.add(product.inventoryKey));
      return updated;
    });
  }

  addSelectedInventoryProducts(): void {
    const selectedIds = this.selectedInventoryProductIds();
    const selectedItems = this.inventoryCatalogProducts().filter(item => selectedIds.has(item.inventoryKey));
    const products = [...new Map(
      selectedItems.map(item => [item.catalogProduct.id, item.catalogProduct])
    ).values()];
    if (products.length === 0) return;

    const targetIndex = this.targetRowIndex();
    let nextIndex = targetIndex !== null && targetIndex < this.items.length ? targetIndex : null;

    products.forEach(product => {
      if (nextIndex === null) {
        const lastIndex = this.items.length - 1;
        const lastItem = this.items.at(lastIndex)?.value;
        const lastTerm = (this.productSearchTerms()[lastIndex] || '').trim();
        if (lastIndex >= 0 && !lastItem?.product?.id && !lastTerm) {
          nextIndex = lastIndex;
        } else {
          this.addItem();
          nextIndex = this.items.length - 1;
        }
      }

      this.selectProduct(product, nextIndex);
      nextIndex = null;
    });

    this.closeInventoryModal();
  }

  private itemsValue = toSignal(
    this.invoiceForm.get('items')!.valueChanges.pipe(startWith(this.invoiceForm.get('items')!.value))
  );

  private amountPaidSignal = toSignal(
      this.invoiceForm.get('amountPaid')!.valueChanges.pipe(startWith(this.invoiceForm.get('amountPaid')!.value))
  );

  totals = computed(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    
    const rawItems = (this.itemsValue() as any[]) || [];
    for (const item of rawItems) {
      if (item) {
        const price = Number(item.sellingPrice) || 0;
        const quantity = Number(item.cartQuantity) || 0;
        const discountPercent = Number(item.discountPercent) || 0;

        const lineSubtotal = price * quantity;
        const lineDiscount = (lineSubtotal * discountPercent) / 100;
        
        subtotal += lineSubtotal;
        totalDiscount += lineDiscount;
      }
    }

    const total = subtotal - totalDiscount;
    return { subtotal, discount: totalDiscount, total };
  });

  getItemLineTotal(itemGroupValue: any): number {
    if (!itemGroupValue) return 0;
    const price = Number(itemGroupValue.sellingPrice) || 0;
    const quantity = Number(itemGroupValue.cartQuantity) || 0;
    const discountPercent = Number(itemGroupValue.discountPercent) || 0;
    const lineSubtotal = price * quantity;
    return lineSubtotal - (lineSubtotal * discountPercent) / 100;
  }

  roundedTotal = computed(() => Math.round(this.totals().total));
  
  balance = computed(() => {
    const total = this.roundedTotal();
    const paid = Number(this.amountPaidSignal()) || 0;
    return total - paid;
  });

  ngOnInit() {
    this.invoiceService.fetchInvoicesFromApi();
    this.productService.fetchProductsFromApi();
    this.purchaseService.fetchPurchasesFromApi();
    this.selectedTemplate.set(this.settingsService.defaultTemplate() || 'modern');

    if (this.isEditMode()) {
      const invoice = this.invoiceService.getInvoiceById(this.invoiceId()!);
      if (invoice) {
        if (invoice.template) {
          this.selectedTemplate.set(invoice.template);
        }
        this.populateForm(invoice);
      } else {
        this.router.navigate(['/invoices']);
      }
    } else {
      this.addItem(); 
    }

    // Sync due amount
    this.invoiceForm.get('items')?.valueChanges.subscribe(() => {
      this.updateBalance();
    });

    this.invoiceForm.get('amountPaid')?.valueChanges.subscribe(() => {
      this.updateBalance();
    });
  }

  private updateBalance() {
    const total = this.roundedTotal();
    const paid = this.invoiceForm.get('amountPaid')?.value || 0;
    this.invoiceForm.get('dueAmount')?.patchValue(total - paid, { emitEvent: false });
  }
  
  get items(): FormArray {
    return this.invoiceForm.get('items') as FormArray;
  }

  isProcessingInvoice = signal(false);

  async onInvoiceImageSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.isProcessingInvoice.set(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const fullBase64 = e.target?.result as string;

      try {
        let extractedData: any = null;
        try {
          const sessionToken = this.supabaseService.currentSession()?.access_token || this.supabaseService.anonKey();
          const anonKey = this.supabaseService.anonKey();
          const reqHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
          if (sessionToken) reqHeaders['Authorization'] = `Bearer ${sessionToken}`;
          if (anonKey) reqHeaders['apikey'] = anonKey;

          const apiResponse = await fetch('/api/parse-invoice', {
            method: 'POST',
            headers: reqHeaders,
            body: JSON.stringify({ image: fullBase64 })
          });
          if (apiResponse.ok) {
            extractedData = await apiResponse.json();
          }
        } catch (err) {
          console.warn('Server parse failed, falling back to client OCR:', err);
        }

        if (!extractedData || !extractedData.rows || extractedData.rows.length === 0) {
          extractedData = await convertImageToTableJS(file);
        }

        const availableProducts = this.productService.products();

        if (extractedData.supplierName) {
          const matchedCust = this.customerService.customers().find(c => c.name.toLowerCase().includes(extractedData.supplierName.toLowerCase()));
          if (matchedCust) {
            this.selectCustomer(matchedCust);
          }
        }

        if (extractedData.date) {
          try {
            const d = new Date(extractedData.date);
            if (!isNaN(d.getTime())) {
              this.invoiceForm.patchValue({ date: d.toISOString().split('T')[0] });
            }
          } catch (e) {}
        }

        this.items.clear();
        const searchTerms: string[] = [];

        const extractedRows = (extractedData.rows || []).filter((row: any) =>
          (row.itemDescription || row.description || row.name || '').trim().length > 0
        );
        if (extractedRows.length > 0) {
          extractedRows.forEach((row: any) => {
            const itemName = (row.itemDescription || row.description || row.name).trim();
            const exactMatch = availableProducts.find(p => p.name.toLowerCase() === itemName.toLowerCase());
            
            const sellingPrice = row.mrp || row.rate || exactMatch?.sellingPrice || 100;
            const cartQuantity = row.quantity || 1;
            const discountPercent = row.discountPercent || exactMatch?.discountPercent || 0;

            const productObj = exactMatch || {
              id: `extracted-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              name: itemName,
              sku: row.hsnCode || 'OCR',
              sellingPrice: sellingPrice,
              quantity: 99,
              category: 'General'
            };

            const group = this.fb.group({
              product: [productObj, Validators.required],
              cartQuantity: [cartQuantity, [Validators.required, Validators.min(1)]],
              sellingPrice: [sellingPrice, [Validators.required, Validators.min(0)]],
              discountPercent: [discountPercent, [Validators.min(0), Validators.max(100)]]
            });
            this.items.push(group);
            searchTerms.push(itemName);
          });
        } else {
          alert('No product line items were detected in the image. Please check the image or add the items manually.');
          this.addItem();
        }

        this.productSearchTerms.set(searchTerms);

        if (extractedData.totalAmount) {
          this.invoiceForm.patchValue({ amountPaid: Math.round(extractedData.totalAmount) });
        } else {
          setTimeout(() => {
            this.invoiceForm.patchValue({ amountPaid: this.roundedTotal() });
          }, 100);
        }

      } catch (error) {
        console.error('Error parsing invoice image:', error);
        alert('Could not parse image. Please add items manually.');
      } finally {
        this.isProcessingInvoice.set(false);
      }
    };
    reader.readAsDataURL(file);
    (event.target as HTMLInputElement).value = '';
  }

  populateForm(invoice: Invoice) {
    this.invoiceForm.patchValue({
        date: new Date(invoice.date).toISOString().split('T')[0],
        paymentMode: invoice.paymentMode,
        amountPaid: invoice.amountPaid,
        dueAmount: invoice.total - invoice.amountPaid,
        phone: invoice.customer?.phone === 'N/A' ? '' : (invoice.customer?.phone || ''),
        notes: invoice.notes || ''
    }, { emitEvent: false });

    this.customerSearchControl.setValue(invoice.customer?.name || '', { emitEvent: false });
    this.invoiceForm.get('customer')?.setValue(invoice.customer);
    
    this.items.clear();
    invoice.items.forEach(item => {
        const product = item.isCustom ? { id: item.id, name: item.name, isCustom: true } : this.productService.getProductById(item.id);
        const group = this.fb.group({
            product: [product, Validators.required],
            cartQuantity: [item.cartQuantity, [Validators.required, Validators.min(1)]],
            sellingPrice: [item.sellingPrice, [Validators.required, Validators.min(0)]],
            discountPercent: [item.discountPercent, [Validators.min(0), Validators.max(100)]]
        });
        this.items.push(group);
        this.productSearchTerms.update(terms => [...terms, item.name]);
    });
  }

  createItem(): FormGroup {
    return this.fb.group({
      product: [null],
      cartQuantity: [1, [Validators.required, Validators.min(1)]],
      sellingPrice: [0, [Validators.required, Validators.min(0)]],
      discountPercent: [0, [Validators.min(0), Validators.max(100)]]
    });
  }

  addItem(): void {
    this.items.push(this.createItem());
    this.productSearchTerms.update(terms => [...terms, '']);
  }

  removeItem(index: number): void {
    this.items.removeAt(index);
    this.productSearchTerms.update(terms => terms.filter((_, i) => i !== index));
    if (this.items.length === 0) {
      this.addItem();
    }
  }

  // --- Customer Selection ---
  displayCustomer(customer: Customer | string): string {
    if (typeof customer === 'string') return customer;
    return customer ? customer.name : '';
  }

  selectCustomer(customer: Customer) {
    this.invoiceForm.get('customer')?.setValue(customer);
    this.invoiceForm.patchValue({ phone: customer.phone === 'N/A' ? '' : customer.phone });
    this.customerSearchControl.setValue(customer.name, { emitEvent: false });
    this.showCustomerDropdown.set(false);
  }

  // --- Product Selection ---
  displayProduct(product: Product | any): string {
    return product ? product.name : '';
  }

  selectProduct(product: Product, index: number) {
    const item = this.items.at(index);
    item.patchValue({
      product: product,
      sellingPrice: product.sellingPrice,
      discountPercent: product.discountPercent,
    });
    this.productSearchTerms.update(terms => {
      terms[index] = product.name;
      return [...terms];
    });
    this.activeProductDropdown.set(null); // Hide dropdown immediately

    // Auto add next row if this was the last row
    if (index === this.items.length - 1) {
      this.addItem();
    }
  }

  selectCustomProduct(searchTerm: string, index: number) {
    const name = searchTerm.trim() || 'Custom Item';
    const currentPrice = this.items.at(index).get('sellingPrice')?.value || 0;
    const currentDisc = this.items.at(index).get('discountPercent')?.value || 0;
    
    const customProduct = {
      id: `custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: name,
      sku: 'MANUAL',
      sellingPrice: currentPrice,
      discountPercent: currentDisc,
      quantity: 999,
      minStockAlert: 0,
      category: 'General',
      isCustom: true
    };

    const item = this.items.at(index);
    item.patchValue({
      product: customProduct
    });

    this.productSearchTerms.update(terms => {
      terms[index] = name;
      return [...terms];
    });

    this.activeProductDropdown.set(null); // Hide dropdown immediately

    // Auto add next row if this was the last row
    if (index === this.items.length - 1) {
      this.addItem();
    }
  }

  onProductInputChange(term: string, index: number) {
    this.productSearchTerms.update(terms => {
      terms[index] = term;
      return [...terms];
    });
    this.activeProductDropdown.set(index); // Show dropdown for current row

    const trimmed = (term || '').trim().toLowerCase();
    if (trimmed) {
      // Check for exact SKU match (ideal for barcode scanners or typed SKUs)
      const exactMatch = this.productService.products().find(p => 
        (p.sku && p.sku.toLowerCase() === trimmed) || (p.name && p.name.toLowerCase() === trimmed)
      );
      if (exactMatch) {
        this.selectProduct(exactMatch, index);
        return;
      }
    }

    // Auto update underlying item product if no database product or if custom
    const itemGroup = this.items.at(index);
    const currProd = itemGroup.get('product')?.value;
    if (!currProd || currProd.isCustom || currProd.name !== term) {
      itemGroup.patchValue({
        product: {
          id: currProd?.id || `custom-${Date.now()}-${index}`,
          name: term || 'Custom Item',
          sku: 'MANUAL',
          sellingPrice: itemGroup.get('sellingPrice')?.value || 0,
          discountPercent: itemGroup.get('discountPercent')?.value || 0,
          quantity: 999,
          minStockAlert: 0,
          category: 'General',
          isCustom: true
        }
      }, { emitEvent: true });
    }
  }

  onProductInputEnter(index: number) {
    const matches = this.filteredProducts(index);
    if (matches.length > 0) {
      this.selectProduct(matches[0], index);
    }
  }

  filteredProducts(index: number) {
    const term = (this.productSearchTerms()[index] || '').toLowerCase().trim();
    if (!term) return this.productService.products().slice(0, 8);
    return this.productService.products().filter(p => 
      p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)
    );
  }

  // --- Quick Add ---
  openAddCustomerModal() {
    this.newCustomerForm.reset({ name: this.customerSearchControl.value || '' });
    this.showAddCustomerModal.set(true);
  }

  async saveNewCustomer() {
    if (this.newCustomerForm.invalid) return;
    const newCustomer = await this.customerService.addCustomer(this.newCustomerForm.getRawValue() as any);
    this.toastService.success('Customer added.');
    this.customerSearchControl.setValue(newCustomer.name);
    this.selectCustomer(newCustomer);
    this.showAddCustomerModal.set(false);
  }

  // --- Actions ---
  async saveInvoice(): Promise<void> {
    // 1. Remove trailing completely blank rows (if more than 1 row exists)
    for (let i = this.items.length - 1; i >= 0; i--) {
      const itemVal = this.items.at(i).value;
      const term = (this.productSearchTerms()[i] || '').trim();
      const hasProduct = itemVal?.product && (itemVal.product.name || itemVal.product.id);
      if (!hasProduct && !term && (!itemVal.sellingPrice || itemVal.sellingPrice === 0) && this.items.length > 1) {
        this.removeItem(i);
      }
    }

    // 2. Resolve Customer
    let selectedCust = this.invoiceForm.get('customer')?.value;
    const custSearchName = (this.customerSearchControl.value || '').trim();
    if (!selectedCust || (typeof selectedCust === 'object' && selectedCust.name !== custSearchName && custSearchName !== '')) {
      const existingCust = this.customerService.customers().find(c => c.name.toLowerCase() === custSearchName.toLowerCase());
      if (existingCust) {
        selectedCust = existingCust;
      } else {
        selectedCust = {
          id: `cust-${Date.now()}`,
          name: custSearchName || 'Walk-in Customer',
          phone: this.invoiceForm.get('phone')?.value || 'N/A'
        };
      }
      this.invoiceForm.get('customer')?.setValue(selectedCust);
    } else if (!selectedCust) {
      selectedCust = {
        id: `cust-walkin`,
        name: 'Walk-in Customer',
        phone: 'N/A'
      };
      this.invoiceForm.get('customer')?.setValue(selectedCust);
    }

    // 3. Resolve Custom Products for any rows with missing product object
    this.items.controls.forEach((group, idx) => {
      const itemVal = group.value;
      const term = (this.productSearchTerms()[idx] || '').trim();
      if (!itemVal?.product || !itemVal.product.name) {
        group.patchValue({
          product: {
            id: `custom-${Date.now()}-${idx}`,
            name: term || `Item ${idx + 1}`,
            sku: 'MANUAL',
            sellingPrice: Number(itemVal?.sellingPrice) || 0,
            discountPercent: Number(itemVal?.discountPercent) || 0,
            quantity: 999,
            minStockAlert: 0,
            category: 'General',
            isCustom: true
          }
        });
      }
    });

    const formValue = this.invoiceForm.getRawValue();
    
    const invoiceItems: CartItem[] = formValue.items.map((item: any, idx: number): CartItem => {
      const prodName = item.product?.name || this.productSearchTerms()[idx] || `Item ${idx + 1}`;
      return {
        id: item.product?.id || `custom-${idx}`,
        name: prodName,
        cartQuantity: Number(item.cartQuantity) || 1,
        sellingPrice: Number(item.sellingPrice) || 0,
        discountPercent: Number(item.discountPercent) || 0,
        isCustom: !item.product?.id || item.product?.isCustom,
        sku: item.product?.sku || 'MANUAL',
        imageUrl: item.product?.imageUrls?.[0] || 'https://picsum.photos/200/200'
      };
    });

    const paidAmount = (typeof formValue.amountPaid === 'number' && !isNaN(formValue.amountPaid)) 
      ? formValue.amountPaid 
      : this.roundedTotal();

    const finalInvoice: Omit<Invoice, 'id'> = {
      date: formValue.date ? new Date(formValue.date) : new Date(),
      customer: formValue.customer,
      items: invoiceItems,
      subtotal: this.totals().subtotal,
      totalDiscount: this.totals().discount,
      total: this.roundedTotal(),
      paymentMode: formValue.paymentMode || 'Cash',
      amountPaid: paidAmount,
      notes: formValue.notes || '',
      template: this.selectedTemplate()
    };

    try {
      if (this.isEditMode()) {
        await this.invoiceService.updateInvoice({ ...finalInvoice, id: this.invoiceId()! });
        this.toastService.success('Invoice updated.');
      } else {
        await this.invoiceService.addInvoice({ ...finalInvoice, id: this.invoiceService.generateNewInvoiceId() });
        this.toastService.success('Invoice created.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Invoice could not be saved:', error);
      alert(`Invoice could not be saved. ${message}`);
      return;
    }

    this.router.navigate(['/invoices']);
  }

  downloadInvoicePdf() {
    const formValue = this.invoiceForm.getRawValue();
    if (!formValue.customer || !formValue.items || formValue.items.length === 0) return;

    const invoiceItems: CartItem[] = formValue.items.map((item: any): CartItem => ({
        id: item.product?.id || 'cust-item',
        name: item.product?.name || 'Item',
        cartQuantity: item.cartQuantity || 1,
        sellingPrice: item.sellingPrice || 0,
        discountPercent: item.discountPercent || 0,
        isCustom: !!item.product?.isCustom,
        sku: item.product?.sku || 'N/A'
    }));

    const previewInvoice: Invoice = {
      id: this.isEditMode() ? this.invoiceId()! : this.draftInvoiceId,
      date: new Date(formValue.date),
      customer: formValue.customer,
      items: invoiceItems,
      subtotal: this.totals().subtotal,
      totalDiscount: this.totals().discount,
      total: this.roundedTotal(),
      paymentMode: formValue.paymentMode,
      amountPaid: formValue.amountPaid,
      notes: formValue.notes || '',
      template: this.selectedTemplate()
    };

    this.pdfExportService.generateInvoicePdf(previewInvoice, undefined, this.selectedTemplate());
  }

  async prepareShare() {
    // Logic as before
  }
}