import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
      @for (toast of toastService.messages(); track toast.id) {
        <div
          class="pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-xl"
          [class.border-emerald-600]="toast.type === 'success'"
          [class.bg-emerald-600]="toast.type === 'success'"
          [class.border-rose-600]="toast.type === 'error'"
          [class.bg-rose-600]="toast.type === 'error'"
          [class.border-blue-600]="toast.type === 'info'"
          [class.bg-blue-600]="toast.type === 'info'"
          [attr.role]="toast.type === 'error' ? 'alert' : 'status'">
          <span
            class="material-icons-outlined mt-0.5 text-lg text-white">
            {{ toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info' }}
          </span>
          <p class="min-w-0 flex-1 text-sm font-semibold text-white">{{ toast.message }}</p>
          <button type="button" (click)="toastService.dismiss(toast.id)" aria-label="Dismiss notification"
            class="rounded-md p-1 text-white/80 transition-colors hover:bg-white/15 hover:text-white">
            <span class="material-icons-outlined text-base">close</span>
          </button>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);
}
