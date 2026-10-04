import { Product } from '../models/product.model';

export interface InventoryListItem {
  inventoryKey: string;
  catalogProduct: Product;
  currentStock: number;
  soldQuantity: number;
  stockStatus: 'sold_out' | 'low_stock' | 'in_stock';
  [key: string]: any;
}

export function buildInventoryListItems(
  procurementRows: any[],
  products: Product[]
): InventoryListItem[] {
  const safeProcurementRows = Array.isArray(procurementRows) ? procurementRows : [];
  const safeProducts = Array.isArray(products) ? products : [];

  const hasProcuredProduct = (item: any) => {
    if (!item) return false;
    const productName = String(item.productName || item.product_name || item.name || '').trim();
    return productName.length > 0 &&
      !['PROCURED ITEM', 'UNNAMED PRODUCT'].includes(productName.toUpperCase());
  };

  const validProcRows = safeProcurementRows.filter(hasProcuredProduct);
  const seenRows = new Set<string>();
  const items = validProcRows.filter(item => {
    const purchaseId = String(item.purchaseId || item.purchase_id || '').trim();
    const productName = String(item.productName || item.product_name || item.name || '').trim().toLowerCase();
    const rowKey = [
      purchaseId,
      productName,
      String(item.sku || '').trim().toUpperCase(),
      String(item.batchNo || item.batch_no || '').trim().toUpperCase(),
      String(item.expDate || item.exp_date || '').trim().toUpperCase(),
      Number(item.quantity) || 0,
      Number(item.freeQty || item.free_qty) || 0,
      Number(item.costPrice || item.cost_price) || 0,
      Number(item.mrp) || 0
    ].join('|');
    if (seenRows.has(rowKey)) return false;
    seenRows.add(rowKey);
    return true;
  });

  const itemsByProductAndBatch = new Map<string, any>();
  items.forEach(item => {
    const productName = String(item.productName || item.product_name || item.name || '').trim().toLowerCase();
    const sku = String(item.sku || '').trim().toLowerCase();
    const productKey = productName || sku;
    const batchNo = String(item.batchNo || item.batch_no || '').trim().toLowerCase();
    const key = `${productKey}|${batchNo}`;
    const existing = itemsByProductAndBatch.get(key);

    if (!existing) {
      itemsByProductAndBatch.set(key, { ...item });
      return;
    }

    const quantity = Number(existing.quantity) || 0;
    const addedQuantity = Number(item.quantity) || 0;
    const totalQuantity = quantity + addedQuantity;
    const costPrice = Number(existing.costPrice || existing.cost_price) || 0;
    const addedCostPrice = Number(item.costPrice || item.cost_price) || 0;
    const freeQty = (Number(existing.freeQty || existing.free_qty) || 0) +
      (Number(item.freeQty || item.free_qty) || 0);
    const totalCost = (Number(existing.totalCost || existing.total_cost) || quantity * costPrice) +
      (Number(item.totalCost || item.total_cost) || addedQuantity * addedCostPrice);
    const suppliers = new Set(
      [existing.supplier, item.supplier].filter(Boolean).map(supplier => String(supplier).trim())
    );

    existing.quantity = totalQuantity;
    existing.freeQty = freeQty;
    existing.free_qty = freeQty;
    existing.costPrice = totalQuantity > 0 ? totalCost / totalQuantity : costPrice;
    existing.cost_price = existing.costPrice;
    existing.totalCost = totalCost;
    existing.total_cost = totalCost;
    existing.supplier = [...suppliers].join(', ');
  });

  const representedProductIds = new Set<string>();
  const representedSkus = new Set<string>();
  const representedNames = new Set<string>();

  const results: InventoryListItem[] = [...itemsByProductAndBatch.entries()].map(([inventoryKey, item]) => {
    const productId = item.productId || item.product_id;
    const productName = (item.productName || item.product_name || '').trim().toLowerCase();
    const sku = (item.sku || '').trim().toUpperCase();
    const matchedProduct = safeProducts.find(product =>
      (productId && product.id === productId) ||
      (sku && product.sku && product.sku.trim().toUpperCase() === sku) ||
      (productName && product.name && product.name.trim().toLowerCase() === productName)
    );

    if (matchedProduct) {
      if (matchedProduct.id) representedProductIds.add(matchedProduct.id);
      if (matchedProduct.sku) representedSkus.add(matchedProduct.sku.trim().toUpperCase());
      if (matchedProduct.name) representedNames.add(matchedProduct.name.trim().toLowerCase());
    }

    const currentStock = matchedProduct ? Number(matchedProduct.quantity || 0) : Number(item.quantity || 0);
    const initialProcured = (Number(item.quantity) || 0) + (Number(item.freeQty || item.free_qty) || 0);
    const soldQuantity = Math.max(0, initialProcured - currentStock);
    const minAlert = matchedProduct?.minStockAlert ?? 5;
    const stockStatus: 'sold_out' | 'low_stock' | 'in_stock' = currentStock <= 0
      ? 'sold_out'
      : currentStock <= minAlert
        ? 'low_stock'
        : 'in_stock';
    const key = sku.toLowerCase() || productName;
    const catalogProduct: Product = matchedProduct || {
      id: `inventory-${key}`,
      name: item.productName || item.product_name,
      category: item.category || 'General',
      sku: item.sku || `SKU-${key}`,
      size: 'Free Size',
      color: '',
      purchasePrice: Number(item.costPrice || item.cost_price) || 0,
      sellingPrice: Number(item.mrp) || Number(item.costPrice || item.cost_price) || 0,
      discountPercent: 0,
      quantity: currentStock,
      minStockAlert: 5,
      imageUrls: []
    };

    return { ...item, inventoryKey, catalogProduct, currentStock, soldQuantity, stockStatus };
  });

  // Guarantee: Include all products from the store catalog if not already represented by procurement batches
  safeProducts.forEach(product => {
    const pId = product.id;
    const pSku = (product.sku || '').trim().toUpperCase();
    const pName = (product.name || '').trim().toLowerCase();

    const isAlreadyRepresented =
      (pId && representedProductIds.has(pId)) ||
      (pSku && representedSkus.has(pSku)) ||
      (pName && representedNames.has(pName));

    if (!isAlreadyRepresented) {
      const currentStock = Number(product.quantity || 0);
      const costPrice = Number(product.purchasePrice || 0);
      const sellingPrice = Number(product.sellingPrice || 0);
      const minAlert = Number(product.minStockAlert ?? 5);
      const stockStatus: 'sold_out' | 'low_stock' | 'in_stock' = currentStock <= 0
        ? 'sold_out'
        : currentStock <= minAlert
          ? 'low_stock'
          : 'in_stock';

      let supplier = 'Store Catalog';
      if (product.description && product.description.includes('Procured from ')) {
        const match = product.description.match(/Procured from ([^(]+)/);
        if (match && match[1]) supplier = match[1].trim();
      }

      const key = pSku.toLowerCase() || pName.replace(/\s+/g, '-') || pId;

      results.push({
        id: `catalog-${product.id}`,
        inventoryKey: `catalog-${key}`,
        purchase_id: 'CATALOG',
        purchaseId: 'CATALOG',
        supplier: supplier,
        supplier_invoice_number: 'N/A',
        supplierInvoiceNumber: 'N/A',
        purchase_date: (product as any).createdAt || (product as any).created_at || new Date().toISOString(),
        purchaseDate: (product as any).createdAt || (product as any).created_at || new Date().toISOString(),
        product_id: product.id,
        productId: product.id,
        product_name: product.name,
        productName: product.name,
        sku: product.sku || 'N/A',
        batch_no: 'Standard',
        batchNo: 'Standard',
        exp_date: '',
        expDate: '',
        quantity: currentStock,
        free_qty: 0,
        freeQty: 0,
        cost_price: costPrice,
        costPrice: costPrice,
        total_cost: currentStock * costPrice,
        totalCost: currentStock * costPrice,
        mrp: sellingPrice,
        current_stock: currentStock,
        currentStock: currentStock,
        sold_quantity: 0,
        soldQuantity: 0,
        stockStatus: stockStatus,
        catalogProduct: product
      });
    }
  });

  return results;
}
