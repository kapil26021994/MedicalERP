import { Injectable, signal, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Expense } from '../models/expense.model';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private http = inject(HttpClient);
  private supabaseService = inject(SupabaseService);

  private apiUrl = '/api/expenses';

  expenses = signal<Expense[]>([]);
  isLoaded = signal(false);
  isLoading = signal(false);

  constructor() {
    // In-memory only
  }

  private safeDate(d: any): Date {
    if (!d) return new Date();
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  setExpenses(data: Expense[]) {
    if (!Array.isArray(data)) return;
    const mapped = data.map((e: any) => ({ ...e, date: this.safeDate(e.date) }));
    this.expenses.set(mapped);
    this.isLoaded.set(true);
  }

  fetchExpensesFromApi(force: boolean = false) {
    return this.fetchExpenses(force);
  }

  async fetchExpenses(force: boolean = false) {
    if (!force && this.isLoaded()) return;
    this.isLoading.set(true);

    const supabase = this.supabaseService.client();
    if (this.supabaseService.isConfigured() && supabase) {
      try {
        const { data, error } = await supabase.from('expenses').select('*').order('created_at', { ascending: false });
        if (!error && data) {
           const mapped = data.map((e: any) => ({
             id: e.id,
             category: e.category || 'Other',
             description: e.description || '',
             amount: e.amount || 0,
             date: this.safeDate(e.date || e.created_at)
           }));
           this.expenses.set(mapped);
           this.isLoaded.set(true);
           this.isLoading.set(false);
           return;
        }
      } catch (e) {
        this.isLoading.set(false);
      }
    }

    this.http.get<any>(this.apiUrl).subscribe({
      next: (res) => {
        const data = Array.isArray(res) ? res : res?.expenses;
        if (Array.isArray(data)) {
          const mapped = data.map((e: any) => ({
            ...e,
            date: this.safeDate(e.date)
          }));
          this.expenses.set(mapped);
        }
        this.isLoaded.set(true);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  async addExpense(expenseData: Omit<Expense, 'id'>): Promise<Expense> {
    const newExpense: Expense = {
      ...expenseData,
      date: this.safeDate(expenseData.date),
      id: `exp-${Date.now()}`
    };

    // Optimistically update signal list
    this.expenses.update(list => [newExpense, ...list].sort((a, b) => this.safeDate(b.date).getTime() - this.safeDate(a.date).getTime()));

    // Sync to Supabase cleanly without throwing schema cache errors
    try {
      const client = this.supabaseService.client();
      if (this.supabaseService.isConfigured() && client) {
        const { error } = await client.from('expenses').insert([{
          id: newExpense.id,
          date: newExpense.date.toISOString(),
          category: newExpense.category,
          description: newExpense.description,
          amount: newExpense.amount
        }]);

        if (error) {
          if (error.code === 'PGRST204' || error.message?.includes('schema cache') || error.message?.includes('not find the table')) {
            console.warn('[Supabase Notice] Table "expenses" not created in Supabase yet. Recorded locally and in server memory.');
          } else {
            console.warn('[Supabase Insert Expense Notice]:', error.message);
          }
        }
      }
    } catch (e) {
      // Table missing or offline, silent fallback
    }

    // Sync to Server API
    this.http.post<any>(this.apiUrl, {
      ...newExpense,
      date: newExpense.date.toISOString()
    }).subscribe({
      next: () => {},
      error: () => {}
    });

    return newExpense;
  }

  async updateExpense(updatedExpense: Expense): Promise<void> {
    const safeUpdated = {
      ...updatedExpense,
      date: this.safeDate(updatedExpense.date)
    };

    this.expenses.update(list =>
      list.map(e => (e.id === safeUpdated.id ? safeUpdated : e))
        .sort((a, b) => this.safeDate(b.date).getTime() - this.safeDate(a.date).getTime())
    );

    // Sync to Supabase cleanly
    try {
      const client = this.supabaseService.client();
      if (this.supabaseService.isConfigured() && client) {
        const { error } = await client.from('expenses').update({
          date: safeUpdated.date.toISOString(),
          category: safeUpdated.category,
          description: safeUpdated.description,
          amount: safeUpdated.amount
        }).eq('id', safeUpdated.id);

        if (error) {
          if (error.code === 'PGRST204' || error.message?.includes('schema cache') || error.message?.includes('not find the table')) {
            console.warn('[Supabase Notice] Table "expenses" not created in Supabase yet.');
          } else {
            console.warn('[Supabase Update Expense Notice]:', error.message);
          }
        }
      }
    } catch (e) {}

    // Sync to Backend
    this.http.put<any>(`${this.apiUrl}/${safeUpdated.id}`, {
      ...safeUpdated,
      date: safeUpdated.date.toISOString()
    }).subscribe({
      next: () => {},
      error: () => {}
    });
  }

  async deleteExpense(expenseId: string): Promise<void> {
    this.expenses.update(list => list.filter(e => e.id !== expenseId));

    try {
      const client = this.supabaseService.client();
      if (this.supabaseService.isConfigured() && client) {
        const { error } = await client.from('expenses').delete().eq('id', expenseId);
        if (error) {
          if (error.code === 'PGRST204' || error.message?.includes('schema cache') || error.message?.includes('not find the table')) {
            console.warn('[Supabase Notice] Table "expenses" not created in Supabase yet.');
          } else {
            console.warn('[Supabase Delete Expense Notice]:', error.message);
          }
        }
      }
    } catch (e) {}

    try {
      await firstValueFrom(this.http.delete<any>(`${this.apiUrl}/${expenseId}`));
    } catch (e) {}
  }

  async deleteAllExpenses(): Promise<void> {
    this.expenses.set([]);

    try {
      const client = this.supabaseService.client();
      if (this.supabaseService.isConfigured() && client) {
        await client.from('expenses').delete().neq('id', '0');
      }
    } catch (e) {}

    try {
      await firstValueFrom(this.http.delete<any>(`${this.apiUrl}/all`));
    } catch (e) {}
  }
}
