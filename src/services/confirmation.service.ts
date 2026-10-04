import { Injectable, signal } from '@angular/core';

export interface ConfirmationOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmationService {
  private resolveFn: ((value: boolean) => void) | null = null;
  
  isOpen = signal(false);
  options = signal<ConfirmationOptions>({
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?'
  });

  confirm(options: ConfirmationOptions): Promise<boolean> {
    this.options.set({
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      type: 'warning',
      ...options
    });
    this.isOpen.set(true);
    
    return new Promise((resolve) => {
      this.resolveFn = resolve;
    });
  }

  handleAction(confirmed: boolean) {
    this.isOpen.set(false);
    if (this.resolveFn) {
      this.resolveFn(confirmed);
      this.resolveFn = null;
    }
  }
}
