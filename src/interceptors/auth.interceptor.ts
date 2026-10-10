import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { SupabaseService } from '../services/supabase.service';
import { from, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

/**
 * Auth Interceptor that attaches Authorization Bearer tokens
 * and Supabase API key headers to all outgoing /api requests.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.startsWith('/api/')) {
    const supabaseService = inject(SupabaseService);
    const anonKey = supabaseService.anonKey();
    
    return from(supabaseService.getAccessToken()).pipe(
      switchMap(token => {
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        if (anonKey) {
          headers['apikey'] = anonKey;
          headers['x-supabase-key'] = anonKey;
        }
        return next(req.clone({ setHeaders: headers }));
      }),
      catchError((error: HttpErrorResponse) => {
        // Handle 401 Unauthorized or cases where backend returns HTML (e.g. login page)
        if (error.status === 401 || (typeof error.error === 'string' && error.error.includes('<!DOCTYPE'))) {
          console.warn('Unauthorized API access or redirect detected');
        }
        return throwError(() => error);
      })
    );
  }

  return next(req);
};
