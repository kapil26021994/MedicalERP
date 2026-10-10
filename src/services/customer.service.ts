import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Customer } from '../models/customer.model';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private http = inject(HttpClient);
  private supabaseService = inject(SupabaseService);
  private apiUrl = '/api/customers';

  private initialCustomers: Customer[] = [];

  customers = signal<Customer[]>([]);
  isLoaded = signal(false);
  isLoading = signal(false);
  private requestVersion = 0;

  constructor() {
    // In-memory only
  }

  private deduplicate(customers: Customer[]): Customer[] {
    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();
    const result: Customer[] = [];

    for (const c of customers) {
      const emailKey = c.email?.toLowerCase().trim();
      const phoneKey = c.phone?.trim();

      const hasEmail = emailKey && emailKey.length > 0;
      const hasPhone = phoneKey && phoneKey !== 'n/a' && phoneKey.length > 0;

      if (hasEmail && seenEmails.has(emailKey)) {
        continue;
      }
      if (hasPhone && seenPhones.has(phoneKey)) {
        continue;
      }

      if (hasEmail) seenEmails.add(emailKey);
      if (hasPhone) seenPhones.add(phoneKey);
      result.push(c);
    }
    return result;
  }

  setCustomers(data: Customer[]) {
    if (!Array.isArray(data)) return;
    this.customers.set(data);
    this.isLoaded.set(true);
  }

  clearAccountData(): void {
    this.requestVersion++;
    this.customers.set([]);
    this.isLoaded.set(false);
    this.isLoading.set(false);
  }

  // Fetch customers from API / Supabase DB
  async fetchCustomers(force: boolean = false) {
    if (!force && this.isLoaded()) return;
    const requestVersion = this.requestVersion;
    this.isLoading.set(true);

    const supabase = this.supabaseService.client();
    if (this.supabaseService.isConfigured() && supabase) {
      const currentUserId = this.supabaseService.currentUser()?.id;
      if (currentUserId) {
        try {
          let query = supabase.from('customers').select('*').eq('user_id', currentUserId);
          const { data, error } = await query.order('created_at', { ascending: false });
          if (!error && data) {
             if (requestVersion !== this.requestVersion) return;
             const mapped = data.map(d => ({
                id: d.id,
                name: d.name,
                phone: d.phone,
                email: d.email,
                dueAmount: d.due_amount || 0,
                paidAmount: d.paid_amount || 0,
                notes: d.notes,
                purchaseHistory: d.purchase_history || []
             }));
             this.customers.set(mapped);
             this.isLoaded.set(true);
             this.isLoading.set(false);
             return;
          }
        } catch (e) {
          if (requestVersion !== this.requestVersion) return;
          this.isLoading.set(false);
        }
      }
      try {
        const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
        if (!error && data) {
           if (requestVersion !== this.requestVersion) return;
           const mapped = data.map(d => ({
              id: d.id,
              name: d.name,
              phone: d.phone,
              email: d.email,
              dueAmount: d.due_amount || 0,
              paidAmount: d.paid_amount || 0,
              notes: d.notes,
              purchaseHistory: d.purchase_history || []
           }));
           this.customers.set(mapped);
           this.isLoaded.set(true);
           this.isLoading.set(false);
           return;
        }
      } catch (e) {
        if (requestVersion !== this.requestVersion) return;
        this.isLoading.set(false);
      }
    }

    this.http.get<any>(this.apiUrl).subscribe({
      next: (res) => {
        if (requestVersion !== this.requestVersion) return;
        const data = Array.isArray(res) ? res : res?.customers;
        if (Array.isArray(data)) {
          this.customers.set(data);
        }
        this.isLoaded.set(true);
        this.isLoading.set(false);
      },
      error: () => {
        if (requestVersion !== this.requestVersion) return;
        this.isLoading.set(false);
      }
    });
  }

  // Add/Register a new Client, store in DB, and update Customer Registry list
  async addCustomer(customer: Omit<Customer, 'id' | 'purchaseHistory'>): Promise<Customer> {
    // Check if customer with same non-empty email or phone already exists
    const currentList = this.customers();
    const cleanEmail = customer.email ? customer.email.toLowerCase().trim() : '';
    const cleanPhone = customer.phone ? customer.phone.trim() : '';

    const existing = currentList.find(c => 
      (cleanEmail.length > 0 && c.email?.toLowerCase().trim() === cleanEmail) ||
      (cleanPhone.length > 0 && cleanPhone !== 'N/A' && cleanPhone !== 'n/a' && c.phone?.trim() === cleanPhone)
    );

    if (existing) {
      const matchField = (cleanEmail.length > 0 && existing.email?.toLowerCase().trim() === cleanEmail) ? 'email address' : 'phone number';
      throw new Error(`Duplicate Client Error: A client with this ${matchField} (${cleanEmail || cleanPhone}) is already registered.`);
    }

    const tempId = `cust-${Date.now()}`;
    const newCustomer: Customer = {
      ...customer,
      id: tempId,
      purchaseHistory: [],
      dueAmount: customer.dueAmount || 0,
      paidAmount: customer.paidAmount || 0,
      notes: customer.notes || ''
    };

    // Optimistically update list in UI (Customer Registry tab)
    this.customers.update(list => this.deduplicate([newCustomer, ...list]));

    // Always trigger HTTP POST request for DevTools Network tab logging
    this.http.post<any>(this.apiUrl, newCustomer).subscribe({
      next: (res) => {
        if (!this.supabaseService.isConfigured()) {
          if (res && res.customers && Array.isArray(res.customers)) {
            this.customers.set(res.customers);
          } else if (res && res.customer) {
            this.customers.update(list =>
              list.map(c => c.id === tempId ? res.customer : c)
            );
          }
        }
      },
      error: () => {}
    });

    // Also store in Supabase DB directly if available
    const supabase = this.supabaseService.client();
    const currentUserId = this.supabaseService.currentUser()?.id;
    if (this.supabaseService.isConfigured() && supabase && currentUserId) {
      try {
        await supabase.from('customers').insert([{
          id: newCustomer.id,
          name: newCustomer.name,
          phone: newCustomer.phone,
          email: newCustomer.email,
          due_amount: newCustomer.dueAmount,
          paid_amount: newCustomer.paidAmount,
          notes: newCustomer.notes,
          created_at: new Date().toISOString(),
          user_id: currentUserId
        }]);
      } catch (e) {}
    }

    return newCustomer;
  }

  async updateCustomer(updatedCustomer: Customer) {
    this.customers.update(list =>
      list.map(c => c.id === updatedCustomer.id ? updatedCustomer : c)
    );

    // Always trigger HTTP PUT request for DevTools Network tab logging
    this.http.put<any>(`${this.apiUrl}/${updatedCustomer.id}`, updatedCustomer).subscribe({
      next: (res) => {
        if (res && res.customers && !this.supabaseService.isConfigured()) {
          this.customers.set(res.customers);
        }
      },
      error: () => {}
    });

    const supabase = this.supabaseService.client();
    const currentUserId = this.supabaseService.currentUser()?.id;
    if (this.supabaseService.isConfigured() && supabase && currentUserId) {
      try {
        await supabase.from('customers').update({
          name: updatedCustomer.name,
          phone: updatedCustomer.phone,
          email: updatedCustomer.email,
          due_amount: updatedCustomer.dueAmount,
          paid_amount: updatedCustomer.paidAmount,
          notes: updatedCustomer.notes,
          user_id: currentUserId
        }).eq('id', updatedCustomer.id).eq('user_id', currentUserId);
      } catch (e) {}
    }
  }

  async deleteCustomer(customerId: string) {
    this.customers.update(list => list.filter(c => c.id !== customerId));

    // Always trigger HTTP DELETE request for DevTools Network tab logging
    try {
      await firstValueFrom(this.http.delete<any>(`${this.apiUrl}/${customerId}`));
    } catch (e) {}

    const supabase = this.supabaseService.client();
    const currentUserId = this.supabaseService.currentUser()?.id;
    if (this.supabaseService.isConfigured() && supabase && currentUserId) {
      try {
        await supabase.from('customers').delete().eq('id', customerId).eq('user_id', currentUserId);
      } catch (e) {}
    }
  }

  async deleteAllCustomers() {
    this.customers.set([]);
    try {
      await firstValueFrom(this.http.delete<any>(`${this.apiUrl}/all`));
    } catch (e) {}

    const supabase = this.supabaseService.client();
    if (this.supabaseService.isConfigured() && supabase) {
      try {
        await supabase.from('customers').delete().neq('id', '0');
      } catch (e) {}
    }
  }

  getCustomerByPhone(phone: string): Customer | undefined {
    return this.customers().find(c => c.phone === phone);
  }

  getWalkingCustomer(): Customer | undefined {
    return this.customers().find(c => c.name === 'Walking Customer');
  }
}
