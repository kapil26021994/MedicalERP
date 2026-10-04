import { Component, ChangeDetectionStrategy, inject, signal, ViewChild, ElementRef, computed, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { InvoiceService } from '../../services/invoice.service';
import { SettingsService, INVOICE_TEMPLATES } from '../../services/settings.service';
import { PdfExportService } from '../../services/pdf-export.service';
import { TranslationService } from '../../services/translation.service';
import { ConfirmationService } from '../../services/confirmation.service';
import { LoaderComponent } from '../layout/loader.component';
import { Invoice, InvoiceTemplateId } from '../../models/invoice.model';
import { RouterLink } from '@angular/router';
import { InvoiceTemplatePreviewComponent } from './invoice-template-preview.component';
import html2canvas from 'html2canvas';

@Component({
  selector: 'app-invoices',
  templateUrl: './invoices.component.html',
  imports: [
    CommonModule, 
    CurrencyPipe, 
    DatePipe, 
    RouterLink,
    InvoiceTemplatePreviewComponent,
    LoaderComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoicesComponent implements OnInit {
  invoiceService = inject(InvoiceService);
  settingsService = inject(SettingsService);
  pdfExportService = inject(PdfExportService);
  public ts = inject(TranslationService);
  private confirmationService = inject(ConfirmationService);

  ngOnInit() {
    this.refreshInvoices();
  }

  refreshInvoices() {
    this.invoiceService.fetchInvoicesFromApi(true);
  }

  async deleteInvoice(id: string) {
    const confirmed = await this.confirmationService.confirm({
      title: 'Delete Invoice',
      message: `Are you sure you want to delete invoice ${id}?`,
      confirmText: 'Delete',
      type: 'danger'
    });

    if (confirmed) {
      await this.invoiceService.deleteInvoice(id);
    }
  }

  async deleteAll() {
    const confirmed = await this.confirmationService.confirm({
      title: 'Delete All Invoices',
      message: `Are you sure you want to delete ALL invoices? This action cannot be undone.`,
      confirmText: 'Delete All',
      type: 'danger'
    });

    if (confirmed) {
      await this.invoiceService.deleteAllInvoices();
    }
  }

  selectedIds = signal<Set<string>>(new Set());

  isAllSelected = computed(() => {
    const list = this.paginatedInvoices();
    if (list.length === 0) return false;
    return list.every(inv => this.selectedIds().has(inv.id));
  });

  toggleSelectAll() {
    const list = this.paginatedInvoices();
    const currentSelected = new Set(this.selectedIds());
    if (this.isAllSelected()) {
      list.forEach(inv => currentSelected.delete(inv.id));
    } else {
      list.forEach(inv => currentSelected.add(inv.id));
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
      message: `Are you sure you want to delete ${ids.length} selected invoice(s)?`,
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

  selectedInvoice = signal<Invoice | null>(null);
  showModal = signal(false);
  isFullScreenModal = signal(false);
  
  templateOptions = INVOICE_TEMPLATES;
  activeModalTemplate = signal<InvoiceTemplateId>('modern');

  toggleFullScreenModal() {
    this.isFullScreenModal.update(v => !v);
  }

  @ViewChild('invoiceDetailContent') invoiceContent!: ElementRef<HTMLDivElement>;

  displayedColumns: string[] = ['id', 'date', 'customer', 'payment', 'total', 'due', 'actions'];

  searchTerm = signal('');
  currentPage = signal(1);
  pageSize = signal(10);
  sortBy = signal<'id' | 'date' | 'customer' | 'total' | 'payment' | 'due'>('date');
  sortDirection = signal<'asc' | 'desc'>('desc');

  getDueAmount(invoice: Invoice): number {
    const paid = invoice.amountPaid ?? invoice.total;
    const due = Math.round((invoice.total - paid) * 100) / 100;
    return due > 0 ? due : 0;
  }

  filteredInvoices = computed(() => {
    const term = this.searchTerm().toLowerCase();
    let invoices = [...this.invoiceService.invoices()];
    const sortField = this.sortBy();
    const direction = this.sortDirection();

    if (term) {
      invoices = invoices.filter(inv =>
        inv.id.toLowerCase().includes(term) ||
        (inv.customer?.name || '').toLowerCase().includes(term) ||
        inv.paymentMode.toLowerCase().includes(term)
      );
    }

    invoices.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'id') {
        comparison = a.id.localeCompare(b.id);
      } else if (sortField === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortField === 'customer') {
        comparison = (a.customer?.name || '').localeCompare(b.customer?.name || '');
      } else if (sortField === 'total') {
        comparison = a.total - b.total;
      } else if (sortField === 'payment') {
        comparison = a.paymentMode.localeCompare(b.paymentMode);
      } else if (sortField === 'due') {
        comparison = this.getDueAmount(a) - this.getDueAmount(b);
      }
      return direction === 'asc' ? comparison : -comparison;
    });

    return invoices;
  });

  toggleSort(field: 'id' | 'date' | 'customer' | 'total' | 'payment' | 'due') {
    if (this.sortBy() === field) {
      this.sortDirection.update(dir => dir === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(field);
      this.sortDirection.set(field === 'date' || field === 'total' || field === 'due' ? 'desc' : 'asc');
    }
    this.currentPage.set(1);
  }

  getSortIcon(field: 'id' | 'date' | 'customer' | 'total' | 'payment' | 'due'): string {
    if (this.sortBy() !== field) {
      return 'unfold_more';
    }
    return this.sortDirection() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  paginatedInvoices = computed(() => {
    const invoices = this.filteredInvoices();
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    return invoices.slice(start, start + size);
  });

  totalPages = computed(() => {
    const total = this.filteredInvoices().length;
    return Math.max(1, Math.ceil(total / this.pageSize()));
  });

  startItemIndex = computed(() => {
    if (this.filteredInvoices().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  endItemIndex = computed(() => {
    const total = this.filteredInvoices().length;
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

  onSearch(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    this.currentPage.set(1);
  }

  isPreparingShare = signal(false);
  shareableFile = signal<File | null>(null);

  dueInfo = computed(() => {
    const invoice = this.selectedInvoice();
    if (!invoice || typeof invoice.amountPaid !== 'number') {
      return null;
    }
    const due = Math.round(invoice.total) - invoice.amountPaid;
    return {
      isDue: due >= 0.01,
      label: due >= 0.01 ? 'Balance Due:' : 'Change:',
      value: Math.abs(due)
    };
  });

  viewInvoiceDetails(invoice: Invoice) {
    this.selectedInvoice.set(invoice);
    this.activeModalTemplate.set(invoice.template || this.settingsService.defaultTemplate() || 'modern');
    this.showModal.set(true);
  }

  switchModalTemplate(templateId: InvoiceTemplateId) {
    this.activeModalTemplate.set(templateId);
  }

  closeModal() {
    this.showModal.set(false);
    this.selectedInvoice.set(null);
  }
  
  private async captureInvoiceAsCanvas(): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      if (!this.invoiceContent) {
        return reject('Invoice content element not found.');
      }
      const content = this.invoiceContent.nativeElement;
      const originalStyles = {
        maxHeight: content.style.maxHeight,
        overflowY: content.style.overflowY
      };

      content.style.maxHeight = 'none';
      content.style.overflowY = 'visible';

      requestAnimationFrame(async () => {
        try {
          const canvas = await html2canvas(content, { scale: 2 });
          resolve(canvas);
        } catch (e) {
          reject(e);
        } finally {
          content.style.maxHeight = originalStyles.maxHeight;
          content.style.overflowY = originalStyles.overflowY;
        }
      });
    });
  }


  downloadInvoice(invoiceToDownload?: Invoice) {
    const invoice = invoiceToDownload || this.selectedInvoice();
    if (!invoice) return;
    const templateToUse = this.showModal() ? this.activeModalTemplate() : (invoice.template || this.settingsService.defaultTemplate() || 'modern');
    this.pdfExportService.generateInvoicePdf(invoice, undefined, templateToUse);
  }

  async prepareShare() {
    const invoice = this.selectedInvoice();
    if (!invoice || this.isPreparingShare()) return;

    this.isPreparingShare.set(true);
    
    try {
      const canvas = await this.captureInvoiceAsCanvas();
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));

      if (blob) {
        const file = new File([blob], `Invoice-${invoice.id}.png`, { type: 'image/png' });
        this.shareableFile.set(file);
      } else {
        console.error('Could not create blob from canvas for sharing.');
      }
    } catch (err) {
      console.error("Error preparing shareable image:", err);
    } finally {
      this.isPreparingShare.set(false);
    }
  }

  async executeShare() {
    const file = this.shareableFile();
    const invoice = this.selectedInvoice();
    if (!file || !invoice) return;

    const shopName = this.settingsService.businessProfile()?.shopName || 'our shop';
    const fallbackShare = () => {
      const formattedTotal = `INR ${invoice.total.toFixed(2)}`;
      const invoiceText = `*Invoice Summary from ${shopName}*\n-----------------------------\nInvoice ID: ${invoice.id}\nCustomer: ${invoice.customer?.name || 'Walk-in Customer'}\nTotal Amount: ${formattedTotal}\n-----------------------------\nThank you for your business!`;
      const encodedText = encodeURIComponent(invoiceText);
      window.open(`https://wa.me/?text=${encodedText}`, '_blank');
    };
    
    if (!navigator.share || !navigator.canShare || !navigator.canShare({ files: [file] })) {
      fallbackShare();
      this.clearShare();
      return;
    }

    try {
      await navigator.share({
        files: [file],
        title: `Invoice ${invoice.id}`,
        text: `Invoice for ${invoice.customer?.name || 'Walk-in Customer'} from ${shopName}.`,
      });
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error("Error sharing invoice image:", err);
        fallbackShare();
      }
    } finally {
        this.clearShare();
    }
  }

  clearShare() {
    this.shareableFile.set(null);
  }
}
