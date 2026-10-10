import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Challan, ChallanItem } from '../models/challan.model';

interface ChallanListResponse {
  success: boolean;
  challans: Challan[];
  error?: string;
}

interface ChallanResponse {
  success: boolean;
  challan: Challan;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class ChallanService {
  challans = signal<Challan[]>([]);
  isLoading = signal(false);
  private readonly apiUrl = '/api/challans';
  private requestVersion = 0;

  constructor(private readonly http: HttpClient) {}

  private normalizeDate(value: unknown): string {
    if (!value) return new Date().toISOString();
    const date = new Date(value as string | number | Date);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }

  private mapChallan(item: Challan): Challan {
    return {
      ...item,
      date: this.normalizeDate(item.date),
      dueDate: this.normalizeDate(item.dueDate),
      items: Array.isArray(item.items) ? item.items.map((row: ChallanItem) => ({
        ...row,
        quantity: Number(row.quantity) || 0,
        rate: Number(row.rate) || 0,
        oldMrp: Number(row.oldMrp) || 0,
        mrp: Number(row.mrp) || 0,
        discountPercent: Number(row.discountPercent) || 0,
        gstPercent: Number(row.gstPercent) || 0,
        amount: Number(row.amount) || 0
      })) : [],
      totalAmount: Number(item.totalAmount) || 0,
      paidAmount: Number(item.paidAmount) || 0,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString()
    };
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const apiMessage = error.error?.error;
      return typeof apiMessage === 'string' ? apiMessage : `${fallback} (HTTP ${error.status})`;
    }
    return error instanceof Error ? error.message : fallback;
  }

  clearAccountData(): void {
    this.requestVersion++;
    this.challans.set([]);
    this.isLoading.set(false);
  }

  async fetchChallans(): Promise<void> {
    const requestVersion = this.requestVersion;
    this.challans.set([]);
    this.isLoading.set(true);
    try {
      const response = await firstValueFrom(this.http.get<ChallanListResponse>(this.apiUrl));
      if (requestVersion !== this.requestVersion) return;
      if (!Array.isArray(response.challans)) {
        throw new Error('The challan API returned an invalid list response.');
      }
      this.challans.set(response.challans.map(item => this.mapChallan(item)));
    } catch (error) {
      if (requestVersion !== this.requestVersion) return;
      throw new Error(this.getErrorMessage(error, 'Failed to load challans.'));
    } finally {
      if (requestVersion === this.requestVersion) this.isLoading.set(false);
    }
  }

  getNextChallanNumber(): string {
    const maxNumber = this.challans().reduce((highest, challan) => {
      const match = String(challan.challanNumber).match(/(\d+)$/);
      return Math.max(highest, match ? Number(match[1]) : 0);
    }, 0);
    return `CH-${String(maxNumber + 1).padStart(4, '0')}`;
  }

  async addChallan(challan: Challan): Promise<Challan> {
    const requestVersion = this.requestVersion;
    try {
      const response = await firstValueFrom(this.http.post<ChallanResponse>(this.apiUrl, challan));
      if (!response.challan) throw new Error('The challan API did not return the created record.');
      const created = this.mapChallan(response.challan);
      if (requestVersion !== this.requestVersion) return created;
      this.challans.update(list => [created, ...list.filter(item => item.id !== created.id)]);
      return created;
    } catch (error) {
      throw new Error(this.getErrorMessage(error, 'Failed to create challan.'));
    }
  }

  async updateChallan(challan: Challan): Promise<Challan> {
    const requestVersion = this.requestVersion;
    try {
      const response = await firstValueFrom(
        this.http.put<ChallanResponse>(`${this.apiUrl}/${encodeURIComponent(challan.id)}`, challan)
      );
      if (!response.challan) throw new Error('The challan API did not return the updated record.');
      const updated = this.mapChallan(response.challan);
      if (requestVersion !== this.requestVersion) return updated;
      this.challans.update(list => list.map(item => item.id === updated.id ? updated : item));
      return updated;
    } catch (error) {
      throw new Error(this.getErrorMessage(error, 'Failed to update challan.'));
    }
  }

  async deleteChallan(id: string): Promise<void> {
    const requestVersion = this.requestVersion;
    try {
      await firstValueFrom(this.http.delete<{ success: boolean }>(`${this.apiUrl}/${encodeURIComponent(id)}`));
      if (requestVersion !== this.requestVersion) return;
      this.challans.update(list => list.filter(challan => challan.id !== id));
    } catch (error) {
      throw new Error(this.getErrorMessage(error, 'Failed to delete challan.'));
    }
  }

  getById(id: string): Challan | undefined {
    return this.challans().find(challan => challan.id === id);
  }
}
