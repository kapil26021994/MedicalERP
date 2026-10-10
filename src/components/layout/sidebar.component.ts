import { Component, ChangeDetectionStrategy, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslationService } from '../../services/translation.service';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <aside class="w-64 bg-slate-900 text-slate-300 flex flex-col h-full border-r border-slate-800 shadow-xl select-none">
      
      <!-- Brand & Organization Header -->
      <div class="p-4 border-b border-slate-800/80 flex items-center justify-between">
        <a routerLink="/dashboard" class="flex items-center gap-3 group">
          <div class="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 group-hover:bg-blue-500 transition-all shrink-0">
            <span class="material-icons-outlined text-2xl">inventory_2</span>
          </div>
          <div class="leading-tight overflow-hidden">
            <h1 class="font-extrabold text-base text-white tracking-tight truncate flex items-center gap-1">
              Advika<span class="text-blue-400">ERP</span>
            </h1>
            <p class="text-[10px] font-bold text-slate-400 tracking-wider uppercase mt-0.5 truncate">Inventory & Billing</p>
          </div>
        </a>
      </div>

      <!-- Store Selector Badge -->
      <div class="px-4 py-3 bg-slate-950/50 border-b border-slate-800/60 flex items-center justify-between text-xs">
        <div class="flex items-center gap-2 overflow-hidden">
          <span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse"></span>
          <span class="font-semibold text-slate-200 truncate">{{ ts.t('header.mainStore') }}</span>
        </div>
        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/50">INR ₹</span>
      </div>

      <!-- Navigation Sections -->
      <nav class="flex-1 px-3 py-4 space-y-6 overflow-y-auto custom-scrollbar">
        
        <!-- CORE SECTION -->
        @if (settingsService.headerTabVisibility().dashboard) {
        <div>
          <p class="px-3 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase mb-1.5">{{ ts.t('nav.main') }}</p>
          <div class="space-y-1">
            <a routerLink="/dashboard" 
               routerLinkActive="bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30" 
               (click)="onNavigate()"
               class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all group">
              <span class="material-icons-outlined text-lg text-slate-400 group-hover:text-blue-400 group-[.bg-blue-600]:text-white transition-colors">dashboard</span>
              <span>{{ ts.t('nav.dashboard') }}</span>
            </a>
          </div>
        </div>
        }

        <!-- INVENTORY SECTION -->
        @if (settingsService.headerTabVisibility().inventory) {
        <div>
          <p class="px-3 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase mb-1.5">{{ ts.t('nav.inventory') }}</p>
          <div class="space-y-1">
            <a routerLink="/inventory" 
               routerLinkActive="bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30" 
               (click)="onNavigate()"
               class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all group">
              <span class="material-icons-outlined text-lg text-slate-400 group-hover:text-blue-400 group-[.bg-blue-600]:text-white transition-colors">inventory_2</span>
              <span>{{ ts.t('nav.inventory') }}</span>
            </a>
          </div>
        </div>
        }

        <!-- PURCHASES SECTION -->
        @if (settingsService.headerTabVisibility().purchases || settingsService.headerTabVisibility().challan) {
        <div>
          <p class="px-3 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase mb-1.5">{{ ts.t('nav.procurement') }}</p>
          <div class="space-y-1">
            @if (settingsService.headerTabVisibility().purchases) {
            <a routerLink="/purchases" 
               routerLinkActive="bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30" 
               (click)="onNavigate()"
               class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all group">
              <span class="material-icons-outlined text-lg text-slate-400 group-hover:text-blue-400 group-[.bg-blue-600]:text-white transition-colors">local_shipping</span>
              <span>{{ ts.t('nav.purchases') }}</span>
            </a>
            }

            @if (settingsService.headerTabVisibility().challan) {
            <a routerLink="/challan" 
               routerLinkActive="bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30" 
               (click)="onNavigate()"
               class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all group">
              <span class="material-icons-outlined text-lg text-slate-400 group-hover:text-blue-400 group-[.bg-blue-600]:text-white transition-colors">receipt_long</span>
              <span>{{ ts.t('nav.challan') }}</span>
            </a>
            }
          </div>
        </div>
        }

        <!-- FINANCE & SALES SECTION -->
        @if (settingsService.headerTabVisibility().sales || settingsService.headerTabVisibility().invoices || settingsService.headerTabVisibility().expenses) {
        <div>
          <p class="px-3 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase mb-1.5">{{ ts.t('nav.salesExpense') }}</p>
          <div class="space-y-1">
            @if (settingsService.headerTabVisibility().sales) {
            <a routerLink="/sales" 
               routerLinkActive="bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30" 
               (click)="onNavigate()"
               class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all group">
              <span class="material-icons-outlined text-lg text-slate-400 group-hover:text-blue-400 group-[.bg-blue-600]:text-white transition-colors">point_of_sale</span>
              <span>{{ ts.t('nav.sales') }}</span>
            </a>
            }

            @if (settingsService.headerTabVisibility().invoices) {
            <a routerLink="/invoices" 
               routerLinkActive="bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30" 
               (click)="onNavigate()"
               class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all group">
              <span class="material-icons-outlined text-lg text-slate-400 group-hover:text-blue-400 group-[.bg-blue-600]:text-white transition-colors">receipt_long</span>
              <span>{{ ts.t('nav.invoices') }}</span>
            </a>
            }

            @if (settingsService.headerTabVisibility().expenses) {
            <a routerLink="/expenses" 
               routerLinkActive="bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30" 
               (click)="onNavigate()"
               class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all group">
              <span class="material-icons-outlined text-lg text-slate-400 group-hover:text-blue-400 group-[.bg-blue-600]:text-white transition-colors">payments</span>
              <span>{{ ts.t('nav.expenses') }}</span>
            </a>
            }
          </div>
        </div>
        }

        <!-- RELATIONS SECTION -->
        @if (settingsService.headerTabVisibility().customers) {
        <div>
          <p class="px-3 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase mb-1.5">{{ ts.t('nav.customers') }}</p>
          <div class="space-y-1">
            <a routerLink="/customers" 
               routerLinkActive="bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30" 
               (click)="onNavigate()"
               class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all group">
              <span class="material-icons-outlined text-lg text-slate-400 group-hover:text-blue-400 group-[.bg-blue-600]:text-white transition-colors">groups</span>
              <span>{{ ts.t('nav.customers') }}</span>
            </a>
          </div>
        </div>
        }

      </nav>

      <!-- Sidebar Footer Status -->
      <div class="p-3 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span class="font-medium text-slate-300">GST Ready (18%)</span>
        </div>
        <span class="text-[10px] font-bold text-slate-400">v2.4</span>
      </div>

    </aside>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar {
      width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent {
  navigate = output<void>();
  ts = inject(TranslationService);
  settingsService = inject(SettingsService);

  onNavigate(): void {
    this.navigate.emit();
  }
}
