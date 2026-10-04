import { Injectable, signal, computed, effect } from '@angular/core';
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private urlKey = 'advika_supabase_url';
  private anonKeyStorage = 'advika_supabase_anon_key';

  // Default Supabase project credentials (publishable client key)
  private defaultUrl = '';
  private defaultAnonKey = '';

  url = signal<string>(this.getInitialUrl());
  anonKey = signal<string>(this.getInitialKey());

  currentUser = signal<User | null>(null);
  currentSession = signal<Session | null>(null);
  authLoading = signal<boolean>(true);
  isDemoUser = signal<boolean>(this.getInitialDemoUser());

  private isLocalDemoHost(): boolean {
    return typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  }

  private getInitialDemoUser(): boolean {
    if (!this.isLocalDemoHost()) {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('advika_demo_user');
      return false;
    }
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('advika_demo_user');
      if (stored !== null) return stored === 'true';
    }
    return false;
  }

  client = computed<SupabaseClient | null>(() => {
    const currentUrl = this.url().trim();
    const currentKey = this.anonKey().trim();
    if (!currentUrl || !currentKey || !currentUrl.startsWith('http')) {
      return null;
    }
    try {
      return createClient(currentUrl, currentKey, {
        global: {
          headers: {
            apikey: currentKey,
            Authorization: `Bearer ${currentKey}`
          }
        },
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      });
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      return null;
    }
  });

  isConfigured = computed(() => !!this.client());
  isAuthenticated = computed(() => !!this.currentUser() || this.isDemoUser());

  constructor() {
    // Re-bind auth listener whenever client changes
    effect(() => {
      const supabase = this.client();
      if (supabase) {
        this.authLoading.set(true);
        supabase.auth.getSession().then(({ data: { session } }) => {
          this.currentSession.set(session);
          this.currentUser.set(session?.user ?? null);
          this.authLoading.set(false);
        }).catch(() => {
          this.authLoading.set(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          this.currentSession.set(session);
          this.currentUser.set(session?.user ?? null);
          if (session?.user) {
            this.isDemoUser.set(false);
          }
          this.authLoading.set(false);
        });

        return () => subscription.unsubscribe();
      } else {
        this.authLoading.set(false);
      }
    });

  }

  private getInitialUrl(): string {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(this.urlKey) : null;
    if (stored) return stored;

    const globalObj = typeof window !== 'undefined' ? (window as any) : (globalThis as any);
    if (globalObj.SUPABASE_URL) {
      return globalObj.SUPABASE_URL;
    }
    const envObj = typeof process !== 'undefined' ? process.env : (import.meta as any)?.env;
    if (envObj?.['SUPABASE_URL']) {
      return envObj['SUPABASE_URL'];
    }
    if (envObj?.['VITE_SUPABASE_URL']) {
      return envObj['VITE_SUPABASE_URL'];
    }
    return this.defaultUrl;
  }

  private getInitialKey(): string {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(this.anonKeyStorage) : null;
    if (stored) return stored;

    const globalObj = typeof window !== 'undefined' ? (window as any) : (globalThis as any);
    if (globalObj.SUPABASE_ANON_KEY) {
      return globalObj.SUPABASE_ANON_KEY;
    }
    const envObj = typeof process !== 'undefined' ? process.env : (import.meta as any)?.env;
    if (envObj?.['SUPABASE_ANON_KEY']) {
      return envObj['SUPABASE_ANON_KEY'];
    }
    if (envObj?.['VITE_SUPABASE_ANON_KEY']) {
      return envObj['VITE_SUPABASE_ANON_KEY'];
    }
    return this.defaultAnonKey;
  }

  async signInWithPassword(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    const supabase = this.client();
    if (!supabase) {
      return { success: false, error: 'Supabase client is not configured. Please enter project credentials below or in Settings.' };
    }
    this.authLoading.set(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      this.authLoading.set(false);
      if (error) {
        return { success: false, error: error.message };
      }
      this.currentSession.set(data.session);
      this.currentUser.set(data.user);
      this.isDemoUser.set(false);
      if (typeof localStorage !== 'undefined') localStorage.removeItem('advika_demo_user');
      return { success: true };
    } catch (e: any) {
      this.authLoading.set(false);
      return { success: false, error: e?.message || 'Login failed' };
    }
  }

  async signUp(email: string, password: string, fullName?: string): Promise<{ success: boolean; error?: string; needEmailVerification?: boolean }> {
    const supabase = this.client();
    if (!supabase) {
      return { success: false, error: 'Supabase client is not configured. Please enter project credentials below or in Settings.' };
    }
    this.authLoading.set(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName }
        }
      });
      this.authLoading.set(false);
      if (error) {
        return { success: false, error: error.message };
      }
      if (data.user && !data.session) {
        return { success: true, needEmailVerification: true };
      }
      this.currentSession.set(data.session);
      this.currentUser.set(data.user);
      this.isDemoUser.set(false);
      if (typeof localStorage !== 'undefined') localStorage.removeItem('advika_demo_user');
      return { success: true };
    } catch (e: any) {
      this.authLoading.set(false);
      return { success: false, error: e?.message || 'Registration failed' };
    }
  }

  async signOut(): Promise<void> {
    const supabase = this.client();
    if (supabase) {
      await supabase.auth.signOut();
    }
    this.currentUser.set(null);
    this.currentSession.set(null);
    this.isDemoUser.set(false);
    if (typeof localStorage !== 'undefined') localStorage.removeItem('advika_demo_user');
  }

  isLocalDemoAvailable(): boolean {
    return this.isLocalDemoHost();
  }

  loginAsDemoUser(): boolean {
    if (!this.isLocalDemoHost()) return false;
    this.isDemoUser.set(true);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('advika_demo_user', 'true');
    }
    return true;
  }

  saveCredentials(url: string, anonKey: string): { success: boolean; error?: string } {
    const trimmedUrl = url.trim();
    const trimmedKey = anonKey.trim();

    if (!trimmedUrl || !trimmedKey) {
      return { success: false, error: 'Both Supabase URL and Publishable/Anon Key are required.' };
    }

    if (!trimmedUrl.startsWith('https://') && !trimmedUrl.startsWith('http://')) {
      return { success: false, error: 'Supabase URL must start with https://' };
    }

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.urlKey, trimmedUrl);
        localStorage.setItem(this.anonKeyStorage, trimmedKey);
      }
      this.url.set(trimmedUrl);
      this.anonKey.set(trimmedKey);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to save Supabase configuration' };
    }
  }

  clearCredentials() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.urlKey);
      localStorage.removeItem(this.anonKeyStorage);
    }
    this.url.set('');
    this.anonKey.set('');
  }
}
