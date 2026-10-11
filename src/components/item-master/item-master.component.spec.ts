import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Product } from '../../models/product.model';
import { PurchaseService } from '../../services/purchase.service';
import { ProductService } from '../../services/product.service';
import { ConfirmationService } from '../../services/confirmation.service';
import { SupabaseService } from '../../services/supabase.service';
import { ToastService } from '../../services/toast.service';
import { ItemMasterComponent } from './item-master.component';

describe('ItemMasterComponent', () => {
  let component: ItemMasterComponent;
  let products: ReturnType<typeof signal<Product[]>>;
  let procurementItems: ReturnType<typeof signal<{ id: string; productId: string; productName: string; sku: string; quantity: number; freeQty: number; costPrice: number; supplier: string; purchaseDate: Date; batchNo: string }[]>>;
  let purchases: ReturnType<typeof signal<any[]>>;
  let confirmationService: { confirm: ReturnType<typeof vi.fn> };
  let http: { post: ReturnType<typeof vi.fn> };
  let productService: { products: typeof products; fetchProductsFromApi: ReturnType<typeof vi.fn> };
  let purchaseService: { procurementItems: typeof procurementItems; purchases: typeof purchases; extractProcurementItemsFromPurchases: ReturnType<typeof vi.fn>; fetchPurchasesFromApi: ReturnType<typeof vi.fn> };
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let supabaseService: { client: ReturnType<typeof vi.fn>; isConfigured: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    const product: Product = {
      id: 'p1', name: 'Bandage', category: 'Medical', sku: 'B-1', size: 'Free Size', color: '',
      purchasePrice: 5, sellingPrice: 10, discountPercent: 0, quantity: 4, minStockAlert: 5, imageUrls: []
    };
    products = signal([product]);
    procurementItems = signal([{
      id: 'proc1', productId: 'p1', productName: 'Bandage', sku: 'B-1', quantity: 10, freeQty: 1,
      costPrice: 5, supplier: 'North Medical', purchaseDate: new Date('2026-01-01'), batchNo: 'A-1'
    }]);
    purchases = signal<any[]>([]);
    productService = { products, fetchProductsFromApi: vi.fn() };
    purchaseService = {
      procurementItems,
      purchases,
      extractProcurementItemsFromPurchases: vi.fn(() => []),
      fetchPurchasesFromApi: vi.fn()
    };
    confirmationService = { confirm: vi.fn().mockResolvedValue(false) };
    http = { post: vi.fn(() => of({ databaseSynced: true })) };
    toastService = { success: vi.fn(), error: vi.fn() };
    supabaseService = { client: vi.fn(() => null), isConfigured: vi.fn(() => false) };
    TestBed.configureTestingModule({
      imports: [ItemMasterComponent],
      providers: [
        { provide: PurchaseService, useValue: purchaseService },
        { provide: ProductService, useValue: productService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: SupabaseService, useValue: supabaseService },
        { provide: ToastService, useValue: toastService },
        { provide: HttpClient, useValue: http }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).overrideComponent(ItemMasterComponent, { set: { template: '' } });
    component = TestBed.createComponent(ItemMasterComponent).componentInstance;
  });

  it('searches and summarizes procurement stock and supports select-all toggling', () => {
    expect(component.procurementSummary()).toEqual({
      totalProcured: 11, totalSold: 7, totalRemaining: 4, soldOutItemsCount: 0
    });
    expect(component.filteredProcurementItems()[0].stockStatus).toBe('low_stock');
    component.toggleSelectAll();
    expect(component.isAllSelected()).toBe(true);
    expect(component.selectedItemCount()).toBe(1);
    component.toggleSelectAll();
    expect(component.isAllSelected()).toBe(false);

    component.searchTerm.set('north');
    expect(component.filteredProcurementItems()).toHaveLength(1);
    component.searchTerm.set('not found');
    expect(component.filteredProcurementItems()).toHaveLength(0);
  });

  it('toggles sort direction and exposes the matching sort icon', () => {
    expect(component.sortIcon('purchaseDate')).toBe('arrow_downward');
    component.sortInventoryBy('productName');
    expect(component.sortDirection()).toBe('asc');
    expect(component.sortIcon('productName')).toBe('arrow_upward');
    component.sortInventoryBy('productName');
    expect(component.sortDirection()).toBe('desc');
  });

  it('supports partial selection, search events, and confirmation-gated deletion', async () => {
    const entries = component.filteredProcurementItems();
    component.toggleSelectItem(entries[0].inventoryKey);
    expect(component.isItemSelected(entries[0].inventoryKey)).toBe(true);
    expect(component.isSomeSelected()).toBe(false);
    component.onSearch({ target: { value: 'Bandage' } } as unknown as Event);
    expect(component.filteredProcurementItems()).toHaveLength(1);

    await component.onDeleteSelected();
    expect(confirmationService.confirm).toHaveBeenCalledOnce();
    expect(http.post).not.toHaveBeenCalled();
    expect(component.isDeleting()).toBe(false);

    component.selectedInventoryKeys.set(new Set());
    await component.onDeleteSelected();
    expect(confirmationService.confirm).toHaveBeenCalledOnce();
  });

  it('removes local inventory sources only after a successful batch-delete request', async () => {
    const entry = component.filteredProcurementItems()[0];
    confirmationService.confirm.mockResolvedValue(true);
    component.toggleSelectItem(entry.inventoryKey);
    await component.onDeleteSelected();

    expect(http.post).toHaveBeenCalledWith('/api/inventory/batch-delete', {
      productIds: ['p1'], itemIds: ['proc1'], purchaseItemRefs: []
    });
    expect(products()).toEqual([]);
    expect(procurementItems()).toEqual([]);
    expect(component.selectedItemCount()).toBe(0);
    expect(component.isDeleting()).toBe(false);
  });

  it('loads inventory, sorts across supported fields, and tracks partial/empty selections', () => {
    component.ngOnInit();
    expect(purchaseService.fetchPurchasesFromApi).toHaveBeenCalledWith(true);
    expect(productService.fetchProductsFromApi).toHaveBeenCalledWith(true);

    procurementItems.set([
      { id: 'proc1', productId: 'p1', productName: 'Bandage', sku: 'B-1', quantity: 10, freeQty: 1, costPrice: 5, supplier: 'North Medical', purchaseDate: new Date('2026-01-01'), batchNo: 'A-1' },
      { id: 'proc2', productId: 'p1', productName: 'Bandage', sku: 'B-1', quantity: 2, freeQty: 0, costPrice: 3, supplier: 'South Medical', purchaseDate: new Date('2026-02-01'), batchNo: 'A-2' }
    ]);
    const entries = component.filteredProcurementItems();
    expect(entries).toHaveLength(2);
    component.toggleSelectItem(entries[0].inventoryKey);
    expect(component.isSomeSelected()).toBe(true);
    for (const key of ['productName', 'supplier', 'purchaseDate', 'batchNo', 'quantity', 'soldQuantity', 'currentStock', 'stockStatus', 'costPrice', 'totalCost'] as const) {
      component.sortInventoryBy(key);
      expect(component.sortBy()).toBe(key);
      expect(component.filteredProcurementItems()).toHaveLength(2);
      component.sortIcon(key);
    }
    component.toggleSelectAll();
    expect(component.isAllSelected()).toBe(true);
    component.toggleSelectAll();
    expect(component.isAllSelected()).toBe(false);
    component.searchTerm.set('not present');
    expect(component.isAllSelected()).toBe(false);
    expect(component.isSomeSelected()).toBe(false);
    component.toggleSelectAll();
    expect(component.selectedItemCount()).toBe(0);
  });

  it('handles item deletion guards, cancellation, individual deletion, and request failures', async () => {
    await component.onDeleteItem(null);
    expect(confirmationService.confirm).not.toHaveBeenCalled();
    await component.onDeleteItem(component.filteredProcurementItems()[0]);
    expect(confirmationService.confirm).toHaveBeenCalledOnce();
    expect(http.post).not.toHaveBeenCalled();

    component.selectedInventoryKeys.set(new Set(['stale-key']));
    await component.onDeleteSelected();
    expect(confirmationService.confirm).toHaveBeenCalledOnce();

    confirmationService.confirm.mockResolvedValue(true);
    await component.onDeleteItem(component.filteredProcurementItems()[0]);
    expect(http.post).toHaveBeenCalledOnce();
    expect(toastService.success).toHaveBeenCalledWith('1 inventory item deleted.');

    products.set([{
      id: 'p1', name: 'Bandage', category: 'Medical', sku: 'B-1', size: 'Free Size', color: '',
      purchasePrice: 5, sellingPrice: 10, discountPercent: 0, quantity: 4, minStockAlert: 5, imageUrls: []
    }]);
    procurementItems.set([{
      id: 'proc1', productId: 'p1', productName: 'Bandage', sku: 'B-1', quantity: 10, freeQty: 1,
      costPrice: 5, supplier: 'North Medical', purchaseDate: new Date('2026-01-01'), batchNo: 'A-1'
    }]);
    http.post.mockImplementationOnce(() => { throw new Error('offline'); });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    component.toggleSelectItem(component.filteredProcurementItems()[0].inventoryKey);
    await component.onDeleteSelected();
    expect(toastService.error).toHaveBeenCalledWith('Failed to delete the selected inventory items. Please try again.');
    expect(component.isDeleting()).toBe(false);
    consoleError.mockRestore();
  });

  it('synchronizes purchase, procurement, and product records through the configured Supabase fallback', async () => {
    products.set([{
      id: 'p1', name: 'Bandage', category: 'Medical', sku: 'B-1', size: 'Free Size', color: '',
      purchasePrice: 5, sellingPrice: 10, discountPercent: 0, quantity: 4, minStockAlert: 5, imageUrls: []
    }]);
    procurementItems.set([{
      id: 'proc-delete', productId: 'p1', productName: 'Bandage', sku: 'B-1', quantity: 10, freeQty: 1,
      costPrice: 5, supplier: 'North Medical', purchaseDate: new Date('2026-01-01'), batchNo: 'A-1',
      purchaseId: 'buy-1', purchaseItemIndex: 0
    } as any]);
    purchases.set([{ id: 'buy-1', items: [{ name: 'Bandage' }, { name: 'Other' }] }]);
    const purchaseQuery = {
      select: vi.fn(),
      update: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { items: [{ name: 'Bandage' }, { name: 'Other' }] }, error: null })
    };
    purchaseQuery.select.mockReturnValue(purchaseQuery);
    purchaseQuery.update.mockReturnValue(purchaseQuery);
    purchaseQuery.eq.mockReturnValue(purchaseQuery);
    const deleteQuery = { in: vi.fn().mockResolvedValue({ error: null }) };
    const client = {
      from: vi.fn((table: string) => table === 'purchases'
        ? purchaseQuery
        : { delete: vi.fn(() => deleteQuery) })
    };
    supabaseService.client.mockReturnValue(client);
    supabaseService.isConfigured.mockReturnValue(true);
    http.post.mockReturnValue(of({ databaseSynced: false }));
    confirmationService.confirm.mockResolvedValue(true);

    const entry = component.filteredProcurementItems()[0];
    component.toggleSelectItem(entry.inventoryKey);
    await component.onDeleteSelected();

    expect(client.from).toHaveBeenCalledWith('purchases');
    expect(purchaseQuery.select).toHaveBeenCalledWith('items');
    expect(purchaseQuery.update).toHaveBeenCalledWith({ items: [{ name: 'Other' }] });
    expect(client.from).toHaveBeenCalledWith('procurement_items');
    expect(client.from).toHaveBeenCalledWith('products');
    expect(products()).toEqual([]);
    expect(procurementItems()).toEqual([]);
  });
});
