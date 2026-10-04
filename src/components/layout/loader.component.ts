import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col items-center justify-center p-8 space-y-4 animate-in fade-in duration-500">
      <div class="relative w-16 h-16">
        <div class="absolute inset-0 rounded-full border-4 border-slate-100"></div>
        <div class="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="material-icons-outlined text-indigo-600 animate-pulse text-xl">sync</span>
        </div>
      </div>
      <div class="text-center">
        <p class="text-slate-900 font-extrabold text-sm tracking-tight">{{ message() }}</p>
        <p class="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Please wait while we sync</p>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .fade-in { animation: fadeIn 0.5s ease-out forwards; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoaderComponent {
  message = input<string>('Loading data...');
}
