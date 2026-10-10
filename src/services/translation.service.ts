import { Injectable, signal, computed } from '@angular/core';

export type Language = 'en' | 'hi';

export interface TranslationDictionary {
  [key: string]: {
    en: string;
    hi: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  readonly currentLang = signal<Language>(this.getInitialLang());

  private readonly dictionary: TranslationDictionary = {
    // Navigation & Common
    'nav.dashboard': { en: 'Dashboard', hi: 'डैशबोर्ड' },
    'nav.sales': { en: 'Sales', hi: 'बिक्री (सेल्स)' },
    'nav.pos': { en: 'POS Terminal', hi: 'पीओएस बिलिंग' },
    'nav.invoices': { en: 'Invoices', hi: 'इनवॉइस एवं बिल' },
    'nav.inventory': { en: 'Inventory', hi: 'इन्वेंटरी स्टॉक' },
    'nav.purchases': { en: 'Purchases', hi: 'खरीदारी (परचेज)' },
    'nav.challan': { en: 'Challan', hi: 'चालान' },
    'nav.expenses': { en: 'Expenses', hi: 'खर्चे (एक्सपेंस)' },
    'nav.customers': { en: 'Customers', hi: 'ग्राहक सूची' },
    'nav.reports': { en: 'Reports', hi: 'रिपोर्ट्स' },
    'nav.settings': { en: 'Settings', hi: 'सेटिंग्स' },
    'nav.main': { en: 'Main Navigation', hi: 'मुख्य नेविगेशन' },
    'nav.procurement': { en: 'Procurement', hi: 'खरीद प्रबंधन' },
    'nav.salesExpense': { en: 'Sales & Expense', hi: 'बिक्री एवं खर्चे' },
    'nav.itemsStock': { en: 'Items & Stock', hi: 'उत्पाद एवं स्टॉक' },
    'nav.purchaseOrders': { en: 'Purchase Orders', hi: 'खरीद ऑर्डर' },

    // Header & App Shell
    'header.searchPlaceholder': { en: 'Search products, SKUs, invoices, customers...', hi: 'उत्पाद, इनवॉइस या ग्राहक खोजें...' },
    'header.new': { en: 'New', hi: 'नया जोड़ें' },
    'header.posTerminal': { en: 'POS Terminal', hi: 'पीओएस टर्मिनल' },
    'header.storeManager': { en: 'Store Manager', hi: 'स्टोर मैनेजर' },
    'header.demoManager': { en: 'Demo Manager', hi: 'डेमो मैनेजर' },
    'header.accountSettings': { en: 'Account Settings', hi: 'खाता सेटिंग्स' },
    'header.signOut': { en: 'Sign Out', hi: 'साइन आउट' },
    'header.language': { en: 'Language', hi: 'भाषा' },
    'header.mainStore': { en: 'Main Retail Store', hi: 'मुख्य रिटेल स्टोर' },

    // Footer
    'footer.systemOperational': { en: 'System Operational', hi: 'सिस्टम सुचारू रूप से कार्यरत' },
    'footer.gstReady': { en: 'GST Ready', hi: 'जीएसटी तैयार' },
    'footer.platformDesc': { en: 'Professional Inventory, POS & Billing Platform', hi: 'व्यावसायिक इन्वेंटरी, पीओएस एवं बिलिंग प्लेटफॉर्म' },

    // Quick Menu Items
    'quick.salesAnalytics': { en: 'Sales Analytics & Ledger', hi: 'बिक्री विश्लेषण एवं लेजर' },
    'quick.posBill': { en: 'POS Sale Bill', hi: 'पीओएस बिक्री बिल' },
    'quick.createInvoice': { en: 'Create Sales Invoice', hi: 'बिक्री इनवॉइस बनाएं' },
    'quick.addInventory': { en: 'Add Inventory Item', hi: 'नया सामान जोड़ें' },
    'quick.recordPurchase': { en: 'Record Purchase', hi: 'खरीदारी दर्ज करें' },
    'quick.addExpense': { en: 'Add Expense', hi: 'नया खर्चा दर्ज करें' },

    // Dashboard Cards & Texts
    'dash.title': { en: 'Business Overview & Performance', hi: 'व्यापार अवलोकन एवं प्रदर्शन' },
    'dash.todaySales': { en: 'Today Sales Revenue', hi: 'आज की कुल बिक्री' },
    'dash.totalInvoices': { en: 'Total Invoices Issued', hi: 'कुल जारी इनवॉइस' },
    'dash.itemsInStock': { en: 'Items in Stock', hi: 'स्टॉक में मौजूद उत्पाद' },
    'dash.lowStockAlerts': { en: 'Low Stock Alerts', hi: 'कम स्टॉक अलर्ट' },
    'dash.topSellingItems': { en: 'Top Selling Items', hi: 'सर्वाधिक बिकने वाले उत्पाद' },
    'dash.topSellingDesc': { en: 'Most demanded inventory items by sales volume', hi: 'बिक्री मात्रा के आधार पर शीर्ष उत्पाद' },
    'dash.recentInvoices': { en: 'Recent Sales Invoices', hi: 'हाल की बिक्री इनवॉइस' },
    'dash.viewInventory': { en: 'View Inventory', hi: 'इन्वेंटरी देखें' },
    'dash.viewAllInvoices': { en: 'View All Invoices', hi: 'सभी इनवॉइस देखें' },
    'dash.qtySold': { en: 'Qty Sold', hi: 'बिकी मात्रा' },
    'dash.revenue': { en: 'Revenue', hi: 'राजस्व' },
    'dash.productDetails': { en: 'Product Details', hi: 'उत्पाद विवरण' },
    'dash.quickActions': { en: 'Quick Actions', hi: 'त्वरित कार्य' },
    'dash.recentCustomers': { en: 'Recent Customers', hi: 'हाल के ग्राहक' },
    'dash.viewAllCustomers': { en: 'View All Customers', hi: 'सभी ग्राहक देखें' },

    // POS Terminal Page
    'pos.title': { en: 'POS Express Terminal', hi: 'पीओएस एक्सप्रेस टर्मिनल' },
    'pos.subtitle': { en: 'Quick barcode scan, catalog search & immediate billing', hi: 'त्वरित बारकोड स्कैन, कैटलॉग खोज एवं तत्काल बिलिंग' },
    'pos.walkinCustomer': { en: 'Walk-in Customer', hi: 'वॉक-इन ग्राहक (काउंटर ग्राहक)' },
    'pos.defaultBilling': { en: 'Default Counter Billing', hi: 'डिफ़ॉल्ट काउंटर बिलिंग' },
    'pos.clearCart': { en: 'Clear Cart', hi: 'कार्ट साफ़ करें' },
    'pos.searchProduct': { en: 'Search product name, category, or scan SKU barcode...', hi: 'उत्पाद का नाम, श्रेणी खोजें या बारकोड स्कैन करें...' },
    'pos.allCategories': { en: 'All Categories', hi: 'सभी श्रेणियां' },
    'pos.outOfStock': { en: 'Out of Stock', hi: 'स्टॉक में नहीं है' },
    'pos.cartTitle': { en: 'Current Order Cart', hi: 'वर्तमान ऑर्डर कार्ट' },
    'pos.cartEmpty': { en: 'Cart is empty', hi: 'आपकी कार्ट खाली है' },
    'pos.cartEmptyDesc': { en: 'Click on any product from catalog to add items', hi: 'आइटम जोड़ने के लिए कैटलॉग से उत्पाद पर क्लिक करें' },
    'pos.item': { en: 'Item', hi: 'उत्पाद' },
    'pos.subtotal': { en: 'Subtotal', hi: 'उप-योग' },
    'pos.tax': { en: 'Tax (GST 18%)', hi: 'कर (जीएसटी 18%)' },
    'pos.grandTotal': { en: 'Grand Total', hi: 'कुल देय राशि' },
    'pos.proceedCheckout': { en: 'Proceed to Checkout', hi: 'भुगतान प्रक्रिया पर जाएं' },
    'pos.paymentModalTitle': { en: 'Select Payment Method & Collect Amount', hi: 'भुगतान का तरीका चुनें एवं राशि प्राप्त करें' },
    'pos.paymentMode': { en: 'Payment Mode', hi: 'भुगतान का प्रकार' },
    'pos.cash': { en: 'Cash Payment', hi: 'नकद (Cash)' },
    'pos.upi': { en: 'UPI / Online QR', hi: 'यूपीआई / क्यूआर' },
    'pos.card': { en: 'Card / POS Machine', hi: 'कार्ड / स्वैप' },
    'pos.udhar': { en: 'Credit (Udhar)', hi: 'उधार खाता' },
    'pos.amountReceived': { en: 'Amount Received (₹)', hi: 'प्राप्त राशि (₹)' },
    'pos.changeDue': { en: 'Change Due (₹)', hi: 'वापस दी जाने वाली राशि (₹)' },
    'pos.completeSale': { en: 'Complete & Print Bill', hi: 'बिल पूर्ण करें और प्रिंट लें' },
    'pos.saleSuccess': { en: 'Sale Transaction Completed!', hi: 'बिक्री लेनदेन सफलतापूर्वक पूरा हुआ!' },
    'pos.printInvoice': { en: 'Print / Download Receipt', hi: 'रसीद प्रिंट / डाउनलोड करें' },
    'pos.nextBill': { en: 'Start Next Bill', hi: 'अगला बिल शुरू करें' },

    // Sales Register Page
    'sales.title': { en: 'Sales Register & Analytics', hi: 'बिक्री रजिस्टर एवं विश्लेषण' },
    'sales.subtitle': { en: 'Manage inventory items, record counter sales, and monitor stock levels', hi: 'उत्पाद सूची प्रबंधित करें, बिक्री दर्ज करें और स्टॉक स्तर ट्रैक करें' },
    'sales.addNewItem': { en: 'Add Inventory Item', hi: 'नया उत्पाद जोड़ें' },
    'sales.recordSale': { en: 'Record Counter Sale', hi: 'बिक्री प्रविष्टि दर्ज करें' },
    'sales.searchProducts': { en: 'Search by product name, SKU, or category...', hi: 'उत्पाद नाम, SKU या श्रेणी खोजें...' },
    'sales.allCategories': { en: 'All Categories', hi: 'सभी श्रेणियां' },
    'sales.productName': { en: 'Product Name', hi: 'उत्पाद का नाम' },
    'sales.sku': { en: 'SKU / Code', hi: 'SKU कोड' },
    'sales.category': { en: 'Category', hi: 'श्रेणी' },
    'sales.costPrice': { en: 'Cost Price', hi: 'खरीद मूल्य' },
    'sales.sellingPrice': { en: 'Selling Price', hi: 'बिक्री मूल्य' },
    'sales.stockQty': { en: 'Stock Qty', hi: 'स्टॉक मात्रा' },
    'sales.actions': { en: 'Actions', hi: 'कार्रवाई' },
    'sales.noProductsFound': { en: 'No products found matching filters.', hi: 'फ़िल्टर से मेल खाने वाला कोई उत्पाद नहीं मिला।' },

    // Invoices Page
    'inv.title': { en: 'Invoices & Billing Directory', hi: 'इनवॉइस एवं बिलिंग डायरेक्टरी' },
    'inv.subtitle': { en: 'Issue GST compliant tax invoices, manage payments & track due balances', hi: 'जीएसटी कर इनवॉइस जारी करें, भुगतान संभालें एवं बकाया ट्रैक करें' },
    'inv.createNew': { en: 'Create New Invoice', hi: 'नया इनवॉइस बनाएं' },
    'inv.searchInvoices': { en: 'Search invoice #, customer name, phone...', hi: 'इनवॉइस नंबर, ग्राहक नाम या फोन खोजें...' },
    'inv.allStatuses': { en: 'All Statuses', hi: 'सभी स्थितियां' },
    'inv.number': { en: 'Invoice #', hi: 'इनवॉइस संख्या' },
    'inv.date': { en: 'Date', hi: 'दिनांक' },
    'inv.customer': { en: 'Customer', hi: 'ग्राहक' },
    'inv.amount': { en: 'Total Amount', hi: 'कुल राशि' },
    'inv.amountPaid': { en: 'Amount Paid', hi: 'भुगतान राशि' },
    'inv.balanceDue': { en: 'Balance Due', hi: 'शेष बकाया' },
    'inv.status': { en: 'Status', hi: 'स्थिति' },
    'inv.viewBill': { en: 'View / Print', hi: 'देखें / प्रिंट' },

    // Invoice Form (Create/Edit)
    'invform.createTitle': { en: 'Create Sales Tax Invoice', hi: 'नया बिक्री टैक्स इनवॉइस बनाएं' },
    'invform.editTitle': { en: 'Edit Sales Invoice', hi: 'इनवॉइस संपादित करें' },
    'invform.customerInfo': { en: 'Customer Information', hi: 'ग्राहक की जानकारी' },
    'invform.selectCustomer': { en: 'Select Registered Customer', hi: 'पंजीकृत ग्राहक चुनें' },
    'invform.invoiceDetails': { en: 'Invoice Details', hi: 'इनवॉइस विवरण' },
    'invform.invoiceDate': { en: 'Invoice Date', hi: 'इनवॉइस तिथि' },
    'invform.dueDate': { en: 'Payment Due Date', hi: 'भुगतान की अंतिम तिथि' },
    'invform.lineItems': { en: 'Invoice Line Items', hi: 'इनवॉइस में शामिल उत्पाद' },
    'invform.addItem': { en: 'Add Product Item', hi: 'उत्पाद जोड़ें' },
    'invform.selectProduct': { en: 'Select Product', hi: 'उत्पाद चुनें' },
    'invform.quantity': { en: 'Qty', hi: 'मात्रा' },
    'invform.unitPrice': { en: 'Unit Price (₹)', hi: 'इकाई मूल्य (₹)' },
    'invform.taxRate': { en: 'Tax Rate (%)', hi: 'कर की दर (%)' },
    'invform.total': { en: 'Total (₹)', hi: 'कुल (₹)' },
    'invform.paymentStatus': { en: 'Payment Status & Notes', hi: 'भुगतान स्थिति एवं टिप्पणियां' },
    'invform.notes': { en: 'Terms & Internal Notes', hi: 'शर्तें एवं आंतरिक टिप्पणियां' },
    'invform.saveInvoice': { en: 'Save & Generate Invoice', hi: 'सहेजें और इनवॉइस बनाएं' },

    // Purchases Page
    'pur.title': { en: 'Procurement & Purchase Orders', hi: 'खरीदारी (परचेज) एवं स्टॉक आगमन' },
    'pur.subtitle': { en: 'Record inventory stock inward, supplier invoices, and vendor bills', hi: 'स्टॉक आवक, आपूर्तिकर्ता इनवॉइस और विक्रेता बिल दर्ज करें' },
    'pur.recordPurchase': { en: 'Record Supplier Purchase', hi: 'नया खरीद बिल दर्ज करें' },
    'pur.searchPurchases': { en: 'Search supplier invoice #, vendor name...', hi: 'सप्लायर इनवॉइस नंबर, विक्रेता नाम खोजें...' },
    'pur.supplierInvoice': { en: 'Supplier Invoice #', hi: 'सप्लायर बिल नंबर' },
    'pur.vendorName': { en: 'Supplier / Vendor', hi: 'विक्रेता (सप्लायर)' },
    'pur.purchaseDate': { en: 'Purchase Date', hi: 'खरीद की तारीख' },
    'pur.totalCost': { en: 'Total Amount', hi: 'कुल लागत राशि' },
    'pur.itemsReceived': { en: 'Items Inward', hi: 'प्राप्त उत्पाद' },

    // Expenses Page
    'exp.title': { en: 'Business Expense Tracker', hi: 'व्यापारिक खर्च (एक्सपेंस) ट्रैकर' },
    'exp.subtitle': { en: 'Monitor store overheads, utility bills, rent, salaries, and operating expenses', hi: 'दुकान का किराया, बिजली बिल, वेतन और संचालन खर्च ट्रैक करें' },
    'exp.recordExpense': { en: 'Record New Expense', hi: 'नया खर्चा दर्ज करें' },
    'exp.searchExpenses': { en: 'Search expense category, title, or reference...', hi: 'खर्चे की श्रेणी, शीर्षक या संदर्भ खोजें...' },
    'exp.titleHeader': { en: 'Expense Title', hi: 'खर्चे का शीर्षक' },
    'exp.categoryHeader': { en: 'Category', hi: 'श्रेणी' },
    'exp.amountHeader': { en: 'Amount (₹)', hi: 'लागत राशि (₹)' },
    'exp.dateHeader': { en: 'Date', hi: 'दिनांक' },
    'exp.paymentMethod': { en: 'Paid Via', hi: 'भुगतान का माध्यम' },

    // Customers Page
    'cust.title': { en: 'Customer Registry & Udhar Ledgers', hi: 'ग्राहक सूची एवं उधार लेजर' },
    'cust.subtitle': { en: 'Manage customer contact profiles, purchase history, and credit/udhar balances', hi: 'ग्राहकों का विवरण, खरीदारी इतिहास एवं उधार खाता प्रबंधित करें' },
    'cust.addNew': { en: 'Add New Customer', hi: 'नया ग्राहक जोड़ें' },
    'cust.searchPlaceholder': { en: 'Search customer name, phone, email...', hi: 'ग्राहक का नाम, मोबाइल नंबर या ईमेल खोजें...' },
    'cust.name': { en: 'Customer Name', hi: 'ग्राहक का नाम' },
    'cust.phone': { en: 'Phone Number', hi: 'मोबाइल नंबर' },
    'cust.email': { en: 'Email Address', hi: 'ईमेल पता' },
    'cust.totalPurchases': { en: 'Total Purchases', hi: 'कुल खरीदारी' },
    'cust.udharBalance': { en: 'Udhar Balance', hi: 'उधार बकाया राशि' },
    'cust.viewProfile': { en: 'View Ledger Profile', hi: 'लेजर प्रोफाइल देखें' },

    // Reports Page
    'rep.title': { en: 'Financial Reports & Analytics', hi: 'वित्तीय रिपोर्ट एवं व्यापार विश्लेषण' },
    'rep.subtitle': { en: 'Analyze sales trends, profit margins, top products, and tax statements', hi: 'बिक्री का रुझान, लाभ मार्जिन, शीर्ष उत्पाद और कर विवरणी का विश्लेषण करें' },
    'rep.dateRange': { en: 'Date Range Filter', hi: 'समय अवधि फ़िल्टर' },
    'rep.today': { en: 'Today', hi: 'आज' },
    'rep.thisWeek': { en: 'This Week', hi: 'इस सप्ताह' },
    'rep.thisMonth': { en: 'This Month', hi: 'इस महीने' },
    'rep.customRange': { en: 'Custom Range', hi: 'कस्टम अवधि' },
    'rep.exportReport': { en: 'Export Summary PDF', hi: 'रिपोर्ट पीडीएफ डाउनलोड करें' },

    // Settings page
    'settings.title': { en: 'Store Settings & Preferences', hi: 'स्टोर सेटिंग्स एवं प्राथमिकताएं' },
    'settings.languageSelect': { en: 'App Language / ऐप की भाषा', hi: 'ऐप की भाषा / App Language' },
    'settings.selectEng': { en: 'English (English)', hi: 'English (अंग्रेज़ी)' },
    'settings.selectHindi': { en: 'Hindi (हिंदी)', hi: 'हिंदी (Hindi)' },
    'settings.shopInfo': { en: 'Shop Profile & Tax Details', hi: 'दुकान की जानकारी एवं जीएसटी विवरण' },
    'settings.shopName': { en: 'Store / Shop Name', hi: 'दुकान या व्यापार का नाम' },
    'settings.shopAddress': { en: 'Store Address', hi: 'दुकान का पता' },
    'settings.phone': { en: 'Contact Phone', hi: 'संपर्क फोन नंबर' },
    'settings.gstin': { en: 'GSTIN Tax Identification', hi: 'जीएसटी नंबर (GSTIN)' },
    'settings.saveChanges': { en: 'Save Settings', hi: 'सेटिंग्स सहेजें' },

    // Buttons & Actions
    'btn.save': { en: 'Save', hi: 'सहेजें (Save)' },
    'btn.cancel': { en: 'Cancel', hi: 'रद्द करें' },
    'btn.edit': { en: 'Edit', hi: 'संपादित करें' },
    'btn.delete': { en: 'Delete', hi: 'हटाएं' },
    'btn.print': { en: 'Print', hi: 'प्रिंट करें' },
    'btn.download': { en: 'Download PDF', hi: 'पीडीएफ डाउनलोड करें' },
    'btn.filter': { en: 'Filter', hi: 'फ़िल्टर करें' },
    'btn.clear': { en: 'Clear', hi: 'साफ़ करें' },
    'btn.search': { en: 'Search', hi: 'खोजें' },
    'btn.back': { en: 'Back', hi: 'वापस जाएं' },
    'btn.close': { en: 'Close', hi: 'बंद करें' },
    'btn.submit': { en: 'Submit', hi: 'जमा करें' },

    // Statuses
    'status.paid': { en: 'Paid', hi: 'भुगतान किया गया' },
    'status.pending': { en: 'Pending', hi: 'बकाया' },
    'status.partial': { en: 'Partial', hi: 'आंशिक' },
    'status.overdue': { en: 'Overdue', hi: 'अतिदेय' },

    // Loader messages
    'loader.authenticating': { en: 'Authenticating...', hi: 'प्रमाणित किया जा रहा है...' },
    'loader.navigating': { en: 'Loading page...', hi: 'पृष्ठ लोड हो रहा है...' },
    'loader.syncing': { en: 'Syncing Business Data...', hi: 'व्यापार डेटा सिंक हो रहा है...' }
  };

  private getInitialLang(): Language {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('app_language');
      if (saved === 'hi' || saved === 'en') {
        return saved;
      }
    }
    return 'en'; // Default is English
  }

  setLanguage(lang: Language) {
    this.currentLang.set(lang);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('app_language', lang);
    }
  }

  t(key: string, fallback?: string): string {
    const lang = this.currentLang();
    const entry = this.dictionary[key];
    if (entry) {
      return entry[lang] || entry['en'] || fallback || key;
    }
    return fallback || key;
  }
}
