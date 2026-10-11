import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { BusinessProfile } from '../../services/settings.service';
import { Invoice, InvoiceTemplateId } from '../../models/invoice.model';
import { SettingsService } from '../../services/settings.service';
import { InvoiceTemplatePreviewComponent } from './invoice-template-preview.component';

describe('InvoiceTemplatePreviewComponent', () => {
  let component: InvoiceTemplatePreviewComponent;
  let fixture: ComponentFixture<InvoiceTemplatePreviewComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [InvoiceTemplatePreviewComponent],
      providers: [{
        provide: SettingsService,
        useValue: { defaultTemplate: () => 'modern', businessProfile: () => ({ shopName: 'Test Shop' }) }
      }],
      schemas: [NO_ERRORS_SCHEMA]
    });
    fixture = TestBed.createComponent(InvoiceTemplatePreviewComponent);
    component = fixture.componentInstance;
  });

  it('selects a template and computes the invoice balance and discounted line amount', () => {
    const invoice: Invoice = {
      id: 'INV-1', date: new Date(), customer: { id: 'c1', name: 'Asha', phone: '555', purchaseHistory: [] },
      items: [{ id: 'p1', name: 'Bandage', cartQuantity: 2, sellingPrice: 25, discountPercent: 20, isCustom: false }],
      subtotal: 50, total: 40, paymentMode: 'Cash', totalDiscount: 10, amountPaid: 15
    };
    component.invoice = invoice;
    component.template = 'thermal';
    fixture.detectChanges();
    expect(component.activeTemplate()).toBe('thermal');
    expect(component.profile().shopName).toBe('Test Shop');
    expect(component.balance()).toBe(25);
    expect(component.lineTotal(invoice.items[0])).toBe(40);
  });

  it('uses the total as paid when amountPaid is not supplied', () => {
    component.invoice = {
      id: 'INV-2', date: new Date(), customer: { id: 'c2', name: 'Walk-in', phone: '', purchaseHistory: [] },
      items: [], subtotal: 12, total: 12, paymentMode: 'Cash', totalDiscount: 0, amountPaid: undefined as unknown as number
    };
    expect(component.balance()).toBe(0);
  });

  it('renders all supported template layouts and honors invoice/profile defaults', () => {
    const invoice: Invoice = {
      id: 'INV-3',
      date: new Date('2026-05-06T12:00:00Z'),
      customer: { id: 'c3', name: 'Mira', phone: '555', purchaseHistory: [] },
      items: [{ id: 'p3', name: 'Gauze', cartQuantity: 1, sellingPrice: 12, discountPercent: 0, sku: 'G-1', isCustom: false }],
      subtotal: 12,
      total: 12,
      paymentMode: 'UPI',
      totalDiscount: 0,
      amountPaid: 15,
      template: 'corporate',
      notes: 'Handle with care'
    };
    const customProfile: BusinessProfile = {
      shopName: 'Custom Clinic',
      shopAddress: '12 Main Road',
      shopPhone: '12345',
      gstin: 'GST-123'
    };

    component.invoice = invoice;
    component.template = undefined;
    component.customProfile = customProfile;
    fixture.detectChanges();
    expect(component.activeTemplate()).toBe('corporate');
    expect(component.profile()).toBe(customProfile);
    expect(component.balance()).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Custom Clinic');
    expect(fixture.nativeElement.textContent).toContain('Gauze');

    const templates: InvoiceTemplateId[] = ['modern', 'thermal', 'minimal', 'corporate', 'bold'];
    for (const template of templates) {
      const templateFixture = TestBed.createComponent(InvoiceTemplatePreviewComponent);
      templateFixture.componentRef.setInput('invoice', invoice);
      templateFixture.componentRef.setInput('template', template);
      templateFixture.componentRef.setInput('customProfile', customProfile);
      templateFixture.detectChanges();
      expect(templateFixture.componentInstance.activeTemplate()).toBe(template);
      expect(templateFixture.nativeElement.textContent).toContain('INV-3');
    }
  });

  it('uses settings defaults and safely handles missing invoice line values', () => {
    component.invoice = {
      id: 'INV-4',
      date: new Date(),
      customer: { id: 'c4', name: 'Walk-in', phone: '', purchaseHistory: [] },
      items: [],
      subtotal: 0,
      total: 10,
      paymentMode: 'Cash',
      totalDiscount: 0,
      amountPaid: undefined as unknown as number
    };
    component.template = undefined;
    fixture.detectChanges();
    expect(component.activeTemplate()).toBe('modern');
    expect(component.balance()).toBe(0);
    expect(component.lineTotal({ sellingPrice: 0, cartQuantity: 0, discountPercent: 0 })).toBe(0);
  });
});
