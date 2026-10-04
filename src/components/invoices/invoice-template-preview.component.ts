import { Component, Input, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Invoice, InvoiceTemplateId } from '../../models/invoice.model';
import { SettingsService, BusinessProfile } from '../../services/settings.service';

@Component({
  selector: 'app-invoice-template-preview',
  imports: [CommonModule, CurrencyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Template Renderer Container -->
    <div [ngSwitch]="activeTemplate()">

      <!-- 1. MODERN CLASSIC TEMPLATE -->
      <div *ngSwitchCase="'modern'" class="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6 text-slate-800 font-sans">
        <!-- Header -->
        <div class="border-t-4 border-indigo-600 pt-3 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h2 class="text-2xl font-black text-indigo-700 uppercase tracking-tight">{{ profile().shopName || 'Advika Collection' }}</h2>
            <p class="text-xs text-slate-500 font-medium mt-1 leading-relaxed max-w-sm">{{ profile().shopAddress }}</p>
            <p class="text-xs text-slate-500 font-semibold mt-0.5">Ph: {{ profile().shopPhone }}</p>
          </div>
          <div class="sm:text-right shrink-0">
            <span class="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-black uppercase tracking-wider mb-2">TAX INVOICE</span>
            <p class="text-sm font-black text-slate-900">Invoice #: {{ invoice.id }}</p>
            <p class="text-xs text-slate-500 font-semibold mt-0.5">{{ invoice.date | date:'mediumDate' }}</p>
            <p class="text-xs font-bold text-indigo-600 mt-1 uppercase">Payment: {{ invoice.paymentMode }}</p>
          </div>
        </div>

        <!-- Billed To Box -->
        <div class="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider">BILLED TO</p>
            <p class="text-sm font-black text-slate-900 mt-0.5">{{ invoice.customer?.name || 'Walk-in Customer' }}</p>
            <p class="text-xs text-slate-500 font-medium mt-0.5">{{ invoice.customer?.phone || 'Cash / Counter Sale' }}</p>
          </div>
          <div class="sm:text-right">
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider">STATUS</p>
            <span class="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
              {{ balance() <= 0 ? 'PAID IN FULL' : 'PARTIAL DUE' }}
            </span>
          </div>
        </div>

        <!-- Items Table -->
        <div class="overflow-x-auto rounded-xl border border-slate-200/80">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-indigo-600 text-white font-black text-[11px] uppercase tracking-wider">
                <th class="p-3 w-10 text-center">#</th>
                <th class="p-3">Item Description</th>
                <th class="p-3 text-right">Price</th>
                <th class="p-3 text-center">Qty</th>
                <th class="p-3 text-center">Disc</th>
                <th class="p-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-medium text-slate-700">
              @for (item of invoice.items; track $index) {
                <tr [class.bg-slate-50\/50]="$index % 2 === 1">
                  <td class="p-3 text-center font-bold text-slate-400">{{ $index + 1 }}</td>
                  <td class="p-3 font-bold text-slate-900">{{ item.name }}</td>
                  <td class="p-3 text-right">{{ item.sellingPrice | currency:'INR' }}</td>
                  <td class="p-3 text-center font-bold">{{ item.cartQuantity }}</td>
                  <td class="p-3 text-center text-emerald-600 font-bold">{{ item.discountPercent || 0 }}%</td>
                  <td class="p-3 text-right font-black text-slate-900">{{ lineTotal(item) | currency:'INR' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Totals & Notes -->
        <div class="flex flex-col sm:flex-row justify-between items-start gap-6 pt-2">
          <div class="max-w-xs text-xs text-slate-500 space-y-1">
            @if (invoice.notes) {
              <p class="font-bold text-slate-700 uppercase text-[10px] tracking-wider">Notes / Remarks:</p>
              <p class="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-600">{{ invoice.notes }}</p>
            }
          </div>

          <div class="w-full sm:w-64 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div class="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span class="font-bold text-slate-900">{{ invoice.subtotal | currency:'INR' }}</span>
            </div>
            @if (invoice.totalDiscount > 0) {
              <div class="flex justify-between text-emerald-600 font-bold">
                <span>Discount</span>
                <span>- {{ invoice.totalDiscount | currency:'INR' }}</span>
              </div>
            }
            <div class="pt-2 border-t border-slate-200 flex justify-between font-black text-sm text-indigo-700">
              <span>Grand Total</span>
              <span>{{ invoice.total | currency:'INR' }}</span>
            </div>
            <div class="flex justify-between text-slate-500 text-[11px] pt-1">
              <span>Amount Paid</span>
              <span class="font-bold text-slate-900">{{ (invoice.amountPaid || invoice.total) | currency:'INR' }}</span>
            </div>
          </div>
        </div>

        <div class="border-t border-slate-100 pt-4 text-center text-[10px] text-slate-400 font-semibold">
          Thank you for your business! Designed with Modern Classic Template.
        </div>
      </div>


      <!-- 2. THERMAL RECEIPT TEMPLATE -->
      <div *ngSwitchCase="'thermal'" class="max-w-[340px] mx-auto bg-amber-50/20 p-5 rounded-2xl border-2 border-dashed border-slate-300 shadow-md font-mono text-xs text-slate-900 space-y-3">
        <!-- Shop Info -->
        <div class="text-center space-y-1">
          <h2 class="text-base font-black uppercase tracking-tight">{{ profile().shopName || 'Advika Collection' }}</h2>
          <p class="text-[10px] text-slate-600 leading-tight">{{ profile().shopAddress }}</p>
          <p class="text-[10px] text-slate-600 font-bold">TEL: {{ profile().shopPhone }}</p>
          <p class="text-[10px] font-black uppercase tracking-widest pt-1">*** SALES RECEIPT ***</p>
        </div>

        <div class="border-b border-dashed border-slate-400"></div>

        <!-- Meta -->
        <div class="text-[11px] space-y-0.5">
          <div class="flex justify-between"><span>RECEIPT:</span><span class="font-bold">{{ invoice.id }}</span></div>
          <div class="flex justify-between"><span>DATE:</span><span>{{ invoice.date | date:'short' }}</span></div>
          <div class="flex justify-between"><span>CUST:</span><span>{{ invoice.customer?.name || 'Walk-in' }}</span></div>
          <div class="flex justify-between"><span>PAY:</span><span class="uppercase font-bold">{{ invoice.paymentMode }}</span></div>
        </div>

        <div class="border-b border-dashed border-slate-400"></div>

        <!-- Items -->
        <div class="space-y-2 text-[11px]">
          @for (item of invoice.items; track $index) {
            <div>
              <p class="font-bold uppercase truncate">{{ item.name }}</p>
              <div class="flex justify-between text-[10px] text-slate-600">
                <span>{{ item.cartQuantity }} x ₹{{ item.sellingPrice }} @if (item.discountPercent) { (-{{ item.discountPercent }}%) }</span>
                <span class="font-bold text-slate-900">₹{{ lineTotal(item) }}</span>
              </div>
            </div>
          }
        </div>

        <div class="border-b border-dashed border-slate-400"></div>

        <!-- Totals -->
        <div class="space-y-1 text-xs">
          <div class="flex justify-between"><span>SUBTOTAL:</span><span>₹{{ invoice.subtotal }}</span></div>
          @if (invoice.totalDiscount > 0) {
            <div class="flex justify-between text-emerald-700"><span>DISCOUNT:</span><span>-₹{{ invoice.totalDiscount }}</span></div>
          }
          <div class="flex justify-between text-sm font-black pt-1 border-t border-slate-300">
            <span>TOTAL:</span>
            <span>₹{{ invoice.total }}</span>
          </div>
          <div class="flex justify-between text-[11px] text-slate-600">
            <span>PAID:</span>
            <span>₹{{ invoice.amountPaid || invoice.total }}</span>
          </div>
        </div>

        <div class="border-b border-dashed border-slate-400"></div>

        <!-- Barcode & Footer -->
        <div class="text-center space-y-2 pt-1">
          <div class="flex justify-center items-center gap-1 opacity-75">
            <span class="tracking-tighter font-serif text-lg font-black select-none">||| || |||| ||| |||| ||</span>
          </div>
          <p class="text-[10px] font-bold uppercase tracking-wider">THANK YOU! PLEASE VISIT AGAIN</p>
        </div>
      </div>


      <!-- 3. MINIMALIST ELEGANT TEMPLATE -->
      <div *ngSwitchCase="'minimal'" class="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-xs space-y-8 text-slate-900 font-sans">
        <!-- Top Minimal Header -->
        <div class="flex justify-between items-start pb-6 border-b border-slate-200">
          <div>
            <h2 class="text-3xl font-light tracking-widest text-slate-900 uppercase">{{ profile().shopName }}</h2>
            <p class="text-xs text-slate-400 tracking-wider uppercase mt-1">{{ profile().shopAddress }} &bull; {{ profile().shopPhone }}</p>
          </div>
          <div class="text-right">
            <p class="text-xs font-mono tracking-widest text-slate-400 uppercase">INVOICE NO.</p>
            <p class="text-lg font-light text-slate-900 font-mono">{{ invoice.id }}</p>
            <p class="text-xs text-slate-400 mt-1">{{ invoice.date | date:'longDate' }}</p>
          </div>
        </div>

        <!-- Billed info -->
        <div class="grid grid-cols-2 gap-4 text-xs font-light">
          <div>
            <p class="text-[10px] text-slate-400 tracking-widest uppercase mb-1">CUSTOMER</p>
            <p class="text-sm font-normal text-slate-900">{{ invoice.customer?.name || 'Walk-in Customer' }}</p>
            <p class="text-slate-500 mt-0.5">{{ invoice.customer?.phone }}</p>
          </div>
          <div class="text-right">
            <p class="text-[10px] text-slate-400 tracking-widest uppercase mb-1">PAYMENT METHOD</p>
            <p class="text-sm font-normal text-slate-900 uppercase">{{ invoice.paymentMode }}</p>
          </div>
        </div>

        <!-- Minimal Table -->
        <div class="space-y-3">
          <div class="grid grid-cols-12 text-[10px] text-slate-400 uppercase tracking-widest pb-2 border-b border-slate-200 font-medium">
            <span class="col-span-6">Description</span>
            <span class="col-span-2 text-right">Price</span>
            <span class="col-span-2 text-center">Qty</span>
            <span class="col-span-2 text-right">Total</span>
          </div>

          @for (item of invoice.items; track $index) {
            <div class="grid grid-cols-12 text-xs py-2 border-b border-slate-100 font-light items-center">
              <span class="col-span-6 font-normal text-slate-800">{{ item.name }}</span>
              <span class="col-span-2 text-right text-slate-600">{{ item.sellingPrice | currency:'INR' }}</span>
              <span class="col-span-2 text-center text-slate-600">{{ item.cartQuantity }}</span>
              <span class="col-span-2 text-right font-normal text-slate-900">{{ lineTotal(item) | currency:'INR' }}</span>
            </div>
          }
        </div>

        <!-- Minimal Totals -->
        <div class="flex justify-end pt-4">
          <div class="w-60 text-xs space-y-2">
            <div class="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span>{{ invoice.subtotal | currency:'INR' }}</span>
            </div>
            @if (invoice.totalDiscount > 0) {
              <div class="flex justify-between text-slate-500">
                <span>Discount</span>
                <span>- {{ invoice.totalDiscount | currency:'INR' }}</span>
              </div>
            }
            <div class="flex justify-between text-base font-normal pt-3 border-t border-slate-900 text-slate-900">
              <span>Total</span>
              <span>{{ invoice.total | currency:'INR' }}</span>
            </div>
          </div>
        </div>

        <div class="pt-8 text-center text-[10px] text-slate-400 uppercase tracking-widest">
          &mdash; Thank You &mdash;
        </div>
      </div>


      <!-- 4. CORPORATE GST TAX INVOICE TEMPLATE -->
      <div *ngSwitchCase="'corporate'" class="bg-white p-6 sm:p-8 rounded-2xl border-2 border-slate-800 shadow-sm space-y-5 text-slate-900 font-sans text-xs">
        <!-- Title Banner -->
        <div class="border-b-2 border-slate-800 pb-3 flex justify-between items-center">
          <div>
            <h1 class="text-xl font-black uppercase tracking-tight text-slate-900">{{ profile().shopName }}</h1>
            <p class="text-[11px] font-semibold text-slate-600">{{ profile().shopAddress }}</p>
            <p class="text-[11px] font-bold text-slate-800">GSTIN: {{ profile().gstin || '23AABCT123411Z5' }} | Ph: {{ profile().shopPhone }}</p>
          </div>
          <div class="text-right border-2 border-slate-800 p-2 rounded-lg bg-slate-50">
            <p class="font-black text-xs uppercase tracking-wider text-slate-900">TAX INVOICE</p>
            <p class="text-[10px] text-slate-600 font-bold">ORIGINAL FOR RECIPIENT</p>
          </div>
        </div>

        <!-- Meta Grid -->
        <div class="grid grid-cols-2 gap-4 border border-slate-300 p-3.5 rounded-lg bg-slate-50/50">
          <div>
            <p class="text-[10px] font-black text-slate-500 uppercase">BUYER (BILLED TO)</p>
            <p class="font-black text-sm text-slate-900 mt-0.5">{{ invoice.customer?.name || 'Walk-in Customer' }}</p>
            <p class="font-medium text-slate-600">{{ invoice.customer?.phone || 'N/A' }}</p>
            <p class="font-medium text-slate-500">Place of Supply: State Code (23)</p>
          </div>
          <div class="text-right space-y-1">
            <p><span class="font-bold text-slate-500">Invoice No:</span> <span class="font-black text-slate-900">{{ invoice.id }}</span></p>
            <p><span class="font-bold text-slate-500">Date of Issue:</span> <span class="font-bold text-slate-900">{{ invoice.date | date:'dd/MM/yyyy' }}</span></p>
            <p><span class="font-bold text-slate-500">Mode of Payment:</span> <span class="font-bold text-slate-900 uppercase">{{ invoice.paymentMode }}</span></p>
          </div>
        </div>

        <!-- Detailed Corporate Table -->
        <div class="overflow-x-auto border border-slate-300 rounded-lg">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-800 text-white font-black text-[10px] uppercase border-b border-slate-800">
                <th class="p-2 border-r border-slate-700 text-center w-8">#</th>
                <th class="p-2 border-r border-slate-700">Goods / Service Description</th>
                <th class="p-2 border-r border-slate-700 text-center">HSN</th>
                <th class="p-2 border-r border-slate-700 text-center">Qty</th>
                <th class="p-2 border-r border-slate-700 text-right">Rate</th>
                <th class="p-2 border-r border-slate-700 text-right">Disc</th>
                <th class="p-2 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 font-medium">
              @for (item of invoice.items; track $index) {
                <tr>
                  <td class="p-2 border-r border-slate-200 text-center font-bold text-slate-500">{{ $index + 1 }}</td>
                  <td class="p-2 border-r border-slate-200 font-bold text-slate-900">{{ item.name }}</td>
                  <td class="p-2 border-r border-slate-200 text-center text-slate-500 font-mono">{{ item.sku || '6204' }}</td>
                  <td class="p-2 border-r border-slate-200 text-center font-bold">{{ item.cartQuantity }}</td>
                  <td class="p-2 border-r border-slate-200 text-right">{{ item.sellingPrice | currency:'INR' }}</td>
                  <td class="p-2 border-r border-slate-200 text-right text-emerald-700">{{ item.discountPercent || 0 }}%</td>
                  <td class="p-2 text-right font-black">{{ lineTotal(item) | currency:'INR' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Corporate Breakdown -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end pt-1">
          <div class="space-y-2 border border-slate-300 p-3 rounded-lg text-[11px] text-slate-600 bg-slate-50">
            <p class="font-bold uppercase text-slate-800">Terms & Conditions:</p>
            <ol class="list-decimal list-inside space-y-0.5 text-[10px]">
              <li>Goods once sold will not be taken back without bill.</li>
              <li>Subject to local jurisdiction only.</li>
            </ol>
          </div>

          <div class="border border-slate-300 rounded-lg p-3 space-y-1.5 bg-slate-50">
            <div class="flex justify-between text-slate-600">
              <span>Taxable Value</span>
              <span class="font-bold text-slate-900">{{ invoice.subtotal | currency:'INR' }}</span>
            </div>
            @if (invoice.totalDiscount > 0) {
              <div class="flex justify-between text-emerald-700 font-bold">
                <span>Total Discount</span>
                <span>- {{ invoice.totalDiscount | currency:'INR' }}</span>
              </div>
            }
            <div class="flex justify-between text-slate-600 text-[10px]">
              <span>Estimated GST (Inclusive)</span>
              <span>₹0.00</span>
            </div>
            <div class="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-300">
              <span>Grand Total</span>
              <span>{{ invoice.total | currency:'INR' }}</span>
            </div>
          </div>
        </div>

        <!-- Signature Box -->
        <div class="pt-6 flex justify-between items-end text-slate-600 text-[10px]">
          <div>
            <p class="font-bold">E. & O.E.</p>
          </div>
          <div class="text-right border-t border-slate-400 pt-2 w-48">
            <p class="font-black text-slate-900">For {{ profile().shopName }}</p>
            <p class="text-slate-500 mt-4">Authorized Signatory</p>
          </div>
        </div>
      </div>


      <!-- 5. BOLD EMERALD BANNER TEMPLATE -->
      <div *ngSwitchCase="'bold'" class="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden space-y-0 text-slate-800 font-sans">
        <!-- Banner Header -->
        <div class="bg-emerald-700 text-white p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <span class="inline-block px-3 py-1 bg-emerald-800/80 text-emerald-100 rounded-lg text-[10px] font-black uppercase tracking-widest mb-2 border border-emerald-600">OFFICIAL BILL</span>
            <h2 class="text-3xl font-black tracking-tight uppercase">{{ profile().shopName }}</h2>
            <p class="text-xs text-emerald-100 mt-1 font-medium">{{ profile().shopAddress }}</p>
            <p class="text-xs text-emerald-200 mt-0.5 font-bold">Phone: {{ profile().shopPhone }}</p>
          </div>
          <div class="sm:text-right bg-emerald-800/90 p-4 rounded-xl border border-emerald-600 shrink-0 min-w-[160px]">
            <p class="text-[10px] font-black text-emerald-300 uppercase tracking-wider">INVOICE NO.</p>
            <p class="text-lg font-black text-white font-mono">{{ invoice.id }}</p>
            <p class="text-xs text-emerald-200 font-bold mt-1">{{ invoice.date | date:'mediumDate' }}</p>
          </div>
        </div>

        <div class="p-6 sm:p-8 space-y-6">
          <!-- Customer Strip -->
          <div class="flex justify-between items-center p-4 bg-emerald-50/60 rounded-xl border border-emerald-200/80">
            <div>
              <p class="text-[10px] font-black text-emerald-800 uppercase tracking-wider">CUSTOMER DETAILS</p>
              <p class="text-base font-black text-slate-900 mt-0.5">{{ invoice.customer?.name || 'Walk-in Customer' }}</p>
              <p class="text-xs text-slate-600 font-semibold">{{ invoice.customer?.phone || 'Counter Payment' }}</p>
            </div>
            <div class="text-right">
              <p class="text-[10px] font-black text-emerald-800 uppercase tracking-wider">PAYMENT</p>
              <span class="inline-block mt-1 px-3 py-1 rounded-lg bg-emerald-700 text-white font-black text-xs uppercase">
                {{ invoice.paymentMode }}
              </span>
            </div>
          </div>

          <!-- Items Table -->
          <div class="overflow-x-auto rounded-xl border border-slate-200">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-900 text-white font-black text-[11px] uppercase tracking-wider">
                  <th class="p-3 text-center w-10">#</th>
                  <th class="p-3">Item Name</th>
                  <th class="p-3 text-right">Unit Price</th>
                  <th class="p-3 text-center">Qty</th>
                  <th class="p-3 text-center">Discount</th>
                  <th class="p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 font-semibold text-slate-700">
                @for (item of invoice.items; track $index) {
                  <tr class="hover:bg-slate-50 transition-colors">
                    <td class="p-3 text-center font-bold text-slate-400">{{ $index + 1 }}</td>
                    <td class="p-3 font-extrabold text-slate-900">{{ item.name }}</td>
                    <td class="p-3 text-right">{{ item.sellingPrice | currency:'INR' }}</td>
                    <td class="p-3 text-center font-bold">{{ item.cartQuantity }}</td>
                    <td class="p-3 text-center text-emerald-600 font-extrabold">{{ item.discountPercent || 0 }}%</td>
                    <td class="p-3 text-right font-black text-slate-900">{{ lineTotal(item) | currency:'INR' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Bold Summary Card -->
          <div class="flex flex-col sm:flex-row justify-between items-end gap-6 pt-2">
            <div class="text-xs text-slate-500 font-medium">
              <p class="font-bold text-slate-800 text-[11px] uppercase mb-1">Thank you for your purchase!</p>
              <p>For support or returns, please keep this sales voucher safe.</p>
            </div>

            <div class="w-full sm:w-72 bg-emerald-900 text-white p-5 rounded-2xl shadow-lg space-y-2.5">
              <div class="flex justify-between text-emerald-200 text-xs">
                <span>Gross Subtotal</span>
                <span class="font-bold text-white">{{ invoice.subtotal | currency:'INR' }}</span>
              </div>
              @if (invoice.totalDiscount > 0) {
                <div class="flex justify-between text-emerald-300 text-xs font-bold">
                  <span>Savings Applied</span>
                  <span>- {{ invoice.totalDiscount | currency:'INR' }}</span>
                </div>
              }
              <div class="pt-2 border-t border-emerald-700 flex justify-between text-lg font-black text-white">
                <span>Total Amount</span>
                <span>{{ invoice.total | currency:'INR' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  `
})
export class InvoiceTemplatePreviewComponent {
  private settingsService = inject(SettingsService);

  @Input() invoice!: Invoice;
  @Input() template?: InvoiceTemplateId;
  @Input() customProfile?: BusinessProfile;

  activeTemplate = computed<InvoiceTemplateId>(() => {
    return this.template || this.invoice?.template || this.settingsService.defaultTemplate() || 'modern';
  });

  profile = computed<BusinessProfile>(() => {
    return this.customProfile || this.settingsService.businessProfile();
  });

  balance = computed<number>(() => {
    if (!this.invoice) return 0;
    const paid = typeof this.invoice.amountPaid === 'number' ? this.invoice.amountPaid : this.invoice.total;
    return Math.max(0, Math.round(this.invoice.total) - paid);
  });

  lineTotal(item: any): number {
    const sub = (item.sellingPrice || 0) * (item.cartQuantity || 0);
    return sub - (sub * (item.discountPercent || 0)) / 100;
  }
}
