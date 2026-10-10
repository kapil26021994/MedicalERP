import { Component, ChangeDetectionStrategy, signal, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { TranslationService, Language } from '../../services/translation.service';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <header class="h-16 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
      
      <!-- Left: Mobile Menu Toggle, Global Search & Header Navigation Tabs -->
      <div class="flex items-center gap-3 flex-1 min-w-0">
        <button (click)="onToggleSidebar()" class="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
          <span class="material-icons-outlined text-xl">menu</span>
        </button>

        <!-- Global Search Bar -->
        <div class="relative w-full max-w-xs xl:max-w-sm hidden sm:block">
          <span class="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">search</span>
          <input type="text" 
                 [placeholder]="ts.t('header.searchPlaceholder')" 
                 class="w-full pl-9 pr-3 py-1.5 bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-xs text-slate-800 placeholder-slate-400 rounded-xl border border-slate-200/80 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-medium">
        </div>

        <!-- Header Navigation Tabs -->
        <nav class="hidden lg:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/70 ml-1">
          @if (settingsService.headerTabVisibility().dashboard) {
          <a routerLink="/dashboard" 
             routerLinkActive="bg-white text-blue-700 font-bold shadow-2xs"
             [routerLinkActiveOptions]="{exact: true}"
             class="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all flex items-center gap-1.5">
            <span class="material-icons-outlined text-base text-blue-600">dashboard</span>
            <span>{{ ts.t('nav.dashboard') }}</span>
          </a>
          }

          @if (settingsService.headerTabVisibility().sales) {
          <a routerLink="/sales" 
             routerLinkActive="bg-white text-purple-700 font-bold shadow-2xs"
             class="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all flex items-center gap-1.5">
            <span class="material-icons-outlined text-base text-purple-600">analytics</span>
            <span>{{ ts.t('nav.sales') }}</span>
          </a>
          }

          @if (settingsService.headerTabVisibility().invoices) {
          <a routerLink="/invoices" 
             routerLinkActive="bg-white text-blue-700 font-bold shadow-2xs"
             class="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all flex items-center gap-1.5">
            <span class="material-icons-outlined text-base text-blue-600">receipt_long</span>
            <span>{{ ts.t('nav.invoices') }}</span>
          </a>
          }

          @if (settingsService.headerTabVisibility().inventory) {
          <a routerLink="/inventory" 
             routerLinkActive="bg-white text-indigo-700 font-bold shadow-2xs"
             class="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all flex items-center gap-1.5">
            <span class="material-icons-outlined text-base text-indigo-600">inventory_2</span>
            <span>{{ ts.t('nav.inventory') }}</span>
          </a>
          }

          @if (settingsService.headerTabVisibility().purchases) {
          <a routerLink="/purchases"
             routerLinkActive="bg-white text-amber-700 font-bold shadow-2xs"
             class="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all flex items-center gap-1.5">
            <span class="material-icons-outlined text-base text-amber-600">local_shipping</span>
            <span>{{ ts.t('nav.purchases') }}</span>
          </a>
          }

          @if (settingsService.headerTabVisibility().challan) {
          <a routerLink="/challan"
             routerLinkActive="bg-white text-teal-700 font-bold shadow-2xs"
             class="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all flex items-center gap-1.5">
            <span class="material-icons-outlined text-base text-teal-600">receipt_long</span>
            <span>{{ ts.t('nav.challan') }}</span>
          </a>
          }

          @if (settingsService.headerTabVisibility().expenses) {
          <a routerLink="/expenses"
             routerLinkActive="bg-white text-rose-700 font-bold shadow-2xs"
             class="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all flex items-center gap-1.5">
            <span class="material-icons-outlined text-base text-rose-600">payments</span>
            <span>{{ ts.t('nav.expenses') }}</span>
          </a>
          }

          @if (settingsService.headerTabVisibility().customers) {
          <a routerLink="/customers"
             routerLinkActive="bg-white text-cyan-700 font-bold shadow-2xs"
             class="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all flex items-center gap-1.5">
            <span class="material-icons-outlined text-base text-cyan-600">groups</span>
            <span>{{ ts.t('nav.customers') }}</span>
          </a>
          }
        </nav>
      </div>

      <!-- Right: Quick Actions & Profile -->
      <div class="flex items-center gap-2 sm:gap-3">
        
        <!-- Language Switcher Dropdown -->
        <div class="relative">
          <button (click)="toggleLangMenu()" 
                  class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-bold text-xs transition-all border border-slate-200">
            <span class="material-icons-outlined text-base text-indigo-600">translate</span>
            <span class="uppercase tracking-wider font-extrabold text-[11px]">{{ ts.currentLang() }}</span>
            <span class="hidden sm:inline text-slate-500 font-semibold text-[11px]">
              ({{ ts.currentLang() === 'en' ? 'English' : 'हिंदी' }})
            </span>
            <span class="material-icons-outlined text-xs text-slate-400">arrow_drop_down</span>
          </button>

          @if (showLangMenu()) {
            <div (click)="closeLangMenu()" class="fixed inset-0 z-40"></div>
            <div class="absolute right-0 mt-2 w-44 bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 py-1.5 z-50 text-xs font-semibold">
              <div class="px-3 py-1 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Select Language / भाषा चुनें
              </div>
              <button (click)="selectLanguage('en')" 
                      [class.bg-indigo-50]="ts.currentLang() === 'en'"
                      [class.text-indigo-700]="ts.currentLang() === 'en'"
                      class="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 text-slate-700 transition-colors text-left font-bold">
                <span class="flex items-center gap-2">
                  <span class="text-sm">🇬🇧</span>
                  <span>English (EN)</span>
                </span>
                @if (ts.currentLang() === 'en') {
                  <span class="material-icons-outlined text-sm text-indigo-600">check</span>
                }
              </button>
              <button (click)="selectLanguage('hi')" 
                      [class.bg-indigo-50]="ts.currentLang() === 'hi'"
                      [class.text-indigo-700]="ts.currentLang() === 'hi'"
                      class="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 text-slate-700 transition-colors text-left font-bold">
                <span class="flex items-center gap-2">
                  <span class="text-sm">🇮🇳</span>
                  <span>Hindi (हिंदी)</span>
                </span>
                @if (ts.currentLang() === 'hi') {
                  <span class="material-icons-outlined text-sm text-indigo-600">check</span>
                }
              </button>
            </div>
          }
        </div>

        <!-- Sales Quick Button -->
        @if (settingsService.headerTabVisibility().sales) {
        <a routerLink="/sales" 
           routerLinkActive="ring-2 ring-purple-300"
           class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all shadow-xs">
          <span class="material-icons-outlined text-base">analytics</span>
          <span class="hidden sm:inline">{{ ts.t('nav.sales') }}</span>
        </a>
        }

        <!-- POS Terminal Quick Button -->
        <a routerLink="/pos" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-xs">
          <span class="material-icons-outlined text-base">point_of_sale</span>
          <span class="hidden sm:inline">{{ ts.t('header.posTerminal') }}</span>
        </a>

        <!-- Quick Create Dropdown Button -->
        <div class="relative">
          <button (click)="toggleQuickMenu()" class="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-xs">
            <span class="material-icons-outlined text-base">add</span>
            <span>{{ ts.t('header.new') }}</span>
            <span class="material-icons-outlined text-xs">arrow_drop_down</span>
          </button>

          @if (showQuickMenu()) {
            <div (click)="closeQuickMenu()" class="fixed inset-0 z-40"></div>
            <div class="absolute right-0 mt-2 w-52 bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 py-2 z-50 text-xs font-semibold">
              @if (settingsService.headerTabVisibility().sales) {
              <a routerLink="/sales" (click)="closeQuickMenu()" class="flex items-center gap-2.5 px-4 py-2 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition-colors border-b border-slate-100">
                <span class="material-icons-outlined text-base text-purple-600">analytics</span>
                <span>{{ ts.t('quick.salesAnalytics') }}</span>
              </a>
              }
              <a routerLink="/pos" (click)="closeQuickMenu()" class="flex items-center gap-2.5 px-4 py-2 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition-colors">
                <span class="material-icons-outlined text-base text-emerald-600">point_of_sale</span>
                <span>{{ ts.t('quick.posBill') }}</span>
              </a>
              @if (settingsService.headerTabVisibility().invoices) {
              <a routerLink="/invoices" (click)="closeQuickMenu()" class="flex items-center gap-2.5 px-4 py-2 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition-colors">
                <span class="material-icons-outlined text-base text-blue-600">receipt_long</span>
                <span>{{ ts.t('quick.createInvoice') }}</span>
              </a>
              }
              @if (settingsService.headerTabVisibility().inventory) {
              <a routerLink="/inventory" (click)="closeQuickMenu()" class="flex items-center gap-2.5 px-4 py-2 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition-colors">
                <span class="material-icons-outlined text-base text-indigo-600">add_box</span>
                <span>{{ ts.t('quick.addInventory') }}</span>
              </a>
              }
              @if (settingsService.headerTabVisibility().purchases) {
              <a routerLink="/purchases" (click)="closeQuickMenu()" class="flex items-center gap-2.5 px-4 py-2 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition-colors">
                <span class="material-icons-outlined text-base text-amber-600">local_shipping</span>
                <span>{{ ts.t('quick.recordPurchase') }}</span>
              </a>
              }
              @if (settingsService.headerTabVisibility().challan) {
              <a routerLink="/challan" (click)="closeQuickMenu()" class="flex items-center gap-2.5 px-4 py-2 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition-colors">
                <span class="material-icons-outlined text-base text-teal-600">receipt_long</span>
                <span>{{ ts.t('nav.challan') }}</span>
              </a>
              }
              @if (settingsService.headerTabVisibility().expenses) {
              <a routerLink="/expenses" (click)="closeQuickMenu()" class="flex items-center gap-2.5 px-4 py-2 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition-colors border-t border-slate-100">
                <span class="material-icons-outlined text-base text-rose-600">payments</span>
                <span>{{ ts.t('quick.addExpense') }}</span>
              </a>
              }
            </div>
          }
        </div>

        <div class="h-5 w-px bg-slate-200 hidden sm:block"></div>

        <!-- User Profile Pill & Sign Out -->
        <div class="relative flex items-center gap-2 pl-1">
          <div class="text-right hidden sm:block leading-tight">
            <p class="font-bold text-xs text-slate-900 truncate max-w-[140px]">
              {{ getUserDisplayName() }}
            </p>
            <p class="text-[10px] text-blue-600 font-bold">
              {{ supabaseService.isDemoUser() ? ts.t('header.demoManager') : ts.t('header.storeManager') }}
            </p>
          </div>
          <button (click)="toggleProfileMenu()" class="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 border border-blue-200 font-black text-xs flex items-center justify-center hover:bg-blue-200 transition-colors">
            {{ getUserInitials() }}
          </button>

          @if (showProfileMenu()) {
            <div (click)="closeProfileMenu()" class="fixed inset-0 z-40"></div>
            <div class="absolute right-0 top-10 w-52 bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 py-2 z-50 text-xs font-semibold">
              <div class="px-4 py-2 border-b border-slate-100">
                <p class="font-bold text-slate-900 truncate">{{ getUserDisplayName() }}</p>
                <p class="text-[10px] text-slate-500 truncate">{{ getUserEmail() }}</p>
              </div>
              <a routerLink="/settings" (click)="closeProfileMenu()" class="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 text-slate-700 transition-colors">
                <span class="material-icons-outlined text-base text-slate-500">settings</span>
                <span>{{ ts.t('header.accountSettings') }}</span>
              </a>
              <button (click)="onSignOut()" class="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-rose-50 text-rose-600 transition-colors text-left border-t border-slate-100 font-bold">
                <span class="material-icons-outlined text-base">logout</span>
                <span>{{ ts.t('header.signOut') }}</span>
              </button>
            </div>
          }
        </div>

      </div>
    </header>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {
  settingsService = inject(SettingsService);
  toggleSidebar = output<void>();
  showQuickMenu = signal(false);
  showProfileMenu = signal(false);
  showLangMenu = signal(false);

  supabaseService = inject(SupabaseService);
  ts = inject(TranslationService);
  private router = inject(Router);

  onToggleSidebar(): void {
    this.toggleSidebar.emit();
  }

  toggleQuickMenu(): void {
    this.showQuickMenu.update(v => !v);
  }

  closeQuickMenu(): void {
    this.showQuickMenu.set(false);
  }

  toggleProfileMenu(): void {
    this.showProfileMenu.update(v => !v);
  }

  closeProfileMenu(): void {
    this.showProfileMenu.set(false);
  }

  toggleLangMenu(): void {
    this.showLangMenu.update(v => !v);
  }

  closeLangMenu(): void {
    this.showLangMenu.set(false);
  }

  selectLanguage(lang: Language): void {
    this.ts.setLanguage(lang);
    this.closeLangMenu();
  }

  getUserDisplayName(): string {
    const user = this.supabaseService.currentUser();
    if (user?.user_metadata?.['full_name']) {
      return user.user_metadata['full_name'];
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'Store Manager';
  }

  getUserEmail(): string {
    return this.supabaseService.currentUser()?.email || 'demo@advikaerp.com';
  }

  getUserInitials(): string {
    const name = this.getUserDisplayName();
    return name.slice(0, 2).toUpperCase();
  }

  async onSignOut() {
    this.closeProfileMenu();
    await this.supabaseService.signOut();
    this.router.navigate(['/login']);
  }
}
