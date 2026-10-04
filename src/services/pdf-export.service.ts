import { Injectable, inject } from '@angular/core';
import { jsPDF } from 'jspdf';
import { Invoice, InvoiceTemplateId } from '../models/invoice.model';
import { SettingsService, BusinessProfile } from './settings.service';

@Injectable({
  providedIn: 'root',
})
export class PdfExportService {
  private settingsService = inject(SettingsService);

  /**
   * Generates and triggers a direct PDF download for a completed sales invoice.
   * Supports multiple templates: 'modern' | 'thermal' | 'minimal' | 'corporate' | 'bold'.
   */
  generateInvoicePdf(invoice: Invoice, customProfile?: BusinessProfile, overrideTemplate?: InvoiceTemplateId): void {
    const profile = customProfile || this.settingsService.businessProfile() || {
      shopName: 'Advika Collection',
      shopAddress: '71, C Saket Dham, Indore',
      shopPhone: '8602689698',
    };

    const templateId = overrideTemplate || invoice.template || this.settingsService.defaultTemplate() || 'modern';

    const jsPDFLib: any = jsPDF || (typeof window !== 'undefined' ? ((window as any).jspdf?.jsPDF || (window as any).jsPDF) : null);
    if (!jsPDFLib) {
      console.error('jsPDF library could not be loaded.');
      return;
    }

    const formatCurrency = (amount: number) => {
      const num = Number(amount) || 0;
      return `INR ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatDate = (date: Date | string) => {
      const d = new Date(date);
      return isNaN(d.getTime()) ? new Date().toLocaleDateString('en-IN') : d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    };

    // --- 1. THERMAL RECEIPT (80mm Width) ---
    if (templateId === 'thermal') {
      const doc = new jsPDFLib({
        orientation: 'p',
        unit: 'mm',
        format: [80, 200], // 80mm thermal paper
      });

      const margin = 5;
      const width = 70;
      let y = 8;

      doc.setFont('courier', 'bold');
      doc.setFontSize(13);
      doc.text(`[ ${(profile.shopName || 'ADVIKA').toUpperCase()} ]`, 40, y, { align: 'center' });
      y += 4.5;

      doc.setFont('courier', 'normal');
      doc.setFontSize(7.5);
      if (profile.shopAddress) {
        doc.text(profile.shopAddress, 40, y, { align: 'center' });
        y += 3.5;
      }
      doc.text(`TEL: ${profile.shopPhone || 'N/A'} | GSTIN: ${profile.gstin || 'N/A'}`, 40, y, { align: 'center' });
      y += 4;

      doc.setFont('courier', 'bold');
      doc.text('*** OFFICIAL SALES RECEIPT ***', 40, y, { align: 'center' });
      y += 4;

      // Dashed divider
      doc.text('-------------------------------------------', 40, y, { align: 'center' });
      y += 4;

      doc.setFont('courier', 'normal');
      doc.text(`RECEIPT: ${invoice.id}`, margin, y); y += 3.5;
      doc.text(`DATE   : ${formatDate(invoice.date)}`, margin, y); y += 3.5;
      doc.text(`CUST   : ${invoice.customer?.name || 'Walk-in'}`, margin, y); y += 3.5;
      doc.text(`PAY    : ${(invoice.paymentMode || 'Cash').toUpperCase()}`, margin, y); y += 4;

      doc.text('-------------------------------------------', 40, y, { align: 'center' });
      y += 4;

      // Header row
      doc.setFont('courier', 'bold');
      doc.text('ITEM', margin, y);
      doc.text('TOTAL', 75, y, { align: 'right' });
      y += 3.5;

      doc.setFont('courier', 'normal');
      invoice.items.forEach(item => {
        let name = item.name || 'Item';
        if (name.length > 20) name = name.substring(0, 18) + '..';
        const lineTotal = (item.sellingPrice * item.cartQuantity) - (item.sellingPrice * item.cartQuantity * (item.discountPercent || 0) / 100);
        
        doc.text(name, margin, y);
        doc.text(`INR ${lineTotal.toFixed(2)}`, 75, y, { align: 'right' });
        y += 3.5;
        doc.text(` ${item.cartQuantity} x INR ${item.sellingPrice}`, margin, y);
        y += 4;
      });

      doc.text('-------------------------------------------', 40, y, { align: 'center' });
      y += 4;

      doc.text(`SUBTOTAL:`, margin, y);
      doc.text(`INR ${invoice.subtotal.toFixed(2)}`, 75, y, { align: 'right' });
      y += 3.5;

      if (invoice.totalDiscount > 0) {
        doc.text(`DISCOUNT:`, margin, y);
        doc.text(`-INR ${invoice.totalDiscount.toFixed(2)}`, 75, y, { align: 'right' });
        y += 3.5;
      }

      doc.setFont('courier', 'bold');
      doc.setFontSize(9);
      doc.text(`TOTAL:`, margin, y);
      doc.text(`INR ${invoice.total.toFixed(2)}`, 75, y, { align: 'right' });
      y += 5;

      doc.setFont('courier', 'normal');
      doc.setFontSize(7);
      doc.text('-------------------------------------------', 40, y, { align: 'center' });
      y += 4;

      doc.text('THANK YOU! PLEASE VISIT AGAIN', 40, y, { align: 'center' });
      
      doc.save(`Receipt-${invoice.id}.pdf`);
      return;
    }

    // --- STANDARD A4 DOCUMENT PREPARATION ---
    const doc = new jsPDFLib({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;

    let primaryColor = [79, 70, 229]; // Indigo
    let darkTextColor = [30, 41, 59];
    let mutedTextColor = [100, 116, 139];
    let bgHeaderColor = [248, 250, 252];
    let borderColor = [226, 232, 240];

    if (templateId === 'bold') {
      primaryColor = [5, 150, 105]; // Emerald
      bgHeaderColor = [236, 253, 245];
      borderColor = [167, 243, 208];
    } else if (templateId === 'corporate') {
      primaryColor = [30, 41, 59]; // Slate
      bgHeaderColor = [241, 245, 249];
      borderColor = [148, 163, 184];
    } else if (templateId === 'minimal') {
      primaryColor = [15, 23, 42];
      bgHeaderColor = [255, 255, 255];
      borderColor = [226, 232, 240];
    }

    let currentY = margin;

    // Helper to draw shop logo badge (Initials or emblem)
    const drawShopLogoBadge = (x: number, y: number, size = 12) => {
      doc.setFillColor(...primaryColor);
      doc.roundedRect(x, y, size, size, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      const initials = (profile.shopName || 'AC').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
      doc.text(initials, x + size / 2, y + size / 2 + 1.5, { align: 'center' });
    };

    // --- BOLD BANNER TEMPLATE SPECIAL HEADER ---
    if (templateId === 'bold') {
      doc.setFillColor(...primaryColor);
      doc.roundedRect(margin, currentY, contentWidth, 28, 2, 2, 'F');

      // Draw shop badge inside banner
      drawShopLogoBadge(margin + 6, currentY + 6, 14);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text((profile.shopName || 'Advika Collection').toUpperCase(), margin + 24, currentY + 11);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(209, 250, 229);
      doc.text(`${profile.shopAddress || ''} | Phone: ${profile.shopPhone || ''} | GSTIN: ${profile.gstin || 'N/A'}`, margin + 24, currentY + 19);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text('OFFICIAL VOUCHER', pageWidth - margin - 6, currentY + 11, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(209, 250, 229);
      doc.text(`No: ${invoice.id} | Date: ${formatDate(invoice.date)}`, pageWidth - margin - 6, currentY + 19, { align: 'right' });

      currentY += 34;
    } 
    // --- CORPORATE GST HEADER ---
    else if (templateId === 'corporate') {
      drawShopLogoBadge(margin, currentY, 14);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(...primaryColor);
      doc.text((profile.shopName || 'Advika Collection').toUpperCase(), margin + 18, currentY + 6);

      doc.setDrawColor(...primaryColor);
      doc.setLineWidth(0.8);
      doc.line(margin, currentY + 16, pageWidth - margin, currentY + 16);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(220, 38, 38);
      doc.text('TAX INVOICE', pageWidth - margin, currentY + 6, { align: 'right' });

      currentY += 19;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...mutedTextColor);
      doc.text(`Address: ${profile.shopAddress || ''} | Phone: ${profile.shopPhone || ''}`, margin, currentY);
      doc.text(`GSTIN: ${profile.gstin || '23AABCT123411Z5'} | State Code: 23`, pageWidth - margin, currentY, { align: 'right' });

      currentY += 8;
    }
    // --- MODERN CLASSIC / MINIMAL HEADER ---
    else {
      doc.setFillColor(...primaryColor);
      doc.rect(margin, currentY, contentWidth, templateId === 'minimal' ? 0.5 : 2, 'F');
      currentY += 6;

      drawShopLogoBadge(margin, currentY, 14);

      doc.setFont('helvetica', templateId === 'minimal' ? 'normal' : 'bold');
      doc.setFontSize(18);
      doc.setTextColor(...primaryColor);
      doc.text((profile.shopName || 'Advika Collection').toUpperCase(), margin + 18, currentY + 6);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(...darkTextColor);
      doc.text(templateId === 'minimal' ? 'INVOICE' : 'TAX INVOICE', pageWidth - margin, currentY + 6, { align: 'right' });

      currentY += 14;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...mutedTextColor);
      if (profile.shopAddress) {
        doc.text(`Address: ${profile.shopAddress}`, margin, currentY);
        currentY += 4.5;
      }
      doc.text(`Phone: ${profile.shopPhone || 'N/A'} | GSTIN: ${profile.gstin || 'N/A'}`, margin, currentY);
      currentY += 4.5;

      let metaY = margin + 14;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...darkTextColor);
      doc.text(`Invoice No: ${invoice.id}`, pageWidth - margin, metaY, { align: 'right' });
      metaY += 4.5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...mutedTextColor);
      doc.text(`Date: ${formatDate(invoice.date)}`, pageWidth - margin, metaY, { align: 'right' });
      metaY += 4.5;
      doc.text(`Payment: ${invoice.paymentMode || 'Cash'}`, pageWidth - margin, metaY, { align: 'right' });

      currentY = Math.max(currentY + 4, metaY + 6);
    }

    // --- CUSTOMER BOX ---
    doc.setFillColor(...bgHeaderColor);
    doc.roundedRect(margin, currentY, contentWidth, 18, 2, 2, 'F');
    doc.setDrawColor(...borderColor);
    doc.roundedRect(margin, currentY, contentWidth, 18, 2, 2, 'D');

    const customer: any = invoice.customer || { name: 'Walk-in Customer', phone: 'N/A', email: '' };
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...mutedTextColor);
    doc.text('BILLED TO:', margin + 4, currentY + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...darkTextColor);
    doc.text(customer.name || 'Walk-in Customer', margin + 4, currentY + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...mutedTextColor);
    const phoneText = customer.phone && customer.phone !== 'N/A' ? `Phone: ${customer.phone}` : 'Walk-in / Cash Sale';
    doc.text(phoneText, margin + 4, currentY + 15);

    currentY += 24;

    // --- TABLE HEADERS ---
    const cols = [
      { name: '#', width: 10, align: 'center' },
      { name: 'Item Description', width: 70, align: 'left' },
      { name: 'Unit Price', width: 30, align: 'right' },
      { name: 'Qty', width: 18, align: 'center' },
      { name: 'Disc %', width: 20, align: 'center' },
      { name: 'Total', width: 32, align: 'right' }
    ];

    doc.setFillColor(...primaryColor);
    doc.roundedRect(margin, currentY, contentWidth, 8, 1, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);

    let currentX = margin;
    cols.forEach(col => {
      let alignX = currentX;
      if (col.align === 'right') alignX = currentX + col.width - 2;
      else if (col.align === 'center') alignX = currentX + col.width / 2;
      else alignX = currentX + 3;

      doc.text(col.name, alignX, currentY + 5.5, { align: col.align as any });
      currentX += col.width;
    });

    currentY += 8;

    // --- TABLE ROWS ---
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);

    invoice.items.forEach((item, index) => {
      if (currentY > pageHeight - 45) {
        doc.addPage();
        currentY = margin + 10;
      }

      if (index % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, currentY, contentWidth, 8, 'F');
      }

      doc.setDrawColor(241, 245, 249);
      doc.line(margin, currentY + 8, pageWidth - margin, currentY + 8);

      doc.setTextColor(...darkTextColor);
      currentX = margin;

      doc.text(`${index + 1}`, currentX + 5, currentY + 5.5, { align: 'center' });
      currentX += cols[0].width;

      let itemName = item.name || 'Item';
      if (itemName.length > 38) itemName = itemName.substring(0, 35) + '...';
      doc.text(itemName, currentX + 3, currentY + 5.5);
      currentX += cols[1].width;

      doc.text(formatCurrency(item.sellingPrice), currentX + cols[2].width - 2, currentY + 5.5, { align: 'right' });
      currentX += cols[2].width;

      doc.text(`${item.cartQuantity}`, currentX + cols[3].width / 2, currentY + 5.5, { align: 'center' });
      currentX += cols[3].width;

      doc.text(`${item.discountPercent || 0}%`, currentX + cols[4].width / 2, currentY + 5.5, { align: 'center' });
      currentX += cols[4].width;

      const lineSubtotal = (item.sellingPrice || 0) * (item.cartQuantity || 0);
      const lineTotal = lineSubtotal - (lineSubtotal * (item.discountPercent || 0)) / 100;
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(lineTotal), currentX + cols[5].width - 2, currentY + 5.5, { align: 'right' });
      doc.setFont('helvetica', 'normal');

      currentY += 8;
    });

    currentY += 4;

    // --- TOTALS SUMMARY ---
    const summaryBoxWidth = 85;
    const summaryX = pageWidth - margin - summaryBoxWidth;

    doc.setFillColor(...bgHeaderColor);
    doc.roundedRect(summaryX, currentY, summaryBoxWidth, 36, 2, 2, 'F');
    doc.setDrawColor(...borderColor);
    doc.roundedRect(summaryX, currentY, summaryBoxWidth, 36, 2, 2, 'D');

    let sumY = currentY + 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...mutedTextColor);
    doc.text('Subtotal:', summaryX + 4, sumY);
    doc.setTextColor(...darkTextColor);
    doc.text(formatCurrency(invoice.subtotal), summaryX + summaryBoxWidth - 4, sumY, { align: 'right' });
    sumY += 5.5;

    if (invoice.totalDiscount > 0) {
      doc.setTextColor(...mutedTextColor);
      doc.text('Total Discount:', summaryX + 4, sumY);
      doc.setTextColor(220, 38, 38);
      doc.text(`- ${formatCurrency(invoice.totalDiscount)}`, summaryX + summaryBoxWidth - 4, sumY, { align: 'right' });
      sumY += 5.5;
    }

    doc.setDrawColor(...borderColor);
    doc.line(summaryX + 4, sumY, summaryX + summaryBoxWidth - 4, sumY);
    sumY += 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...primaryColor);
    doc.text('Grand Total:', summaryX + 4, sumY);
    doc.text(formatCurrency(invoice.total), summaryX + summaryBoxWidth - 4, sumY, { align: 'right' });
    sumY += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...mutedTextColor);
    doc.text('Amount Paid:', summaryX + 4, sumY);
    doc.setTextColor(...darkTextColor);
    doc.text(formatCurrency(invoice.amountPaid || invoice.total), summaryX + summaryBoxWidth - 4, sumY, { align: 'right' });

    currentY += 42;

    if (invoice.notes) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...darkTextColor);
      doc.text('Notes:', margin, currentY);
      currentY += 4;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...mutedTextColor);
      doc.text(invoice.notes, margin, currentY);
      currentY += 8;
    }

    // Corporate Signature Block
    if (templateId === 'corporate') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...darkTextColor);
      doc.text('Terms & Conditions:', margin, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text('1. Subject to local jurisdiction. 2. Goods once sold are non-refundable.', margin, currentY + 4);

      doc.setFont('helvetica', 'bold');
      doc.text(`For ${profile.shopName}`, pageWidth - margin, currentY, { align: 'right' });
      doc.text('Authorized Signatory', pageWidth - margin, currentY + 12, { align: 'right' });
    } else {
      const footerY = pageHeight - 20;
      doc.setDrawColor(...borderColor);
      doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...primaryColor);
      doc.text('Thank you for shopping with us!', margin, footerY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...mutedTextColor);
      doc.text(`Generated using ${templateId.toUpperCase()} template.`, margin, footerY + 4);
      doc.text('Authorized Signatory', pageWidth - margin, footerY + 4, { align: 'right' });
    }

    doc.save(`Invoice-${invoice.id}.pdf`);
  }
}
