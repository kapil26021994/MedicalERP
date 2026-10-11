import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthComponent } from './auth.component';
import { CustomerService } from '../../services/customer.service';
import { SupabaseService } from '../../services/supabase.service';
import { ToastService } from '../../services/toast.service';

describe('AuthComponent', () => {
  let component: AuthComponent;
  let supabase: SupabaseService;
  let customer: CustomerService;
  let toast: ToastService;
  let router: Router;
  let fixture: ReturnType<typeof TestBed.createComponent<AuthComponent>>;
  let signIn: ReturnType<typeof vi.fn>;
  let signUp: ReturnType<typeof vi.fn>;
  let loginAsDemo: ReturnType<typeof vi.fn>;
  let saveCredentials: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    signIn = vi.fn().mockResolvedValue({ success: true });
    signUp = vi.fn().mockResolvedValue({ success: true });
    loginAsDemo = vi.fn().mockReturnValue(false);
    saveCredentials = vi.fn().mockReturnValue({ success: false, error: 'Invalid credentials' });
    const supabaseMock = {
      isLocalDemoAvailable: () => true,
      isConfigured: () => true,
      url: () => '',
      anonKey: () => '',
      signInWithPassword: signIn,
      signUp,
      loginAsDemoUser: loginAsDemo,
      saveCredentials
    } as unknown as SupabaseService;
    const customerMock = { addCustomer: vi.fn().mockResolvedValue(undefined) } as unknown as CustomerService;
    const toastMock = { success: vi.fn() } as unknown as ToastService;

    TestBed.configureTestingModule({
      imports: [AuthComponent],
      providers: [
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: CustomerService, useValue: customerMock },
        { provide: ToastService, useValue: toastMock }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });

    fixture = TestBed.createComponent(AuthComponent);
    component = fixture.componentInstance;
    supabase = TestBed.inject(SupabaseService);
    customer = TestBed.inject(CustomerService);
    toast = TestBed.inject(ToastService);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  });

  it('does not submit an invalid form', async () => {
    await component.onSubmit();

    expect(signIn).not.toHaveBeenCalled();
    expect(component.loading()).toBe(false);
  });

  it('submits valid credentials through the rendered form', async () => {
    component.authForm.patchValue({ email: 'manager@example.com', password: 'secret1' });

    (fixture.nativeElement.querySelector('form') as HTMLFormElement)
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(signIn).toHaveBeenCalledWith('manager@example.com', 'secret1');
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('switches between sign-in and registration form fields', () => {
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('[formControlName="fullName"]')).toBeNull();

    const register = Array.from(root.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Register Client'));
    register?.click();
    fixture.detectChanges();

    expect(component.isSignUp()).toBe(true);
    expect(root.querySelector('[formControlName="fullName"]')).not.toBeNull();
    expect(root.querySelector('[formControlName="phone"]')).not.toBeNull();

    const signInTab = Array.from(root.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Sign In'));
    signInTab?.click();
    fixture.detectChanges();
    expect(component.isSignUp()).toBe(false);
    expect(root.querySelector('[formControlName="fullName"]')).toBeNull();
  });

  it('reports a failed configured sign-in and navigates after success', async () => {
    component.authForm.patchValue({ email: 'manager@example.com', password: 'secret1' });
    signIn.mockResolvedValueOnce({ success: false, error: 'Wrong password' });
    await component.onSubmit();

    expect(component.errorMessage()).toBe('Wrong password');
    expect(component.loading()).toBe(false);

    await component.onSubmit();
    expect(signIn).toHaveBeenCalledWith('manager@example.com', 'secret1');
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('uses the generic configured sign-in error when the response omits one', async () => {
    component.authForm.patchValue({ email: 'manager@example.com', password: 'secret1' });
    signIn.mockResolvedValue({ success: false });

    await component.onSubmit();

    expect(component.errorMessage()).toBe('Invalid credentials or connection error.');
    expect(component.loading()).toBe(false);
  });

  it('starts a local demo session when cloud sign-in is unavailable', async () => {
    vi.spyOn(supabase, 'isConfigured').mockReturnValue(false);
    loginAsDemo.mockReturnValue(true);
    component.authForm.patchValue({ email: 'manager@example.com', password: 'secret1' });
    vi.useFakeTimers();

    await component.onSubmit();
    expect(component.successMessage()).toBe('Signing in as Store Manager (Local Mode)...');
    expect(component.loading()).toBe(false);
    expect(router.navigate).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    vi.useRealTimers();
  });

  it('reports that cloud credentials are required if local demo login is rejected', async () => {
    vi.spyOn(supabase, 'isConfigured').mockReturnValue(false);
    component.authForm.patchValue({ email: 'manager@example.com', password: 'secret1' });

    await component.onSubmit();

    expect(loginAsDemo).toHaveBeenCalledOnce();
    expect(component.errorMessage()).toBe('Configure Supabase credentials to sign in.');
    expect(component.successMessage()).toBeNull();
  });

  it('blocks registration when the cloud is not configured', async () => {
    vi.spyOn(supabase, 'isConfigured').mockReturnValue(false);
    component.isSignUp.set(true);
    component.authForm.patchValue({ email: 'new@example.com', password: 'secret1' });

    await component.onSubmit();

    expect(component.errorMessage()).toBe('Configure Supabase credentials before creating an account.');
    expect(signUp).not.toHaveBeenCalled();
  });

  it('shows the email-verification notice without creating a customer profile', async () => {
    signUp.mockResolvedValue({ success: true, needEmailVerification: true });
    component.isSignUp.set(true);
    component.authForm.patchValue({ email: 'new@example.com', password: 'secret1' });

    await component.onSubmit();

    expect(component.successMessage()).toContain('Check your email');
    expect(customer.addCustomer).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('shows the returned registration error and the default message when missing', async () => {
    component.isSignUp.set(true);
    component.authForm.patchValue({ email: 'new@example.com', password: 'secret1' });
    signUp.mockResolvedValueOnce({ success: false, error: 'Email already registered' });
    await component.onSubmit();
    expect(component.errorMessage()).toBe('Email already registered');

    signUp.mockResolvedValueOnce({ success: false });
    await component.onSubmit();
    expect(component.errorMessage()).toBe('Account registration failed.');
    expect(component.loading()).toBe(false);
  });

  it('uses the email prefix and N/A phone when optional registration details are absent', async () => {
    component.isSignUp.set(true);
    component.authForm.patchValue({ email: 'alexa@example.com', password: 'secret1' });

    await component.onSubmit();

    expect(signUp).toHaveBeenCalledWith('alexa@example.com', 'secret1', 'alexa');
    expect(customer.addCustomer).toHaveBeenCalledWith(expect.objectContaining({
      name: 'alexa',
      phone: 'N/A'
    }));
  });

  it('reports a customer-profile failure after the account was created', async () => {
    vi.spyOn(customer, 'addCustomer').mockRejectedValue(new Error('database unavailable'));
    component.isSignUp.set(true);
    component.authForm.patchValue({ email: 'new@example.com', password: 'secret1' });

    await component.onSubmit();

    expect(component.errorMessage()).toBe(
      'Account created, but the customer profile could not be saved: database unavailable'
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.loading()).toBe(false);
  });

  it('uses a fallback message when a customer-profile failure has no message', async () => {
    vi.spyOn(customer, 'addCustomer').mockRejectedValue({});
    component.isSignUp.set(true);
    component.authForm.patchValue({ email: 'new@example.com', password: 'secret1' });

    await component.onSubmit();

    expect(component.errorMessage()).toBe(
      'Account created, but the customer profile could not be saved: Please try again.'
    );
    expect(component.loading()).toBe(false);
  });

  it('creates a customer profile after successful registration', async () => {
    component.isSignUp.set(true);
    component.authForm.patchValue({
      email: 'new@example.com',
      password: 'secret1',
      fullName: 'New Client',
      phone: '5550100'
    });

    await component.onSubmit();

    expect(signUp).toHaveBeenCalledWith('new@example.com', 'secret1', 'New Client');
    expect(customer.addCustomer).toHaveBeenCalledWith(expect.objectContaining({
      name: 'New Client',
      email: 'new@example.com',
      phone: '5550100'
    }));
    expect(toast.success).toHaveBeenCalledWith('Account and customer profile created.');
    expect(router.navigate).toHaveBeenCalledWith(['/customers']);
  });

  it('shows a rejected demo login message', () => {
    component.onDemoLogin();

    expect(component.errorMessage()).toBe('Demo access is available only on localhost.');
  });

  it('navigates immediately after a successful demo login', () => {
    loginAsDemo.mockReturnValue(true);

    component.onDemoLogin();

    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(component.errorMessage()).toBeNull();
  });

  it('starts demo access from the rendered instant-login control', () => {
    loginAsDemo.mockReturnValue(true);
    const demoButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>
    ).find(button => button.textContent?.includes('Instant Login'));

    demoButton?.click();

    expect(loginAsDemo).toHaveBeenCalledOnce();
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('keeps the config panel open when credential saving fails', () => {
    component.configUrl = 'https://example.supabase.co';
    component.configKey = 'publishable-key';

    component.saveConfig();

    expect(component.errorMessage()).toBe('Invalid credentials');
    expect(component.showConfig()).toBe(false);
  });

  it('saves valid cloud credentials, reports success, and resets the notice later', async () => {
    saveCredentials.mockReturnValue({ success: true });
    component.configUrl = 'https://example.supabase.co';
    component.configKey = 'publishable-key';
    component.showConfig.set(true);
    vi.useFakeTimers();

    component.saveConfig();

    expect(saveCredentials).toHaveBeenCalledWith('https://example.supabase.co', 'publishable-key');
    expect(component.successMessage()).toBe('Supabase credentials saved successfully!');
    expect(component.showConfig()).toBe(false);
    expect(toast.success).toHaveBeenCalledWith('Supabase credentials saved.');
    await vi.advanceTimersByTimeAsync(3000);
    expect(component.successMessage()).toBeNull();
    vi.useRealTimers();
  });

  it('uses the generic credential-save error when the service omits a message', () => {
    saveCredentials.mockReturnValue({ success: false });

    component.saveConfig();

    expect(component.errorMessage()).toBe('Failed to save credentials.');
  });

  it('shows and hides the optional credentials editor', () => {
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('input[placeholder="https://xyz.supabase.co"]')).toBeNull();

    const configToggle = Array.from(root.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Cloud Sync:'));
    configToggle?.click();
    fixture.detectChanges();
    expect(component.showConfig()).toBe(true);
    expect(root.querySelector('input[placeholder="https://xyz.supabase.co"]')).not.toBeNull();

    configToggle?.click();
    fixture.detectChanges();
    expect(component.showConfig()).toBe(false);
    expect(root.querySelector('input[placeholder="https://xyz.supabase.co"]')).toBeNull();
  });

  it('saves credentials from the rendered config panel', () => {
    component.configUrl = 'https://tenant.supabase.co';
    component.configKey = 'valid-publishable-key';
    const root: HTMLElement = fixture.nativeElement;
    Array.from(root.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Cloud Sync:'))?.click();
    fixture.detectChanges();
    Array.from(root.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Save & Apply Credentials'))?.click();

    expect(saveCredentials).toHaveBeenCalledWith('https://tenant.supabase.co', 'valid-publishable-key');
    expect(component.errorMessage()).toBe('Invalid credentials');
  });
});
