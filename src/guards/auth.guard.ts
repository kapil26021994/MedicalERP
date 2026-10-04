import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs/operators';

export const authGuard: CanActivateFn = (_route, _state) => {
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);

  // If already loaded and not authenticated, redirect
  if (!supabaseService.authLoading()) {
    if (supabaseService.isAuthenticated()) {
      return true;
    }
    return router.createUrlTree(['/login']);
  }

  // Otherwise, wait for authLoading to complete (i.e. become false)
  return toObservable(supabaseService.authLoading).pipe(
    filter(loading => !loading),
    take(1),
    map(() => {
      if (supabaseService.isAuthenticated()) {
        return true;
      }
      return router.createUrlTree(['/login']);
    })
  );
};
