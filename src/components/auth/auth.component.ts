import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { ToastService } from '../../services/toast.service';
import { CustomerService } from '../../services/customer.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
    <div class="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans text-slate-100 relative overflow-hidden">
      
      <!-- Ambient Background Glows -->
      <div class="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>

      <div class="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6">
        
        <!-- Header Brand Logo -->
        <div class="text-center space-y-2">
          <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/30 mb-2">
            <span class="material-icons-outlined text-3xl">inventory_2</span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center justify-center gap-1.5">
            Advika<span class="text-blue-500">ERP</span>
          </h1>
          <p class="text-xs text-slate-400 font-semibold tracking-wide uppercase">
            Cloud Inventory & Billing Suite
          </p>
        </div>

        <!-- Mode Tab Switcher -->
        <div class="grid grid-cols-2 p-1 bg-slate-950 rounded-2xl border border-slate-800/80 text-xs font-bold">
          <button (click)="isSignUp.set(false)" 
                  [class.bg-blue-600]="!isSignUp()" 
                  [class.text-white]="!isSignUp()" 
                  [class.text-slate-400]="isSignUp()" 
                  class="py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5">
            <span class="material-icons-outlined text-sm">login</span>
            <span>Sign In</span>
          </button>
          <button (click)="isSignUp.set(true)" 
                  [class.bg-blue-600]="isSignUp()" 
                  [class.text-white]="isSignUp()" 
                  [class.text-slate-400]="!isSignUp()" 
                  class="py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5">
            <span class="material-icons-outlined text-sm">person_add</span>
            <span>Register Client</span>
          </button>
        </div>

        <!-- Alert Error Message -->
        @if (errorMessage()) {
          <div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
            <span class="material-icons-outlined text-base shrink-0">error_outline</span>
            <span>{{ errorMessage() }}</span>
          </div>
        }

        <!-- Alert Success Message -->
        @if (successMessage()) {
          <div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <span class="material-icons-outlined text-base shrink-0">check_circle</span>
            <span>{{ successMessage() }}</span>
          </div>
        }

        <!-- Auth Form -->
        <form [formGroup]="authForm" (ngSubmit)="onSubmit()" class="space-y-4">
          
          @if (isSignUp()) {
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Full Name / Business Name
              </label>
              <div class="relative">
                <span class="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg">person</span>
                <input type="text" 
                       formControlName="fullName" 
                       placeholder="e.g. Aditi Sharma" 
                       class="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium">
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Phone Number
              </label>
              <div class="relative">
                <span class="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg">call</span>
                <input type="text" 
                       formControlName="phone" 
                       placeholder="e.g. 9876543210" 
                       class="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium">
              </div>
            </div>
          }

          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Email Address
            </label>
            <div class="relative">
              <span class="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg">email</span>
              <input type="email" 
                     formControlName="email" 
                     placeholder="admin@advikaerp.com" 
                     class="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium">
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Password
            </label>
            <div class="relative">
              <span class="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg">lock</span>
              <input type="password" 
                     formControlName="password" 
                     placeholder="••••••••" 
                     class="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium">
            </div>
          </div>

          <button type="submit" 
                  [disabled]="authForm.invalid || loading()" 
                  class="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            @if (loading()) {
              <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>Processing Client Registration...</span>
            } @else {
              <span class="material-icons-outlined text-base">{{ isSignUp() ? 'how_to_reg' : 'arrow_forward' }}</span>
              <span>{{ isSignUp() ? 'Register & Save to DB' : 'Sign In to Dashboard' }}</span>
            }
          </button>
        </form>

        <!-- Divider -->
        <div class="relative flex items-center justify-center">
          <div class="border-t border-slate-800 w-full"></div>
          <span class="bg-slate-900 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest relative z-10">
            or options
          </span>
        </div>

        <!-- Demo / Offline Manager Access -->
        @if (supabaseService.isLocalDemoAvailable()) {
          <button (click)="onDemoLogin()"
                  type="button"
                  class="w-full py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 hover:text-emerald-200 font-bold text-xs rounded-xl border border-emerald-500/30 transition-all flex items-center justify-center gap-2">
            <span class="material-icons-outlined text-base text-emerald-400">storefront</span>
            <span>Instant Login: Continue as Store Manager</span>
          </button>
        }

        <!-- Supabase Connection Config Toggle -->
        <div class="pt-2 border-t border-slate-800/80">
          <button (click)="showConfig.set(!showConfig())" 
                  type="button" 
                  class="w-full flex items-center justify-between text-left text-[11px] font-bold text-slate-400 hover:text-slate-200 transition-colors">
            <span class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full" [class.bg-emerald-500]="supabaseService.isConfigured()" [class.bg-amber-500]="!supabaseService.isConfigured()"></span>
              <span>Cloud Sync: {{ supabaseService.isConfigured() ? 'Supabase Connected' : 'Supabase Config (Optional)' }}</span>
            </span>
            <span class="material-icons-outlined text-sm">{{ showConfig() ? 'expand_less' : 'expand_more' }}</span>
          </button>

          @if (showConfig()) {
            <div class="mt-3 p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
              <div>
                <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1">Supabase URL</label>
                <input type="text" 
                       [(ngModel)]="configUrl" 
                       placeholder="https://xyz.supabase.co" 
                       class="w-full p-2 bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-white font-mono focus:outline-none focus:border-blue-500">
              </div>
              <div>
                <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1">Anon / Publishable Key</label>
                <input type="password" 
                       [(ngModel)]="configKey" 
                       placeholder="sb_publishable_... or eyJ..." 
                       class="w-full p-2 bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-white font-mono focus:outline-none focus:border-blue-500">
              </div>
              <button (click)="saveConfig()" type="button" class="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors">
                Save & Apply Credentials
              </button>
            </div>
          }
        </div>

      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuthComponent {
  private fb: FormBuilder = inject(FormBuilder);
  supabaseService = inject(SupabaseService);
  private toastService = inject(ToastService);
  customerService = inject(CustomerService);
  private router = inject(Router);

  isSignUp = signal<boolean>(false);
  loading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  showConfig = signal<boolean>(false);

  configUrl = this.supabaseService.url();
  configKey = this.supabaseService.anonKey();

  authForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    fullName: [''],
    phone: ['']
  });

  async onSubmit() {
    if (this.authForm.invalid) return;
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.loading.set(true);

    const { email, password, fullName, phone } = this.authForm.getRawValue();

    if (this.isSignUp()) {
      const nameVal = fullName || (email ? email.split('@')[0] : 'New Client');
      const phoneVal = phone || 'N/A';

      if (!this.supabaseService.isConfigured()) {
        this.loading.set(false);
        this.errorMessage.set('Configure Supabase credentials before creating an account.');
        return;
      }

      const res = await this.supabaseService.signUp(email || '', password || '', nameVal);
      if (!res.success) {
        this.loading.set(false);
        this.errorMessage.set(res.error || 'Account registration failed.');
        return;
      }
      if (res.needEmailVerification) {
        this.loading.set(false);
        this.successMessage.set('Check your email to verify your account, then sign in to continue.');
        return;
      }

      try {
        await this.customerService.addCustomer({
          name: nameVal,
          email: email || '',
          phone: phone || 'N/A',
          notes: 'Registered Client via Portal'
        });
      } catch (err: any) {
        this.loading.set(false);
        this.errorMessage.set(`Account created, but the customer profile could not be saved: ${err.message || 'Please try again.'}`);
        return;
      }
      this.toastService.success('Account and customer profile created.');
      this.loading.set(false);
      this.router.navigate(['/customers']);
    } else {
      if (!this.supabaseService.isConfigured()) {
        this.loading.set(false);
        if (!this.supabaseService.loginAsDemoUser()) {
          this.errorMessage.set('Configure Supabase credentials to sign in.');
          return;
        }
        this.successMessage.set('Signing in as Store Manager (Local Mode)...');
        setTimeout(() => this.router.navigate(['/dashboard']), 500);
        return;
      }

      const res = await this.supabaseService.signInWithPassword(email || '', password || '');
      this.loading.set(false);
      if (!res.success) {
        this.errorMessage.set(res.error || 'Invalid credentials or connection error.');
      } else {
        this.router.navigate(['/dashboard']);
      }
    }
  }

  onDemoLogin() {
    if (this.supabaseService.loginAsDemoUser()) {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.errorMessage.set('Demo access is available only on localhost.');
  }

  saveConfig() {
    const res = this.supabaseService.saveCredentials(this.configUrl, this.configKey);
    if (res.success) {
      this.successMessage.set('Supabase credentials saved successfully!');
      this.toastService.success('Supabase credentials saved.');
      this.showConfig.set(false);
      setTimeout(() => this.successMessage.set(null), 3000);
    } else {
      this.errorMessage.set(res.error || 'Failed to save credentials.');
    }
  }
}
