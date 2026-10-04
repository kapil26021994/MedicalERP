import { Component, ChangeDetectionStrategy, inject, signal, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { TranslationService } from '../../services/translation.service';

export interface WalkthroughStep {
  id: number;
  title: string;
  subtitle: string;
  icon: string;
  badge: string;
  badgeColor: string;
  image: string;
  description: string;
  highlights: string[];
  route: string;
  actionText: string;
  inputs: string[];
  outputs: string[];
}

@Component({
  selector: 'app-project-walkthrough',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="isModal() ? 'bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-w-5xl w-full mx-auto my-4 max-h-[90vh] flex flex-col' : 'space-y-6'">
      
      <!-- Component Header / Modal Title Bar -->
      <div class="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 text-white p-5 md:p-6 shrink-0 relative overflow-hidden">
        <div class="absolute -right-10 -top-10 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
        
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div class="flex items-center gap-2 mb-1.5">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest bg-blue-500/30 text-blue-300 border border-blue-400/30 uppercase">
                Interactive Project Walkthrough
              </span>
              <span class="text-xs text-slate-400 font-medium">&bull; AdvikaERP Architecture</span>
            </div>
            <h2 class="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <span class="material-icons-outlined text-blue-400 text-2xl md:text-3xl">map</span>
              How AdvikaERP Works: Complete Visual Guide
            </h2>
            <p class="text-xs md:text-sm text-slate-300 mt-1 max-w-2xl font-medium">
              Understand the complete flow of inventory, sales, purchases, customer ledgers, and financial reports in one easy visual diagram.
            </p>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <!-- View Mode Switcher -->
            <div class="bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 flex items-center gap-1">
              <button 
                (click)="activeView.set('infographic')"
                [class]="activeView() === 'infographic' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'"
                class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5">
                <span class="material-icons-outlined text-sm">palette</span>
                <span>Diagram</span>
              </button>
              <button 
                (click)="activeView.set('steps')"
                [class]="activeView() === 'steps' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'"
                class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5">
                <span class="material-icons-outlined text-sm">view_carousel</span>
                <span>Guided Steps</span>
              </button>
              <button 
                (click)="activeView.set('flowchart')"
                [class]="activeView() === 'flowchart' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'"
                class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5">
                <span class="material-icons-outlined text-sm">account_tree</span>
                <span>Data Flow</span>
              </button>
            </div>

            @if (isModal()) {
              <button (click)="closeModal.emit()" class="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors">
                <span class="material-icons-outlined text-lg">close</span>
              </button>
            }
          </div>
        </div>
      </div>

      <!-- Scrollable Main Content -->
      <div class="p-4 md:p-6 space-y-6 overflow-y-auto flex-1">

        <!-- VIEW 1: INFOGRAPHIC DIAGRAM -->
        @if (activeView() === 'infographic') {
          <div class="space-y-6">
            
            <!-- Walkthrough Image Card -->
            <div class="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-xl relative group">
              <div class="p-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300 font-semibold px-4">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>AdvikaERP System Workflow Infographic</span>
                </div>
                <div class="flex items-center gap-3">
                  <button (click)="toggleZoomImage()" class="hover:text-white flex items-center gap-1 transition-colors text-slate-400">
                    <span class="material-icons-outlined text-sm">zoom_in</span>
                    <span>{{ isZoomed() ? 'Reset Zoom' : 'Expand Image' }}</span>
                  </button>
                </div>
              </div>

              <div class="relative overflow-hidden bg-slate-950 flex justify-center items-center p-2 min-h-[280px] md:min-h-[380px]">
                <img 
                  [src]="'/src/assets/images/project_walkthrough_diagram_1786300729016.jpg'" 
                  alt="AdvikaERP Full Project Walkthrough Infographic Diagram"
                  referrerpolicy="no-referrer"
                  [class]="isZoomed() ? 'w-full h-auto scale-125 transition-transform duration-300 cursor-zoom-out' : 'w-full max-w-4xl h-auto object-contain rounded-lg transition-all duration-300 group-hover:scale-[1.01]'"
                  (click)="toggleZoomImage()"
                />
              </div>

              <div class="p-4 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                <p class="m-0 flex items-center gap-1.5">
                  <span class="material-icons-outlined text-blue-400 text-base">info</span>
                  <span>Click the image to expand. This visual diagram displays how stock, bills, sales, and accounts interact seamlessly.</span>
                </p>
                <div class="flex items-center gap-2">
                  <span class="px-2 py-1 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">16:9 HD Diagram</span>
                  <button (click)="activeView.set('steps')" class="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors">
                    Start Step-by-Step Tour &rarr;
                  </button>
                </div>
              </div>
            </div>

            <!-- Quick Step Map Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              @for (step of steps; track step.id) {
                <div 
                  (click)="selectStep(step.id)"
                  class="bg-white rounded-xl p-3.5 border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                  [class.ring-2]="selectedStep() === step.id"
                  [class.ring-blue-500]="selectedStep() === step.id">
                  
                  <div>
                    <div class="flex items-center justify-between mb-2">
                      <span class="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center">
                        0{{ step.id }}
                      </span>
                      <span [class]="'text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase ' + step.badgeColor">
                        {{ step.badge }}
                      </span>
                    </div>

                    <h4 class="font-bold text-xs text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-1">
                      <span class="material-icons-outlined text-base text-slate-500 group-hover:text-blue-600 transition-colors">
                        {{ step.icon }}
                      </span>
                      {{ step.title }}
                    </h4>
                    <p class="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {{ step.subtitle }}
                    </p>
                  </div>

                  <div class="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-blue-600">
                    <span>Explore Step</span>
                    <span class="material-icons-outlined text-xs group-hover:translate-x-1 transition-transform">arrow_forward</span>
                  </div>
                </div>
              }
            </div>

          </div>
        }

        <!-- VIEW 2: STEP BY STEP CAROUSEL / TOUR -->
        @if (activeView() === 'steps') {
          <div class="space-y-6">
            
            <!-- Step Navigation Tabs -->
            <div class="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              @for (step of steps; track step.id) {
                <button 
                  (click)="selectedStep.set(step.id)"
                  [class]="selectedStep() === step.id ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 font-semibold'"
                  class="px-4 py-2 rounded-xl text-xs whitespace-nowrap shrink-0 flex items-center gap-2 transition-all">
                  <span class="w-5 h-5 rounded-full bg-white/20 text-current flex items-center justify-center text-[10px] font-black">
                    {{ step.id }}
                  </span>
                  <span>{{ step.title }}</span>
                </button>
              }
            </div>

            <!-- Active Step Detail Card -->
            @if (currentStepData(); as step) {
              <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-12">
                
                <!-- Left: Content & Features (7 cols) -->
                <div class="p-6 lg:col-span-7 flex flex-col justify-between space-y-5">
                  <div>
                    <div class="flex items-center gap-2 mb-2">
                      <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800">
                        Step {{ step.id }} of {{ steps.length }}
                      </span>
                      <span [class]="'px-2 py-0.5 rounded text-[10px] font-bold uppercase ' + step.badgeColor">
                        {{ step.badge }}
                      </span>
                    </div>

                    <h3 class="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                      <span class="material-icons-outlined text-blue-600 text-2xl">{{ step.icon }}</span>
                      {{ step.title }}
                    </h3>
                    
                    <p class="text-sm font-semibold text-slate-600 mt-1">
                      {{ step.subtitle }}
                    </p>

                    <p class="text-xs text-slate-600 mt-3 leading-relaxed">
                      {{ step.description }}
                    </p>

                    <!-- Feature Highlights List -->
                    <div class="mt-4 space-y-2">
                      <h5 class="text-xs font-bold text-slate-900 uppercase tracking-wider">Key Module Capabilities:</h5>
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        @for (highlight of step.highlights; track highlight) {
                          <div class="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span class="material-icons-outlined text-emerald-600 text-base shrink-0 mt-0.5">check_circle</span>
                            <span class="font-medium">{{ highlight }}</span>
                          </div>
                        }
                      </div>
                    </div>

                    <!-- Input / Output Data flow badges -->
                    <div class="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-3 text-[11px]">
                      <div>
                        <span class="font-bold text-slate-500 block mb-1">Inputs / Data Source:</span>
                        <div class="flex flex-wrap gap-1">
                          @for (inp of step.inputs; track inp) {
                            <span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[10px]">{{ inp }}</span>
                          }
                        </div>
                      </div>
                      <div>
                        <span class="font-bold text-slate-500 block mb-1">Outputs / Results:</span>
                        <div class="flex flex-wrap gap-1">
                          @for (out of step.outputs; track out) {
                            <span class="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-medium text-[10px]">{{ out }}</span>
                          }
                        </div>
                      </div>
                    </div>

                  </div>

                  <!-- Step Actions -->
                  <div class="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div class="flex items-center gap-2">
                      <button 
                        (click)="prevStep()"
                        [disabled]="selectedStep() === 1"
                        class="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent text-xs font-bold transition-all">
                        &larr; Previous
                      </button>
                      <button 
                        (click)="nextStep()"
                        [disabled]="selectedStep() === steps.length"
                        class="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent text-xs font-bold transition-all">
                        Next &rarr;
                      </button>
                    </div>

                    <button 
                      (click)="navigateToModule(step.route)"
                      class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5">
                      <span>{{ step.actionText }}</span>
                      <span class="material-icons-outlined text-sm">open_in_new</span>
                    </button>
                  </div>

                </div>

                <!-- Right: Visual Graphic Illustration (5 cols) -->
                <div class="lg:col-span-5 bg-slate-900 p-4 flex flex-col justify-center items-center border-t lg:border-t-0 lg:border-l border-slate-800 relative">
                  <div class="w-full h-full min-h-[220px] rounded-xl overflow-hidden relative group">
                    <img 
                      [src]="step.image" 
                      [alt]="step.title + ' Walkthrough Diagram'"
                      referrerpolicy="no-referrer"
                      class="w-full h-full object-cover rounded-xl transition-transform duration-500 group-hover:scale-105"
                    />
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end p-3">
                      <p class="text-[11px] text-slate-200 font-medium m-0 flex items-center gap-1">
                        <span class="material-icons-outlined text-xs text-blue-400">photo_camera</span>
                        <span>Visual workflow snippet for {{ step.title }}</span>
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            }

          </div>
        }

        <!-- VIEW 3: SYSTEM DATA FLOW MAP -->
        @if (activeView() === 'flowchart') {
          <div class="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-xl space-y-6">
            <div class="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 class="text-lg font-black text-white flex items-center gap-2">
                  <span class="material-icons-outlined text-emerald-400">account_tree</span>
                  End-to-End Retail ERP Data Flow Map
                </h3>
                <p class="text-xs text-slate-400 mt-1">
                  How data flows automatically across AdvikaERP from supplier inward stock to sales revenue and GST reporting.
                </p>
              </div>
              <span class="px-2.5 py-1 rounded bg-slate-800 text-emerald-400 font-mono text-xs font-bold">Real-time Synchronization</span>
            </div>

            <!-- Flowchart Nodes Diagram -->
            <div class="grid grid-cols-1 md:grid-cols-5 gap-3 relative py-4">
              
              <!-- Node 1: Purchase -->
              <div class="bg-slate-800/90 rounded-xl p-4 border border-slate-700 relative hover:border-amber-500 transition-all">
                <div class="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm mb-2">
                  1
                </div>
                <h4 class="font-bold text-xs text-amber-300 flex items-center gap-1">
                  <span class="material-icons-outlined text-base">local_shipping</span>
                  Stock Procurement
                </h4>
                <p class="text-[10px] text-slate-300 mt-1">
                  Vendor Invoice Scan & Purchase Order Entry.
                </p>
                <div class="mt-2 text-[9px] bg-slate-900 p-1.5 rounded text-slate-400 font-mono">
                  + Increases Item Qty<br>
                  + Records Vendor Debt
                </div>
              </div>

              <!-- Connector 1 -->
              <div class="hidden md:flex items-center justify-center text-slate-600">
                <span class="material-icons-outlined text-xl text-blue-500 animate-pulse">east</span>
              </div>

              <!-- Node 2: Inventory -->
              <div class="bg-slate-800/90 rounded-xl p-4 border border-slate-700 relative hover:border-blue-500 transition-all">
                <div class="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm mb-2">
                  2
                </div>
                <h4 class="font-bold text-xs text-blue-300 flex items-center gap-1">
                  <span class="material-icons-outlined text-base">inventory_2</span>
                  Inventory Catalog
                </h4>
                <p class="text-[10px] text-slate-300 mt-1">
                  SKU Barcodes, Category, Cost & Selling Prices.
                </p>
                <div class="mt-2 text-[9px] bg-slate-900 p-1.5 rounded text-slate-400 font-mono">
                  &bull; Min Stock Alert<br>
                  &bull; Product Catalog
                </div>
              </div>

              <!-- Connector 2 -->
              <div class="hidden md:flex items-center justify-center text-slate-600">
                <span class="material-icons-outlined text-xl text-blue-500 animate-pulse">east</span>
              </div>

              <!-- Node 3: POS & Sales -->
              <div class="bg-slate-800/90 rounded-xl p-4 border border-slate-700 relative hover:border-emerald-500 transition-all">
                <div class="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm mb-2">
                  3
                </div>
                <h4 class="font-bold text-xs text-emerald-300 flex items-center gap-1">
                  <span class="material-icons-outlined text-base">point_of_sale</span>
                  POS Express Billing
                </h4>
                <p class="text-[10px] text-slate-300 mt-1">
                  Barcode Scanner, Cash/UPI, GST Invoice Print.
                </p>
                <div class="mt-2 text-[9px] bg-slate-900 p-1.5 rounded text-slate-400 font-mono">
                  - Deducts Inventory<br>
                  + Generates Invoice
                </div>
              </div>

            </div>

            <!-- Flowchart Nodes Diagram Line 2 -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-800 pt-4">
              
              <div class="bg-slate-800/60 p-4 rounded-xl border border-slate-700/80 flex items-start gap-3">
                <div class="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                  <span class="material-icons-outlined">groups</span>
                </div>
                <div>
                  <h4 class="font-bold text-xs text-purple-300">Customer Udhar & Khata Ledger Sync</h4>
                  <p class="text-[11px] text-slate-300 mt-0.5">
                    When a bill is completed on credit (Udhar), it automatically updates the customer's profile ledger with outstanding balance and transaction history.
                  </p>
                </div>
              </div>

              <div class="bg-slate-800/60 p-4 rounded-xl border border-slate-700/80 flex items-start gap-3">
                <div class="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                  <span class="material-icons-outlined">pie_chart</span>
                </div>
                <div>
                  <h4 class="font-bold text-xs text-rose-300">Automated Financial Statements</h4>
                  <p class="text-[11px] text-slate-300 mt-0.5">
                    Every invoice and expense recorded updates daily sales revenue, net profit calculations, GST liabilities, and printable PDF business reports.
                  </p>
                </div>
              </div>

            </div>

          </div>
        }

        <!-- Quick Summary Checklist Banner -->
        <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-sm">
              <span class="material-icons-outlined">rocket_launch</span>
            </div>
            <div>
              <h4 class="font-bold text-sm text-slate-900">Ready to test AdvikaERP in action?</h4>
              <p class="text-xs text-slate-600 mt-0.5">
                Jump directly to any page or start by creating your first product or POS bill.
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <a routerLink="/pos" (click)="closeModal.emit()" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1">
              <span class="material-icons-outlined text-sm">point_of_sale</span>
              <span>Open POS Terminal</span>
            </a>
            <a routerLink="/dashboard" (click)="closeModal.emit()" class="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs border border-slate-200 transition-all">
              <span>Go to Dashboard</span>
            </a>
          </div>
        </div>

      </div>

    </div>
  `
})
export class ProjectWalkthroughComponent {
  private router = inject(Router);
  ts = inject(TranslationService);

  isModal = input<boolean>(false);
  closeModal = output<void>();

  activeView = signal<'infographic' | 'steps' | 'flowchart'>('infographic');
  selectedStep = signal<number>(1);
  isZoomed = signal<boolean>(false);

  steps: WalkthroughStep[] = [
    {
      id: 1,
      title: 'Inventory & Stock Control',
      subtitle: 'Product cataloging, SKU barcodes & low stock threshold alerts',
      icon: 'inventory_2',
      badge: 'Core Module',
      badgeColor: 'bg-blue-100 text-blue-800',
      image: '/src/assets/images/inventory_reports_workflow_1786300753513.jpg',
      description: 'Manage all store items with cost prices, selling prices, categories, and SKU barcodes. Automatically tracks available stock and triggers alerts when items fall below minimum stock levels.',
      highlights: [
        'SKU & Barcode auto-generation',
        'Cost vs Selling Price profit calculator',
        'Low stock threshold notifications',
        'Instant search & category filter'
      ],
      route: '/sales',
      actionText: 'Manage Inventory Items',
      inputs: ['Supplier Purchase Bills', 'Manual Product Entry'],
      outputs: ['Product Catalog', 'Low Stock Alerts', 'Stock Valuation']
    },
    {
      id: 2,
      title: 'POS Express Terminal & Billing',
      subtitle: 'Fast barcode scanning, instant GST bill creation & printed receipts',
      icon: 'point_of_sale',
      badge: 'Sales Engine',
      badgeColor: 'bg-emerald-100 text-emerald-800',
      image: '/src/assets/images/pos_billing_workflow_1786300741172.jpg',
      description: 'Designed for rapid counter checkout. Supports physical barcode scanner input, touch-friendly product grid, cash / UPI / card payment modes, change calculator, and instant bill generation.',
      highlights: [
        'Barcode scanner integration',
        'Multi-payment: Cash, UPI, Card, Udhar',
        'GST calculation & tax receipts',
        'Instant stock quantity deduction'
      ],
      route: '/pos',
      actionText: 'Launch POS Terminal',
      inputs: ['Product SKUs', 'Customer Selection', 'Payment Received'],
      outputs: ['Printed Bill / Receipt', 'Deducted Stock', 'Daily Revenue']
    },
    {
      id: 3,
      title: 'Purchases & OCR Bill Scanning',
      subtitle: 'Record supplier orders & AI-powered vendor bill invoice parsing',
      icon: 'local_shipping',
      badge: 'Procurement',
      badgeColor: 'bg-amber-100 text-amber-800',
      image: '/src/assets/images/project_walkthrough_diagram_1786300729016.jpg',
      description: 'Record inward stock arrivals from suppliers. Features Gemini AI OCR to scan vendor bill photos/PDFs and automatically populate line items, prices, and taxes.',
      highlights: [
        'Gemini AI Invoice OCR Scan',
        'Automatic stock quantity replenishment',
        'Vendor payment tracking & due balances',
        'CGST & SGST tax breakdown'
      ],
      route: '/purchases',
      actionText: 'Record Supplier Purchase',
      inputs: ['Vendor Photo/PDF Bills', 'Manual Inward Logs'],
      outputs: ['Updated Stock Levels', 'Supplier Debt Ledger']
    },
    {
      id: 4,
      title: 'Invoices & Customer Khata Ledger',
      subtitle: 'GST compliant invoices, customer profiles & udhar balance tracking',
      icon: 'receipt_long',
      badge: 'Customer Care',
      badgeColor: 'bg-indigo-100 text-indigo-800',
      image: '/src/assets/images/pos_billing_workflow_1786300741172.jpg',
      description: 'Generate full Tax Invoices with B2B/B2C details. Maintain customer credit profiles (Udhar Khata) with complete purchase history and debt collection status.',
      highlights: [
        'Official GST Tax Invoice format',
        'Customer credit (Udhar) tracking',
        'PDF Invoice download & print',
        'Customer purchase history logs'
      ],
      route: '/invoices',
      actionText: 'Create Tax Invoice',
      inputs: ['Registered Customer', 'Order Line Items'],
      outputs: ['Official PDF Invoice', 'Customer Ledger Update']
    },
    {
      id: 5,
      title: 'Financial Reports & Analytics',
      subtitle: 'Real-time sales charts, net profit calculation & GST statements',
      icon: 'bar_chart',
      badge: 'Analytics',
      badgeColor: 'bg-purple-100 text-purple-800',
      image: '/src/assets/images/inventory_reports_workflow_1786300753513.jpg',
      description: 'Comprehensive business insights showing daily sales trends, net profit after deducting store operating expenses, top selling products, and GST tax statements.',
      highlights: [
        'Sales vs Expense Profit & Loss',
        'Top selling product volume chart',
        'GST tax liability summaries',
        'Exportable summary reports'
      ],
      route: '/reports',
      actionText: 'View Business Reports',
      inputs: ['Completed Sales', 'Recorded Expenses', 'Purchase Costs'],
      outputs: ['Profit & Loss Chart', 'GST Tax Summary', 'Executive PDF']
    }
  ];

  selectStep(id: number): void {
    this.selectedStep.set(id);
    this.activeView.set('steps');
  }

  nextStep(): void {
    if (this.selectedStep() < this.steps.length) {
      this.selectedStep.update(s => s + 1);
    }
  }

  prevStep(): void {
    if (this.selectedStep() > 1) {
      this.selectedStep.update(s => s - 1);
    }
  }

  currentStepData(): WalkthroughStep | undefined {
    return this.steps.find(s => s.id === this.selectedStep());
  }

  toggleZoomImage(): void {
    this.isZoomed.update(z => !z);
  }

  navigateToModule(route: string): void {
    this.closeModal.emit();
    this.router.navigate([route]);
  }
}
