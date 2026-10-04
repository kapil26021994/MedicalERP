import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerService } from '../../services/customer.service';
import { LoaderComponent } from '../layout/loader.component';
import { InvoiceService } from '../../services/invoice.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

@Component({
  selector: 'app-customer-detail',
  imports: [
    CommonModule,
    RouterLink,
    CurrencyPipe,
    DatePipe,
    LoaderComponent
  ],
  template: `
    <div class="space-y-6 animate-fadeInUp relative">
      
      @if (isLoading()) {
        <div class="fixed inset-0 bg-white/60 backdrop-blur-[2px] z-[50] flex items-center justify-center">
          <app-loader message="Syncing Profile Data..."></app-loader>
        </div>
      }

      <!-- Top Navigation Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div class="flex items-center gap-4">
          <a routerLink="/customers" class="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors">
            <span class="material-icons-outlined text-xl">arrow_back</span>
          </a>
          <div>
            <h1 class="text-2xl font-extrabold text-slate-900 tracking-tight">Client Account Analytics</h1>
            <p class="text-xs text-slate-500 font-semibold mt-0.5">Comprehensive sales history and lifetime value ledger</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <a routerLink="/invoices/new" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20">
            <span class="material-icons-outlined text-base">receipt_long</span>
            <span>New Invoice</span>
          </a>
        </div>
      </div>

      @if (customer(); as c) {
        <!-- Profile & Summary Stats Card -->
        <div class="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
            <div class="flex items-center gap-4">
              <div class="w-16 h-16 rounded-2xl bg-indigo-600 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20 shrink-0">
                {{ c.name.charAt(0) }}
              </div>
              <div>
                <h2 class="text-xl font-extrabold text-slate-900">{{ c.name }}</h2>
                <div class="flex flex-wrap items-center gap-3 mt-1 text-xs font-semibold text-slate-500">
                  <span class="flex items-center gap-1">
                    <span class="material-icons-outlined text-sm text-slate-400">phone</span>
                    <span>{{ c.phone }}</span>
                  </span>
                  @if (c.email) {
                    <span class="flex items-center gap-1">
                      <span class="material-icons-outlined text-sm text-slate-400">email</span>
                      <span>{{ c.email }}</span>
                    </span>
                  }
                </div>
              </div>
            </div>

            @if (lastPaymentDate()) {
              <div class="text-xs font-semibold text-slate-500">
                Last Transaction: <span class="text-slate-900 font-bold">{{ lastPaymentDate() | date:'mediumDate' }}</span>
              </div>
            }
          </div>

          <!-- Stats Grid -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold">
            <div class="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
              <p class="text-slate-400 font-bold uppercase text-[10px]">Total Invoices</p>
              <p class="text-xl font-extrabold text-slate-900 mt-1">{{ invoices().length }}</p>
            </div>

            <div class="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/60">
              <p class="text-emerald-700 font-bold uppercase text-[10px]">Total Paid</p>
              <p class="text-xl font-extrabold text-emerald-900 mt-1">{{ totalPaid() | currency:'INR':'symbol':'1.0-0' }}</p>
            </div>

            <div class="p-4 rounded-xl bg-rose-50/60 border border-rose-200/60">
              <p class="text-rose-700 font-bold uppercase text-[10px]">Outstanding Balance</p>
              <p class="text-xl font-extrabold text-rose-900 mt-1">{{ totalOutstanding() | currency:'INR':'symbol':'1.0-0' }}</p>
            </div>

            <div class="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200/60">
              <p class="text-indigo-700 font-bold uppercase text-[10px]">Average Order Value</p>
              <p class="text-xl font-extrabold text-indigo-900 mt-1">{{ (totalSpend() / (invoices().length || 1)) | currency:'INR':'symbol':'1.0-0' }}</p>
            </div>
          </div>
        </div>

        <!-- Ledger Table -->
        <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div class="p-5 border-b border-slate-200/80">
            <h3 class="font-extrabold text-sm text-slate-900">Purchase History & Invoices</h3>
          </div>

          <div class="overflow-x-auto hidden md:block">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-white border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th class="py-2.5 px-3 pl-5">Invoice ID</th>
                  <th class="py-2.5 px-3">Timestamp</th>
                  <th class="py-2.5 px-3">Items Summary</th>
                  <th class="py-2.5 px-3 text-center">Payment</th>
                  <th class="py-2.5 px-3 text-right">Bill Value</th>
                  <th class="py-2.5 px-3 pr-5 text-right">Balance</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-xs">
                @for (inv of invoices(); track inv.id) {
                  <tr class="hover:bg-slate-50/80 transition-colors">
                    <td class="py-2.5 px-3 pl-5">
                      <span class="font-mono font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                        {{ inv.id }}
                      </span>
                    </td>

                    <td class="py-2.5 px-3">
                      <p class="font-bold text-slate-900 leading-tight">{{ inv.date | date:'mediumDate' }}</p>
                      <p class="text-[10px] text-slate-400 font-semibold leading-none mt-0.5">{{ inv.date | date:'shortTime' }}</p>
                    </td>

                    <td class="py-2.5 px-3">
                      <span class="font-bold text-slate-900">{{ inv.items.length }} {{ inv.items.length === 1 ? 'item' : 'items' }}</span>
                    </td>

                    <td class="py-2.5 px-3 text-center">
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold border uppercase tracking-wider bg-slate-100 text-slate-700">
                        {{ inv.paymentMode }}
                      </span>
                    </td>

                    <td class="py-2.5 px-3 text-right font-extrabold text-slate-900">
                      {{ inv.total | currency:'INR' }}
                    </td>

                    <td class="py-2.5 px-3 pr-5 text-right font-bold" [class]="(inv.total - inv.amountPaid) > 0 ? 'text-rose-600' : 'text-emerald-600'">
                      {{ (inv.total - inv.amountPaid) | currency:'INR' }}
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6" class="p-12 text-center text-slate-400">
                      <span class="material-icons-outlined text-4xl text-slate-300 mb-2">receipt</span>
                      <p class="font-bold text-sm text-slate-600">No purchase records for this customer</p>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Mobile Card View -->
          <div class="md:hidden divide-y divide-slate-100 bg-white">
            @for (inv of invoices(); track inv.id) {
              <div class="p-4 space-y-3">
                <div class="flex items-center justify-between">
                  <div>
                    <span class="font-mono text-[10px] font-extrabold bg-slate-100 px-2 py-0.5 rounded text-slate-700 border border-slate-200/60">
                      {{ inv.id }}
                    </span>
                    <div class="flex items-center gap-2 mt-1">
                      <span class="text-[11px] text-slate-500 font-medium">{{ inv.date | date:'mediumDate' }}</span>
                    </div>
                  </div>
                  <div class="text-right">
                    <p class="font-extrabold text-slate-900 text-sm">{{ inv.total | currency:'INR' }}</p>
                    <span class="inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-700">
                      {{ inv.paymentMode }}
                    </span>
                  </div>
                </div>
                
                <div class="flex items-center justify-between border-t border-slate-50 pt-3">
                  <span class="text-[11px] font-bold text-slate-900">{{ inv.items.length }} {{ inv.items.length === 1 ? 'item' : 'items' }}</span>
                  <div class="text-right">
                    <span class="text-[10px] font-bold pr-1 text-slate-500">Balance:</span>
                    <span class="text-[11px] font-bold" [class]="(inv.total - inv.amountPaid) > 0 ? 'text-rose-600' : 'text-emerald-600'">
                      {{ (inv.total - inv.amountPaid) | currency:'INR' }}
                    </span>
                  </div>
                </div>
              </div>
            } @empty {
              <div class="p-8 text-center text-slate-400">
                <span class="material-icons-outlined text-3xl text-slate-300 mb-2">receipt</span>
                <p class="font-bold text-sm text-slate-600">No purchase records for this customer</p>
              </div>
            }
          </div>
        </div>
      } @else {
        <div class="bg-white rounded-2xl p-16 text-center border border-slate-200">
          <p class="font-bold text-slate-600 text-base">Customer Profile Not Found</p>
          <a routerLink="/customers" class="mt-4 inline-block px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold">Back to Customers</a>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerDetailComponent {
  private route = inject(ActivatedRoute);
  private customerService = inject(CustomerService);
  private invoiceService = inject(InvoiceService);

  isLoading = computed(() => this.customerService.isLoading() || this.invoiceService.isLoading());

  customerId = toSignal(this.route.params.pipe(map(p => p['id'])));

  customer = computed(() => {
    const id = this.customerId();
    if (!id) return null;
    return this.customerService.customers().find(c => c.id === id);
  });

  invoices = computed(() => {
    const c = this.customer();
    if (!c) return [];
    return this.invoiceService.invoices()
      .filter(inv => inv.customer?.id === c.id)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  });

  totalSpend = computed(() => {
    return this.invoices().reduce((sum, inv) => sum + inv.total, 0);
  });

  totalPaid = computed(() => {
    return this.invoices().reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);
  });

  totalOutstanding = computed(() => {
    return this.totalSpend() - this.totalPaid();
  });

  lastPaymentDate = computed(() => {
    const invs = this.invoices();
    if (invs.length === 0) return null;
    return invs[0].date;
  });
}