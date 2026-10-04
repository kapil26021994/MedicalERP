import { Component, ChangeDetectionStrategy, signal, ElementRef, AfterViewInit, inject, PLATFORM_ID } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { animate, stagger } from 'motion';

interface Feature {
  id: string;
  icon: string;
  badge: string;
  title: string;
  description: string;
  highlights: string[];
  imageUrl: string;
  demoRoute: string;
}

interface WorkflowStep {
  number: string;
  icon: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  imports: [
    RouterLink, 
    CommonModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingComponent implements AfterViewInit {
  private elementRef = inject(ElementRef);
  private platformId = inject(PLATFORM_ID);

  activeTab = signal<string>('ocr');

  features = signal<Feature[]>([
    {
      id: 'ocr',
      icon: 'document_scanner',
      badge: 'Client OCR',
      title: 'Image-to-Table Vendor Invoice Parser',
      description: 'Snap a picture of any supplier bill or vendor receipt. Our embedded client-side OCR engine parses line items, unit rates, quantities, and totals directly into structured purchase table rows with zero cloud latency.',
      highlights: [
        '100% client-side browser execution (Tesseract JS)',
        'Automatic line item & price detection',
        'Batch creation & vendor due tracking',
        'Instant inventory stock sync'
      ],
      imageUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=1200&auto=format&fit=crop',
      demoRoute: '/purchases'
    },
    {
      id: 'inventory',
      icon: 'inventory_2',
      badge: 'Inventory',
      title: 'Smart Stock & Batch Expiry Management',
      description: 'Keep full visibility over your store stock. Track items by batch numbers, monitor manufacturing and expiry dates, set low-stock reorder thresholds, and view audit log histories of all stock adjustments.',
      highlights: [
        'Batch number & expiry date tracking',
        'Low stock warnings & automated alerts',
        'Stock movement audit logs',
        'Custom cost & selling price margin management'
      ],
      imageUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=1200&auto=format&fit=crop',
      demoRoute: '/inventory'
    },
    {
      id: 'analytics',
      icon: 'insights',
      badge: 'Financials',
      title: 'Real-Time Sales & Profitability Dashboard',
      description: 'Understand your business performance at a glance. Visual metrics, revenue trends, profit margins, expense breakdowns, and customer credit ledger tracking give you total financial clarity.',
      highlights: [
        'Live revenue & net profit calculation',
        'Top selling products & category breakdowns',
        'Expense logging & vendor balance ledgers',
        'Customer purchase history & credit tracking'
      ],
      imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1200&auto=format&fit=crop',
      demoRoute: '/dashboard'
    }
  ]);

  workflowSteps = signal<WorkflowStep[]>([
    {
      number: '01',
      icon: 'add_a_photo',
      title: 'Scan Vendor Bills',
      description: 'Upload paper invoices or vendor bills to parse items into inventory tables using client-side OCR.'
    },
    {
      number: '02',
      icon: 'shopping_bag',
      title: 'Organize Batches',
      description: 'Set selling prices, cost prices, batch numbers, and expiry alerts for perfect stock control.'
    },
    {
      number: '03',
      icon: 'receipt_long',
      title: 'Instant GST Invoicing',
      description: 'Create professional tax invoices, manage tax structures, and send digital PDF/summaries via WhatsApp.'
    },
    {
      number: '04',
      icon: 'analytics',
      title: 'Analyze & Grow',
      description: 'Monitor live net profits, category revenues, customer history, and expense margins.'
    }
  ]);

  stats = signal([
    { label: 'Client OCR Processing', value: '100% In-Browser' },
    { label: 'Average Checkout Time', value: '< 3 Seconds' },
    { label: 'Data Privacy', value: 'Local First' },
    { label: 'Feature Availability', value: 'Full Stack' }
  ]);

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const nativeEl = this.elementRef.nativeElement;

    // Animate hero elements on load
    const heroBadges = nativeEl.querySelectorAll('.animate-hero-item');
    if (heroBadges.length > 0) {
      animate(
        heroBadges,
        { opacity: [0, 1], y: [24, 0] },
        { delay: stagger(0.12), duration: 0.7, ease: [0.22, 1, 0.36, 1] }
      );
    }

    // Animate feature cards on scroll/load
    const featureCards = nativeEl.querySelectorAll('.animate-card');
    if (featureCards.length > 0) {
      animate(
        featureCards,
        { opacity: [0, 1], y: [30, 0] },
        { delay: stagger(0.1), duration: 0.6, ease: 'easeOut' }
      );
    }
  }

  setActiveTab(tabId: string): void {
    this.activeTab.set(tabId);
  }
}
