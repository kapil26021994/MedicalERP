import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PurchaseService } from '../../services/purchase.service';
import { ProductService } from '../../services/product.service';
import { ConfirmationService } from '../../services/confirmation.service';
import { SupabaseService } from '../../services/supabase.service';
import { LoaderComponent } from '../layout/loader.component';
import { buildInventoryListItems } from '../../utils/inventory-list';

type InventorySortKey =
  | 'productName'
  | 'supplier'
  | 'purchaseDate'
  | 'batchNo'
  | 'quantity'
  | 'soldQuantity'
  | 'currentStock'
  | 'stockStatus'
  | 'costPrice'
  | 'totalCost';

@Component({
  selector: 'app-item-master',
  standalone: true,
  imports: [CommonModule, LoaderComponent],
  templateUrl: './item-master.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ItemMasterComponent implements OnInit {
  purchaseService = inject(PurchaseService);
  productService = inject(ProductService);
  confirmationService = inject(ConfirmationService);
  supabaseService = inject(SupabaseService);
  private http = inject(HttpClient);

  searchTerm = signal('');
  sortBy = signal<InventorySortKey>('purchaseDate');
  sortDirection = signal<'asc' | 'desc'>('desc');

  selectedInventoryKeys = signal<Set<string>>(new Set());
  isDeleting = signal<boolean>(false);

  filteredProcurementItems = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const procurementRows = [
      ...this.purchaseService.procurementItems(),
      ...this.purchaseService.extractProcurementItemsFromPurchases(this.purchaseService.purchases())
    ];
    const items = buildInventoryListItems(procurementRows, this.productService.products());

    const filteredItems = term ? items.filter(item =>
      (item.productName || item.product_name || '').toLowerCase().includes(term) ||
      (item.supplier || '').toLowerCase().includes(term) ||
      (item.sku || '').toLowerCase().includes(term) ||
      (item.batchNo || item.batch_no || '').toLowerCase().includes(term)
    ) : items;

    const sortBy = this.sortBy();
    const direction = this.sortDirection() === 'asc' ? 1 : -1;
    return [...filteredItems].sort((a, b) => {
      const getValue = (item: typeof filteredItems[number]): string | number => {
        switch (sortBy) {
          case 'productName': return String(item.productName || item.product_name || '');
          case 'supplier': return String(item.supplier || '');
          case 'purchaseDate': {
            const date = new Date(item.purchaseDate || item.purchase_date || 0).getTime();
            return Number.isNaN(date) ? 0 : date;
          }
          case 'batchNo': return String(item.batchNo || item.batch_no || '');
          case 'quantity': return Number(item.quantity) || 0;
          case 'soldQuantity': return Number(item.soldQuantity) || 0;
          case 'currentStock': return Number(item.currentStock) || 0;
          case 'stockStatus': return String(item.stockStatus || '');
          case 'costPrice': return Number(item.costPrice || item.cost_price) || 0;
          case 'totalCost': return Number(item.totalCost || item.total_cost) || 0;
        }
      };
      const left = getValue(a);
      const right = getValue(b);
      const comparison = typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
      return comparison * direction;
    });
  });

  procurementSummary = computed(() => {
    const items = this.filteredProcurementItems();
    return {
      totalProcured: items.reduce((sum, item) => sum + (Number(item.quantity) || 0) + (Number(item.freeQty || item.free_qty) || 0), 0),
      totalSold: items.reduce((sum, item) => sum + (Number(item.soldQuantity) || 0), 0),
      totalRemaining: items.reduce((sum, item) => sum + (Number(item.currentStock) || 0), 0),
      soldOutItemsCount: items.filter(item => item.stockStatus === 'sold_out').length
    };
  });

  selectedItemCount = computed(() => this.selectedInventoryKeys().size);

  isAllSelected = computed(() => {
    const items = this.filteredProcurementItems();
    return items.length > 0 && items.every(item => this.selectedInventoryKeys().has(item.inventoryKey));
  });

  isSomeSelected = computed(() => {
    const items = this.filteredProcurementItems();
    const count = items.filter(item => this.selectedInventoryKeys().has(item.inventoryKey)).length;
    return count > 0 && count < items.length;
  });

  ngOnInit(): void {
    this.purchaseService.fetchPurchasesFromApi(true);
    this.productService.fetchProductsFromApi(true);
  }

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  sortInventoryBy(key: InventorySortKey): void {
    if (this.sortBy() === key) {
      this.sortDirection.update(direction => direction === 'asc' ? 'desc' : 'asc');
      return;
    }
    this.sortBy.set(key);
    this.sortDirection.set('asc');
  }

  sortIcon(key: InventorySortKey): string {
    if (this.sortBy() !== key) return 'unfold_more';
    return this.sortDirection() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  toggleSelectAll(): void {
    const items = this.filteredProcurementItems();
    if (this.isAllSelected()) {
      this.selectedInventoryKeys.set(new Set());
    } else {
      this.selectedInventoryKeys.set(new Set(items.map(item => item.inventoryKey)));
    }
  }

  toggleSelectItem(key: string): void {
    this.selectedInventoryKeys.update(keys => {
      const next = new Set(keys);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  isItemSelected(key: string): boolean {
    return this.selectedInventoryKeys().has(key);
  }

  async onDeleteSelected(): Promise<void> {
    const selectedKeys = this.selectedInventoryKeys();
    if (selectedKeys.size === 0) return;

    const allItems = this.filteredProcurementItems();
    const itemsToDelete = allItems.filter(item => selectedKeys.has(item.inventoryKey));
    if (itemsToDelete.length === 0) return;

    const count = itemsToDelete.length;
    const confirmed = await this.confirmationService.confirm({
      title: 'Delete Inventory Items',
      message: `Are you sure you want to permanently delete the ${count} selected item${count > 1 ? 's' : ''} from the database? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });

    if (confirmed) {
      await this.executeDelete(itemsToDelete);
    }
  }

  async onDeleteItem(item: any): Promise<void> {
    if (!item) return;
    const name = item.productName || item.product_name || 'Item';
    const confirmed = await this.confirmationService.confirm({
      title: 'Delete Inventory Item',
      message: `Are you sure you want to permanently delete "${name}" from the database? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });

    if (confirmed) {
      await this.executeDelete([item]);
    }
  }

  private async executeDelete(itemsToDelete: any[]): Promise<void> {
    if (!itemsToDelete || itemsToDelete.length === 0) return;
    this.isDeleting.set(true);

    const productIds = new Set<string>();
    const itemIds = new Set<string>();
    const skus = new Set<string>();
    const keysToRemove = new Set<string>();

    itemsToDelete.forEach(item => {
      const pId = item.productId || item.product_id || item.catalogProduct?.id;
      if (pId && !String(pId).startsWith('inventory-custom')) productIds.add(String(pId));
      if (item.id && !String(item.id).startsWith('catalog-')) itemIds.add(String(item.id));
      if (item.sku && item.sku !== 'N/A') skus.add(String(item.sku).trim().toUpperCase());
      if (item.inventoryKey) keysToRemove.add(item.inventoryKey);
    });

    try {
      // 1. Call backend API batch-delete
      await firstValueFrom(this.http.post('/api/inventory/batch-delete', {
        productIds: Array.from(productIds),
        itemIds: Array.from(itemIds),
        skus: Array.from(skus)
      })).catch(err => console.warn('API batch-delete note:', err));

      // 2. Direct Supabase deletion
      const client = this.supabaseService.client();
      if (this.supabaseService.isConfigured() && client) {
        for (const pId of productIds) {
          await client.from('products').delete().eq('id', pId).match(() => {});
          await client.from('product').delete().eq('id', pId).match(() => {});
          await client.from('procurement_items').delete().eq('product_id', pId).match(() => {});
        }
        for (const iId of itemIds) {
          await client.from('procurement_items').delete().eq('id', iId).match(() => {});
        }
        for (const sku of skus) {
          if (sku && sku !== 'N/A') {
            await client.from('products').delete().eq('sku', sku).match(() => {});
            await client.from('product').delete().eq('sku', sku).match(() => {});
            await client.from('procurement_items').delete().eq('sku', sku).match(() => {});
          }
        }
      }

      // 3. Update local state
      this.productService.products.update(prods =>
        prods.filter(p => !productIds.has(p.id) && (!p.sku || !skus.has(p.sku.trim().toUpperCase())))
      );
      this.purchaseService.procurementItems.update(items =>
        items.filter(i =>
          !itemIds.has(i.id) &&
          !productIds.has(i.product_id || i.productId) &&
          (!i.sku || !skus.has(String(i.sku).trim().toUpperCase()))
        )
      );

      // 4. Remove deleted keys from selection
      this.selectedInventoryKeys.update(keys => {
        const next = new Set(keys);
        keysToRemove.forEach(k => next.delete(k));
        return next;
      });
    } finally {
      this.isDeleting.set(false);
    }
  }
}
