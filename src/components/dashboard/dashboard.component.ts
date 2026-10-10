import { Component, ChangeDetectionStrategy, inject, computed, ViewChild, ElementRef, AfterViewInit, effect, signal, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ProductService } from '../../services/product.service';
import { InvoiceService } from '../../services/invoice.service';
import { CustomerService } from '../../services/customer.service';
import { PurchaseService } from '../../services/purchase.service';
import { ExpenseService } from '../../services/expense.service';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { Product } from '../../models/product.model';
import { RouterLink } from '@angular/router';
import { LoaderComponent } from '../layout/loader.component';
import * as d3 from 'd3';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  imports: [
    CommonModule, 
    CurrencyPipe, 
    DatePipe, 
    RouterLink,
    LoaderComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  private http = inject(HttpClient);
  private productService = inject(ProductService);
  private invoiceService = inject(InvoiceService);
  private purchaseService = inject(PurchaseService);
  private expenseService = inject(ExpenseService);
  private customerService = inject(CustomerService);
  public ts = inject(TranslationService);
  private toastService = inject(ToastService);

  isLoading = computed(() => 
    this.productService.isLoading() || 
    this.invoiceService.isLoading() || 
    this.purchaseService.isLoading() || 
    this.expenseService.isLoading() ||
    this.customerService.isLoading()
  );

  ngOnInit() {
    if (this.invoiceService.isLoaded() || this.productService.isLoaded()) {
      return;
    }
    
    this.productService.isLoading.set(true);
    this.invoiceService.isLoading.set(true);
    this.purchaseService.isLoading.set(true);
    this.expenseService.isLoading.set(true);
    this.customerService.isLoading.set(true);

    // 1 single API call for all dashboard sections
    this.http.get<any>('/api/dashboard').subscribe({
      next: (res) => {
        if (res) {
          if (res.products) this.productService.setProducts(res.products);
          if (res.invoices) this.invoiceService.setInvoices(res.invoices);
          if (res.purchases) this.purchaseService.setPurchases(res.purchases);
          if (res.expenses) this.expenseService.setExpenses(res.expenses);
          if (res.customers) this.customerService.setCustomers(res.customers);
        }
        this.productService.isLoading.set(false);
        this.invoiceService.isLoading.set(false);
        this.purchaseService.isLoading.set(false);
        this.expenseService.isLoading.set(false);
        this.customerService.isLoading.set(false);
      },
      error: () => {
        this.productService.isLoading.set(false);
        this.invoiceService.isLoading.set(false);
        this.purchaseService.isLoading.set(false);
        this.expenseService.isLoading.set(false);
        this.customerService.isLoading.set(false);
      }
    });
  }

  @ViewChild('pnlChart') private pnlChartContainer!: ElementRef;
  @ViewChild('monthlySalesChart') private monthlySalesChartContainer!: ElementRef;
  
  private viewInitialized = false;
  private resizeObserver?: ResizeObserver;

  kpiCardsData = computed(() => {
    let invoices = this.invoiceService.invoices();
    let expenses = this.expenseService.expenses();
    let purchases = this.purchaseService.purchases();

    const totalSale = invoices.reduce((s, inv) => s + inv.total, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const totalPurchase = purchases.reduce((s, p) => s + p.finalBillAmount, 0);
    const udhar = invoices.reduce((s, inv) => s + Math.max(0, inv.total - (inv.amountPaid ?? inv.total)), 0);

    return { totalSale, totalExpenses, udhar, totalPurchase };
  });

  topSellingProducts = computed(() => {
    const salesMap = new Map<string, { product: Product; quantity: number; revenue: number }>();
    
    let invoices = this.invoiceService.invoices();

    invoices.forEach(inv => {
      inv.items.forEach(item => {
        if (!item.isCustom) {
          const product = this.productService.getProductById(item.id);
          if(product) {
              const existing = salesMap.get(item.id);
              if (existing) {
                existing.quantity += item.cartQuantity;
                existing.revenue += (item.cartQuantity * item.sellingPrice);
              } else {
                salesMap.set(item.id, { product, quantity: item.cartQuantity, revenue: item.cartQuantity * item.sellingPrice });
              }
          }
        }
      });
    });
    return Array.from(salesMap.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  });

  lowStockProducts = computed(() => {
    return this.productService.products().filter(p => p.quantity <= (p.minStockAlert || 5));
  });

  async restockProduct(product: Product): Promise<void> {
    const qtyStr = prompt(`Enter quantity to restock for ${product.name}:`, '10');
    if (qtyStr && !isNaN(Number(qtyStr))) {
      const qty = Number(qtyStr);
      if (qty > 0) {
        try {
          await this.productService.updateStock(product.id, qty, 'Purchase', 'Dashboard quick restock');
          this.toastService.success(`${qty} units added to ${product.name}.`);
        } catch (error) {
          this.toastService.error(error instanceof Error ? error.message : 'Failed to restock product.');
        }
      }
    }
  }

  dailySalesData = computed(() => {
    const invoices = this.invoiceService.invoices();
    const dailySales = new Map<string, number>();

    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    const formatDate = (date: Date) => {
      return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    };

    for (let i = 29; i >= 0; i--) {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - i);
      dailySales.set(formatDate(d), 0);
    }

    invoices.forEach(inv => {
      const invDate = new Date(inv.date);
      invDate.setHours(0, 0, 0, 0);
      const key = formatDate(invDate);
      if (dailySales.has(key)) {
        dailySales.set(key, dailySales.get(key)! + inv.total);
      }
    });

    return Array.from(dailySales.entries()).map(([dateStr, total]) => {
      const date = new Date(dateStr);
      return { 
        date: dateStr,
        label: date.toLocaleString('default', { day: 'numeric', month: 'short' }), 
        total 
      };
    });
  });

  monthlySalesData = computed(() => {
    const invoices = this.invoiceService.invoices();
    const monthlySales = new Map<string, number>();

    const currentDate = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      monthlySales.set(d.toLocaleString('default', { month: 'short', year: '2-digit' }), 0);
    }

    invoices.forEach(inv => {
      const d = new Date(inv.date);
      const key = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      if (monthlySales.has(key)) {
        monthlySales.set(key, monthlySales.get(key)! + inv.total);
      }
    });

    return Array.from(monthlySales.entries()).map(([month, total]) => ({ month, total }));
  });

  recentInvoices = computed(() => {
    const invoices = this.invoiceService.invoices();
    return [...invoices].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 4);
  });

  recentCustomers = computed(() => {
    const customers = this.customerService.customers();
    const invoices = this.invoiceService.invoices();
    return [...customers]
      .reverse()
      .slice(0, 4)
      .map(customer => ({
        ...customer,
        orderCount: invoices.filter(invoice => invoice.customer?.id === customer.id).length
      }));
  });

  constructor() {
    effect(() => {
      if (this.viewInitialized) {
        this.drawPnLChart();
        this.drawMonthlySalesChart();
      }
    });
  }

  ngAfterViewInit() {
    this.viewInitialized = true;
    this.drawPnLChart();
    this.drawMonthlySalesChart();

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.drawPnLChart();
        this.drawMonthlySalesChart();
      });
      if (this.pnlChartContainer?.nativeElement) {
        this.resizeObserver.observe(this.pnlChartContainer.nativeElement);
      }
      if (this.monthlySalesChartContainer?.nativeElement) {
        this.resizeObserver.observe(this.monthlySalesChartContainer.nativeElement);
      }
    }
  }

  ngOnDestroy() {
    if (this.resizeObserver) this.resizeObserver.disconnect();
  }

  private drawPnLChart() {
    if (!this.pnlChartContainer?.nativeElement) return;
    const element = this.pnlChartContainer.nativeElement;
    d3.select(element).selectAll('*').remove();
    
    const kpi = this.kpiCardsData();
    const data = [
      { label: 'Total Sale', value: kpi.totalSale, color: '#10b981', isCurrency: true },
      { label: 'Expenses', value: kpi.totalExpenses, color: '#f59e0b', isCurrency: true },
      { label: 'Total Purchase', value: kpi.totalPurchase, color: '#f43f5e', isCurrency: true }
    ].filter(d => d.value > 0);

    if (!data.length) return;

    this.drawDoughnut(element, data);
  }

  private drawMonthlySalesChart() {
    if (!this.monthlySalesChartContainer?.nativeElement) return;
    const element = this.monthlySalesChartContainer.nativeElement;
    d3.select(element).selectAll('*').remove();
    
    const data = this.monthlySalesData();
    if (!data || data.length === 0) return;

    const margin = { top: 20, right: 20, bottom: 40, left: 60 };
    const width = (element.clientWidth || 600) - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select(element)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
      .range([0, width])
      .padding(0.2)
      .domain(data.map(d => d.month));

    const maxTotal = d3.max(data, d => d.total) || 1000;
    const y = d3.scaleLinear()
      .range([height, 0])
      .domain([0, maxTotal * 1.1]);

    const xAxis = d3.axisBottom(x);
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis)
      .selectAll('text')
      .style('font-family', 'sans-serif')
      .style('font-size', '10px')
      .style('font-weight', '600')
      .style('fill', '#64748b');
      
    svg.select('.domain').attr('stroke', '#cbd5e1');
    svg.selectAll('.tick line').attr('stroke', '#cbd5e1');

    const yAxis = d3.axisLeft(y)
      .ticks(5)
      .tickFormat((d: any) => {
        const val = Number(d);
        if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
        if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
        return `₹${val}`;
      });
      
    svg.append('g')
      .call(yAxis)
      .selectAll('text')
      .style('font-family', 'sans-serif')
      .style('font-size', '10px')
      .style('font-weight', '600')
      .style('fill', '#64748b');

    svg.select('.domain').remove();
    svg.selectAll('.tick line').remove();
    
    // Add grid lines
    svg.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(() => ''))
      .selectAll('line')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-dasharray', '3,3')
      .attr('stroke-opacity', 0.7);

    const tooltip = d3.select(element)
      .append("div")
      .style("opacity", 0)
      .attr("class", "absolute hidden bg-slate-900 text-white text-xs font-bold rounded-lg py-1.5 px-3 pointer-events-none transform -translate-x-1/2 -translate-y-full shadow-lg transition-opacity duration-200 z-10");

    svg.selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d.month)!)
      .attr('width', x.bandwidth())
      .attr('y', d => y(0))
      .attr('height', 0)
      .attr('fill', '#6366f1')
      .attr('rx', 4)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this).attr('fill', '#4f46e5');
        tooltip.transition().duration(100).style("opacity", 1).style("display", "block");
        
        const val = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(d.total);
        tooltip.html(`${d.month}<br/>${val}`)
          .style("left", (event.layerX + margin.left) + "px")
          .style("top", (event.layerY + margin.top - 10) + "px");
      })
      .on('mouseout', function(event, d) {
        d3.select(this).attr('fill', '#6366f1');
        tooltip.transition().duration(200).style("opacity", 0).on('end', function() { d3.select(this).style("display", "none"); });
      })
      .transition()
      .duration(800)
      .attr('y', d => y(d.total))
      .attr('height', d => height - y(d.total));
  }

  private drawDoughnut(element: HTMLElement, data: any[]) {
    const width = element.clientWidth || 300;
    const height = 280;
    const margin = 20;
    const radius = Math.min(width, height) / 2 - margin;

    const svg = d3.select(element)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${width / 2},${height / 2 - 20})`);

    const pie = d3.pie<any>()
        .sort(null)
        .value(d => d.value);

    const dataReady = pie(data);

    const arc = d3.arc<any>()
        .innerRadius(radius * 0.5)
        .outerRadius(radius * 0.8)
        .cornerRadius(5);

    const arcHover = d3.arc<any>()
        .innerRadius(radius * 0.5)
        .outerRadius(radius * 0.85)
        .cornerRadius(5);

    const tooltip = d3.select(element)
      .append("div")
      .style("opacity", 0)
      .attr("class", "absolute hidden bg-slate-900 text-white text-xs font-bold rounded-lg py-1.5 px-3 pointer-events-none transform -translate-x-1/2 -translate-y-full shadow-lg transition-opacity duration-200 z-10");

    svg.selectAll('path')
        .data(dataReady)
        .enter()
        .append('path')
        .attr('d', arc)
        .attr('fill', d => d.data.color)
        .attr('stroke', 'white')
        .style('stroke-width', '2px')
        .style('cursor', 'pointer')
        .on("mouseover", function(event, d) {
           d3.select(this).transition().duration(200).attr('d', arcHover as any);
           tooltip.transition().duration(100).style("opacity", 1).style("display", "block");
           
           const val = d.data.isCurrency 
            ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(d.data.value) 
            : d.data.value.toLocaleString('en-IN');
            
           tooltip.html(`${d.data.label}<br/>${val}`)
             .style("left", (event.layerX) + "px")
             .style("top", (event.layerY - 10) + "px");
        })
        .on("mouseout", function() {
           d3.select(this).transition().duration(200).attr('d', arc as any);
           tooltip.transition().duration(200).style("opacity", 0).on('end', function() { d3.select(this).style("display", "none"); });
        })
        .transition()
        .duration(1000)
        .attrTween("d", function(d) {
            const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
            return function(t) { return arc(i(t)); };
        });

    const legendGroup = svg.append('g')
        .attr('transform', `translate(-${width/2 - margin}, ${radius + 20})`);
        
    const legend = legendGroup.selectAll('.legend-item')
        .data(data)
        .enter()
        .append('g')
        .attr('class', 'legend-item')
        .attr('transform', (d, i) => `translate(${(i % 2) * (width/2)}, ${Math.floor(i/2) * 20})`); // Wrap legend items

    legend.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 10)
        .attr('height', 10)
        .attr('rx', 2)
        .attr('fill', d => d.color);

    legend.append('text')
        .attr('x', 16)
        .attr('y', 9)
        .style('font-family', 'sans-serif')
        .style('font-size', '10px')
        .style('font-weight', '600')
        .style('fill', '#64748b')
        .text(d => d.label.length > 15 ? d.label.substring(0, 15) + '...' : d.label);
  }
}
