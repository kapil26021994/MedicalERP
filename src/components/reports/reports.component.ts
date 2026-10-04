

import { Component, ChangeDetectionStrategy, inject, signal, computed, effect, ElementRef, ViewChild, AfterViewInit, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { InvoiceService } from '../../services/invoice.service';
import { ProductService } from '../../services/product.service';
import { PurchaseService } from '../../services/purchase.service';
import { ExpenseService } from '../../services/expense.service';
import { TranslationService } from '../../services/translation.service';
import { LoaderComponent } from '../layout/loader.component';
import { Invoice } from '../../models/invoice.model';
import { Product } from '../../models/product.model';
import { Expense } from '../../models/expense.model';
import * as d3 from 'd3';

interface SalesData {
  date: Date;
  total: number;
}

interface FinancialData {
    period: string;
    revenue: number;
    cogs: number;
    expenses: number;
    profit: number;
}

@Component({
  selector: 'app-reports',
  templateUrl: './reports.component.html',
  imports: [CommonModule, CurrencyPipe, LoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsComponent implements OnInit, AfterViewInit {
  private http = inject(HttpClient);
  private invoiceService = inject(InvoiceService);
  private productService = inject(ProductService);
  private purchaseService = inject(PurchaseService);
  private expenseService = inject(ExpenseService);
  public ts = inject(TranslationService);

  isLoading = computed(() => 
    this.productService.isLoading() || 
    this.invoiceService.isLoading() || 
    this.purchaseService.isLoading() || 
    this.expenseService.isLoading()
  );

  ngOnInit() {
    if (this.invoiceService.isLoaded() || this.productService.isLoaded()) {
      return;
    }

    this.productService.isLoading.set(true);
    this.invoiceService.isLoading.set(true);
    this.purchaseService.isLoading.set(true);
    this.expenseService.isLoading.set(true);

    this.http.get<any>('/api/dashboard').subscribe({
      next: (res) => {
        if (res) {
          if (res.products) this.productService.setProducts(res.products);
          if (res.invoices) this.invoiceService.setInvoices(res.invoices);
          if (res.purchases) this.purchaseService.setPurchases(res.purchases);
          if (res.expenses) this.expenseService.setExpenses(res.expenses);
        }
        this.productService.isLoading.set(false);
        this.invoiceService.isLoading.set(false);
        this.purchaseService.isLoading.set(false);
        this.expenseService.isLoading.set(false);
      },
      error: () => {
        this.productService.isLoading.set(false);
        this.invoiceService.isLoading.set(false);
        this.purchaseService.isLoading.set(false);
        this.expenseService.isLoading.set(false);
      }
    });
  }

  @ViewChild('salesChart') private salesChartContainer!: ElementRef;
  @ViewChild('pnlChart') private pnlChartContainer!: ElementRef;
  
  timeRange = signal<'7d' | '30d' | 'all'>('7d');
  private viewInitialized = false;

  reportData = computed(() => {
    const invoices = this.invoiceService.invoices();
    const products = this.productService.products();
    const purchases = this.purchaseService.purchases();
    const expenses = this.expenseService.expenses();
    const range = this.timeRange();

    const dateRange = this.getDateRange(range);
    // FIX: Explicitly provided generic type arguments to resolve a TypeScript type inference issue.
    // The compiler was incorrectly inferring the base constraint `{ date: Date }` instead of `Invoice` or `Expense`.
    const filteredInvoices = this.filterByDateRange<Invoice>(invoices, dateRange);
    const filteredExpenses = this.filterByDateRange<Expense>(expenses, dateRange);
    
    // KPIs
    const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalInvoices = filteredInvoices.length;
    const avgOrderValue = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;
    
    // COGS: For each item sold, find its latest purchase price before the sale date.
    const costOfGoodsSold = filteredInvoices.reduce((totalCogs, inv) => {
        const invoiceCogs = inv.items.reduce((itemCogs, item) => {
            if(item.isCustom) return itemCogs;
            
            const product = products.find(p => p.id === item.id);
            // Fallback to product's stored purchase price if no relevant purchase found
            const costPrice = product?.purchasePrice || 0;
            return itemCogs + (costPrice * item.cartQuantity);
        }, 0);
        return totalCogs + invoiceCogs;
    }, 0);
    
    const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const grossProfit = totalRevenue - costOfGoodsSold;
    const netProfit = grossProfit - totalExpenses;

    // Chart Data
    const salesOverTime = this.processSalesOverTime(filteredInvoices);
    const pnlData = this.processPnlData(filteredInvoices, costOfGoodsSold, totalExpenses);

    return { 
        kpis: { totalRevenue, totalInvoices, avgOrderValue, netProfit }, 
        salesOverTime, 
        pnlData
    };
  });

  constructor() {
    this.http.get('/api/reports/summary').subscribe({ error: () => {} });
    effect(() => {
      if (this.viewInitialized) {
        this.drawCharts(this.reportData());
      }
    });
  }

  ngAfterViewInit() {
    this.viewInitialized = true;
    this.drawCharts(this.reportData());
  }

  setTimeRange(range: '7d' | '30d' | 'all') {
    this.timeRange.set(range);
  }

  private getDateRange(range: '7d' | '30d' | 'all'): { start: Date; end: Date } {
    const end = new Date();
    let start: Date;

    if (range === 'all') {
        start = new Date(0); // Epoch start
    } else {
        const days = range === '7d' ? 7 : 30;
        start = new Date();
        start.setDate(end.getDate() - days);
    }
    return { start, end };
  }

  private filterByDateRange<T extends { date: Date }>(items: T[], range: { start: Date; end: Date }): T[] {
      return items.filter(item => {
          const itemDate = item.date;
          // All date properties in this app are converted to Date objects by services,
          // so we can safely assume `item.date` is a Date object.
          return itemDate instanceof Date && !isNaN(itemDate.getTime()) && itemDate >= range.start && itemDate <= range.end;
      });
  }

  private processSalesOverTime(invoices: Invoice[]): SalesData[] {
    const salesByDate = new Map<string, number>();
    invoices.forEach(inv => {
      const dateKey = new Date(inv.date).toISOString().split('T')[0];
      const currentSales = salesByDate.get(dateKey) || 0;
      salesByDate.set(dateKey, currentSales + inv.total);
    });
    return Array.from(salesByDate, ([date, total]) => ({ date: new Date(date), total }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private processPnlData(invoices: Invoice[], cogs: number, expenses: number): FinancialData[] {
      const revenue = invoices.reduce((sum, inv) => sum + inv.total, 0);
      return [{
          period: 'Selected Period',
          revenue,
          cogs,
          expenses,
          profit: revenue - cogs - expenses,
      }];
  }
  
  private drawCharts(data: any) {
    this.drawSalesChart(data.salesOverTime);
    this.drawPnlChart(data.pnlData);
  }
  
  private drawSalesChart(data: SalesData[]) {
    const element = this.salesChartContainer.nativeElement;
    d3.select(element).select('svg').remove();
    if (data.length === 0) return;

    const margin = { top: 20, right: 20, bottom: 50, left: 50 };
    const width = element.clientWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select(element).append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Gradient
    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
      .attr("id", "sales-gradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");
    gradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#6366f1") // indigo-500
      .attr("stop-opacity", 1);
    gradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#818cf8") // indigo-400
      .attr("stop-opacity", 0.6);

    const formatDay = d3.timeFormat('%b %d');

    const x = d3.scaleBand<string>()
      .domain(data.map(d => formatDay(d.date)))
      .range([0, width])
      .padding(0.4);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.total) || 100])
      .range([height, 0]);

    // Gridlines
    svg.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,0)`)
      .call(d3.axisLeft(y)
        .ticks(5)
        .tickSize(-width)
        .tickFormat(() => '')
      )
      .selectAll('line')
      .attr('stroke', '#f1f5f9') // slate-100
      .attr('stroke-dasharray', '4,4');

    svg.select('.grid path').remove();

    // Axes
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).tickSizeOuter(0))
      .selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-40)')
        .style('fill', '#64748b') // slate-500
        .style('font-weight', '600')
        .style('font-size', '11px');

    svg.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat((d: any) => `₹${Number(d) / 1000}k`).tickSizeOuter(0))
      .selectAll('text')
        .style('fill', '#64748b') // slate-500
        .style('font-weight', '600')
        .style('font-size', '11px');
        
    svg.selectAll('.domain').attr('stroke', '#e2e8f0'); // slate-200
    svg.selectAll('.tick line').attr('stroke', '#e2e8f0');

    // Tooltip
    const tooltip = d3.select(element)
      .append("div")
      .style("opacity", 0)
      .attr("class", "absolute hidden bg-slate-900 text-white text-xs font-bold rounded-lg py-1.5 px-3 pointer-events-none transform -translate-x-1/2 -translate-y-full shadow-lg transition-opacity duration-200")
      .style("z-index", "10");

    // Bars
    svg.selectAll('.bar')
      .data(data)
      .enter().append('rect')
      .attr('class', 'bar cursor-pointer')
      .attr('x', d => x(formatDay(d.date)) || 0)
      .attr('width', x.bandwidth())
      .attr('rx', 4) // rounded corners
      .attr('fill', 'url(#sales-gradient)')
      .attr('y', height)
      .attr('height', 0)
      .on("mouseover", function(event, d) {
         d3.select(this).attr("fill", "#4f46e5"); // indigo-600
         tooltip.transition().duration(100).style("opacity", 1).style("display", "block");
         tooltip.html(`₹${d.total.toLocaleString('en-IN')}`)
           .style("left", ((x(formatDay(d.date)) || 0) + margin.left + x.bandwidth()/2) + "px")
           .style("top", (y(d.total) + margin.top - 10) + "px");
      })
      .on("mouseout", function() {
         d3.select(this).attr("fill", "url(#sales-gradient)");
         tooltip.transition().duration(200).style("opacity", 0).on('end', function() { d3.select(this).style("display", "none"); });
      })
      .transition()
      .duration(800)
      .ease(d3.easeCubicOut)
      .delay((d, i) => i * 50)
      .attr('y', d => y(d.total))
      .attr('height', d => height - y(d.total));
  }

  private drawPnlChart(data: FinancialData[]) {
      const element = this.pnlChartContainer.nativeElement;
      d3.select(element).select('svg').remove();
      if(data.length === 0 || data[0].revenue === 0) return;

      const totalProfit = d3.sum(data, d => d.profit);
      const totalExpenses = d3.sum(data, d => d.expenses);
      const totalCogs = d3.sum(data, d => d.cogs);

      const pieData = [
        { key: 'profit', value: totalProfit, label: 'Net Profit', color: '#10b981' }, // emerald-500
        { key: 'expenses', value: totalExpenses, label: 'Expenses', color: '#f59e0b' }, // amber-500
        { key: 'cogs', value: totalCogs, label: 'Cost of Goods', color: '#f43f5e' } // rose-500
      ].filter(d => d.value > 0);

      const width = element.clientWidth;
      const height = 300;
      const margin = 20;
      const radius = Math.min(width, height) / 2 - margin;

      const svg = d3.select(element).append('svg')
          .attr('width', width)
          .attr('height', height)
          .append('g')
          .attr('transform', `translate(${width / 2},${height / 2 - 20})`); // Shifted up slightly to make room for legend

      const pie = d3.pie<any>()
          .sort(null)
          .value((d: any) => d.value);

      const dataReady = pie(pieData as any);

      const arc: any = d3.arc()
          .innerRadius(radius * 0.5) // This makes it a doughnut
          .outerRadius(radius * 0.8)
          .cornerRadius(5);

      const arcHover: any = d3.arc()
          .innerRadius(radius * 0.5)
          .outerRadius(radius * 0.85) // Slightly larger on hover
          .cornerRadius(5);

      // Tooltip
      const tooltip = d3.select(element)
        .append("div")
        .style("opacity", 0)
        .attr("class", "absolute hidden bg-slate-900 text-white text-xs font-bold rounded-lg py-1.5 px-3 pointer-events-none transform -translate-x-1/2 -translate-y-full shadow-lg transition-opacity duration-200")
        .style("z-index", "10");

      // Build the pie chart
      svg.selectAll('path')
          .data(dataReady)
          .enter()
          .append('path')
          .attr('d', arc)
          .attr('fill', (d: any) => d.data.color)
          .attr('stroke', 'white')
          .style('stroke-width', '3px')
          .style('cursor', 'pointer')
          .on("mouseover", function(event, d: any) {
             d3.select(this)
               .transition()
               .duration(200)
               .attr('d', arcHover as any);
             
             tooltip.transition().duration(100).style("opacity", 1).style("display", "block");
             tooltip.html(`${d.data.label}<br/>₹${d.data.value.toLocaleString('en-IN')}`)
               .style("left", (event.layerX) + "px")
               .style("top", (event.layerY - 10) + "px");
          })
          .on("mouseout", function() {
             d3.select(this)
               .transition()
               .duration(200)
               .attr('d', arc as any);
               
             tooltip.transition().duration(200).style("opacity", 0).on('end', function() { d3.select(this).style("display", "none"); });
          })
          // Animation
          .transition()
          .duration(1000)
          .attrTween("d", function(d: any) {
              const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
              return function(t) { return arc(i(t)); };
          });

      // Legend
      const legendGroup = svg.append('g')
          .attr('transform', `translate(-${width/2 - margin}, ${radius + 20})`);
          
      const legendWidth = width - margin*2;
      const itemWidth = legendWidth / pieData.length;

      const legend = legendGroup.selectAll('.legend-item')
          .data(pieData)
          .enter()
          .append('g')
          .attr('class', 'legend-item')
          .attr('transform', (d, i) => `translate(${i * itemWidth}, 0)`);

      legend.append('rect')
          .attr('x', 0)
          .attr('y', 0)
          .attr('width', 12)
          .attr('height', 12)
          .attr('rx', 3)
          .attr('fill', d => d.color);

      legend.append('text')
          .attr('x', 20)
          .attr('y', 10)
          .style('font-family', 'sans-serif')
          .style('font-size', '11px')
          .style('font-weight', '600')
          .style('fill', '#64748b')
          .text(d => d.label);
  }
}