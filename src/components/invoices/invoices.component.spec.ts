import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Invoice } from '../../models/invoice.model';
import { InvoiceService } from '../../services/invoice.service';
import { SettingsService } from '../../services/settings.service';
import { PdfExportService } from '../../services/pdf-export.service';
import { TranslationService } from '../../services/translation.service';
import { ConfirmationService } from '../../services/confirmation.service';
import { ToastService } from '../../services/toast.service';
import { InvoicesComponent } from './invoices.component';

const invoice = (id: string, total: number, amountPaid: number): Invoice => ({
  id,
  date: new Date(id.endsWith('1') ? '2026-01-01' : '2026-02-01'),
  customer: { id: `c-${id}`, name: `Customer ${id}`, phone: '555', purchaseHistory: [] },
  items: [],
  subtotal: total,
  total,
  paymentMode: 'Cash',
  totalDiscount: 0,
  amountPaid
});

describe('InvoicesComponent', () => {
  let component: InvoicesComponent;
  let invoiceService: {
    invoices: ReturnType<typeof signal<Invoice[]>>;
    fetchInvoicesFromApi: ReturnType<typeof vi.fn>;
    deleteInvoice: ReturnType<typeof vi.fn>;
    deleteAllInvoices: ReturnType<typeof vi.fn>;
  };
  let confirmationService: { confirm: ReturnType<typeof vi.fn> };
  let pdfExportService: { generateInvoicePdf: ReturnType<typeof vi.fn> };
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    invoiceService = {
      invoices: signal([invoice('INV-1', 100, 60), invoice('INV-2', 50, 50)]),
      fetchInvoicesFromApi: vi.fn(),
      deleteInvoice: vi.fn().mockResolvedValue(undefined),
      deleteAllInvoices: vi.fn().mockResolvedValue(undefined)
    };
    confirmationService = { confirm: vi.fn().mockResolvedValue(true) };
    pdfExportService = { generateInvoicePdf: vi.fn() };
    toastService = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      imports: [InvoicesComponent],
      providers: [
        { provide: InvoiceService, useValue: invoiceService },
        { provide: SettingsService, useValue: { defaultTemplate: () => 'modern', businessProfile: () => ({ shopName: 'Shop' }) } },
        { provide: PdfExportService, useValue: pdfExportService },
        { provide: TranslationService, useValue: {} },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: ToastService, useValue: toastService }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).overrideComponent(InvoicesComponent, { set: { template: '' } });
    component = TestBed.createComponent(InvoicesComponent).componentInstance;
  });

  it('filters, sorts, paginates, and selects only the visible invoices', () => {
    component.pageSize.set(1);
    expect(component.paginatedInvoices()[0].id).toBe('INV-2');
    component.toggleSelectAll();
    expect(component.isAllSelected()).toBe(true);

    component.goToPage(2);
    expect(component.paginatedInvoices()[0].id).toBe('INV-1');
    expect(component.isAllSelected()).toBe(false);
    component.toggleSelection('INV-1');
    expect(component.isAllSelected()).toBe(true);

    component.searchTerm.set('customer inv-2');
    expect(component.filteredInvoices().map(item => item.id)).toEqual(['INV-2']);
    component.toggleSort('id');
    expect(component.currentPage()).toBe(1);
  });

  it('calculates due details and loads invoices on initialization', () => {
    component.viewInvoiceDetails(invoice('INV-3', 80, 30));
    expect(component.dueInfo()).toEqual({ isDue: true, label: 'Balance Due:', value: 50 });
    expect(component.showModal()).toBe(true);
    component.closeModal();
    expect(component.dueInfo()).toBeNull();

    component.ngOnInit();
    expect(invoiceService.fetchInvoicesFromApi).toHaveBeenCalledWith(true);
  });

  it('downloads the selected invoice with its active template and supports sort/page controls', () => {
    component.viewInvoiceDetails(invoice('INV-3', 80, 30));
    component.switchModalTemplate('thermal');
    component.downloadInvoice();
    expect(pdfExportService.generateInvoicePdf).toHaveBeenCalledWith(expect.objectContaining({ id: 'INV-3' }), undefined, 'thermal');
    expect(component.getSortIcon('date')).toBe('arrow_downward');
    component.toggleSort('customer');
    expect(component.getSortIcon('customer')).toBe('arrow_upward');
    component.currentPage.set(2);
    component.onPageSizeChange(1);
    expect(component.currentPage()).toBe(1);
    component.onSearch({ target: { value: 'cash' } } as unknown as Event);
    expect(component.filteredInvoices()).toHaveLength(2);
    component.goToPage(2);
    expect(component.currentPage()).toBe(2);
    component.goToPage(3);
    expect(component.currentPage()).toBe(2);
  });

  it('deletes selected invoices only after confirmation and clears the selection', async () => {
    component.selectedIds.set(new Set(['INV-1', 'INV-2']));
    await component.deleteSelected();
    expect(invoiceService.deleteInvoice).toHaveBeenCalledTimes(2);
    expect(component.selectedIds().size).toBe(0);

    component.selectedIds.set(new Set(['INV-1']));
    confirmationService.confirm.mockResolvedValueOnce(false);
    await component.deleteInvoice('INV-1');
    expect(invoiceService.deleteInvoice).toHaveBeenCalledTimes(2);
  });

  it('covers empty results, sort directions, page indicators, and visible selection behavior', async () => {
    expect(component.startItemIndex()).toBe(1);
    expect(component.endItemIndex()).toBe(2);
    expect(component.totalPages()).toBe(1);
    expect(component.getSortIcon('payment')).toBe('unfold_more');
    for (const field of ['id', 'date', 'customer', 'total', 'payment', 'due'] as const) {
      component.sortBy.set(field);
      component.sortDirection.set('desc');
      component.toggleSort(field);
      expect(component.sortBy()).toBe(field);
      expect(component.sortDirection()).toBe('asc');
      component.toggleSort(field);
      expect(component.sortDirection()).toBe('desc');
    }
    component.toggleFullScreenModal();
    expect(component.isFullScreenModal()).toBe(true);
    component.toggleFullScreenModal();
    expect(component.isFullScreenModal()).toBe(false);

    component.searchTerm.set('does not exist');
    expect(component.startItemIndex()).toBe(0);
    expect(component.endItemIndex()).toBe(0);
    expect(component.isAllSelected()).toBe(false);
    component.toggleSelectAll();
    expect(component.selectedIds().size).toBe(0);
    component.goToPage(0);
    expect(component.currentPage()).toBe(1);
  });

  it('confirms individual, bulk, and all-invoice deletion and reports only successful actions', async () => {
    confirmationService.confirm.mockResolvedValueOnce(true);
    await component.deleteInvoice('INV-1');
    expect(invoiceService.deleteInvoice).toHaveBeenCalledWith('INV-1');
    expect(toastService.success).toHaveBeenCalledWith('Invoice INV-1 deleted.');

    confirmationService.confirm.mockResolvedValueOnce(false);
    await component.deleteAll();
    expect(invoiceService.deleteAllInvoices).not.toHaveBeenCalled();

    confirmationService.confirm.mockResolvedValueOnce(true);
    await component.deleteAll();
    expect(invoiceService.deleteAllInvoices).toHaveBeenCalledOnce();
    expect(toastService.success).toHaveBeenCalledWith('All invoices deleted.');

    component.selectedIds.set(new Set());
    const previousConfirmCount = confirmationService.confirm.mock.calls.length;
    await component.deleteSelected();
    expect(confirmationService.confirm).toHaveBeenCalledTimes(previousConfirmCount);

    component.selectedIds.set(new Set(['INV-1']));
    confirmationService.confirm.mockResolvedValueOnce(false);
    await component.deleteSelected();
    expect(component.selectedIds()).toEqual(new Set(['INV-1']));
  });

  it('exports explicit invoices, handles payment defaults, and guards sharing without a selection', async () => {
    const paidByDefault = { ...invoice('INV-9', 81, 81), amountPaid: undefined };
    expect(component.getDueAmount(paidByDefault)).toBe(0);
    component.viewInvoiceDetails(paidByDefault);
    expect(component.dueInfo()).toBeNull();
    const overpaid = { ...paidByDefault, amountPaid: 90 };
    component.viewInvoiceDetails(overpaid);
    expect(component.dueInfo()).toEqual({ isDue: false, label: 'Change:', value: 9 });
    component.closeModal();
    expect(component.selectedInvoice()).toBeNull();
    component.downloadInvoice();
    expect(pdfExportService.generateInvoicePdf).not.toHaveBeenCalled();
    component.downloadInvoice(overpaid);
    expect(pdfExportService.generateInvoicePdf).toHaveBeenCalledWith(overpaid, undefined, 'modern');

    await component.prepareShare();
    await component.executeShare();
    expect(component.isPreparingShare()).toBe(false);
    expect(component.shareableFile()).toBeNull();
    component.clearShare();
    expect(component.shareableFile()).toBeNull();

    const logError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    component.selectedInvoice.set(overpaid);
    await component.prepareShare();
    expect(component.isPreparingShare()).toBe(false);
    logError.mockRestore();

    const file = new File(['image'], 'invoice.png', { type: 'image/png' });
    component.shareableFile.set(file);
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.stubGlobal('navigator', { share: undefined, canShare: undefined });
    await component.executeShare();
    expect(open).toHaveBeenCalledWith(expect.stringContaining('wa.me'), '_blank');
    expect(component.shareableFile()).toBeNull();

    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, canShare: vi.fn(() => true) });
    component.shareableFile.set(file);
    await component.executeShare();
    expect(share).toHaveBeenCalledWith(expect.objectContaining({
      files: [file],
      title: 'Invoice INV-9'
    }));
    expect(component.shareableFile()).toBeNull();
  });
});
