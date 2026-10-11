import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsComponent } from './settings.component';
import { SettingsService, HeaderTabVisibility } from '../../services/settings.service';
import { SupabaseService } from '../../services/supabase.service';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let settingsService: {
    businessProfile: ReturnType<typeof vi.fn>;
    headerTabVisibility: ReturnType<typeof signal<HeaderTabVisibility>>;
    saveHeaderTabVisibility: ReturnType<typeof vi.fn>;
    updateProfile: ReturnType<typeof vi.fn>;
    exportData: ReturnType<typeof vi.fn>;
    importData: ReturnType<typeof vi.fn>;
    resetDatabase: ReturnType<typeof vi.fn>;
  };
  let translationService: { currentLang: ReturnType<typeof vi.fn>; setLanguage: ReturnType<typeof vi.fn> };
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let supabaseService: {
    url: ReturnType<typeof signal<string>>;
    anonKey: ReturnType<typeof signal<string>>;
    saveCredentials: ReturnType<typeof vi.fn>;
    clearCredentials: ReturnType<typeof vi.fn>;
  };

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  beforeEach(async () => {
    const visibility: HeaderTabVisibility = {
      dashboard: true, sales: true, invoices: true, inventory: true,
      purchases: true, challan: true, expenses: true, customers: true
    };
    settingsService = {
      businessProfile: vi.fn(() => ({ shopName: 'Clinic', shopAddress: '1 Main St', shopPhone: '123' })),
      headerTabVisibility: signal(visibility),
      saveHeaderTabVisibility: vi.fn(),
      updateProfile: vi.fn(),
      exportData: vi.fn(),
      importData: vi.fn().mockResolvedValue(undefined),
      resetDatabase: vi.fn().mockResolvedValue({ success: true, message: 'Database reset.' })
    };
    translationService = { currentLang: vi.fn(() => 'en'), setLanguage: vi.fn() };
    toastService = { success: vi.fn(), error: vi.fn() };
    supabaseService = {
      url: signal(''), anonKey: signal(''), saveCredentials: vi.fn().mockReturnValue({ success: true }),
      clearCredentials: vi.fn()
    };
    TestBed.overrideComponent(SettingsComponent, { set: { template: '' } });
    TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        { provide: SettingsService, useValue: settingsService },
        { provide: SupabaseService, useValue: supabaseService },
        { provide: TranslationService, useValue: translationService },
        { provide: ToastService, useValue: toastService }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });
    await TestBed.compileComponents();
    component = TestBed.createComponent(SettingsComponent).componentInstance;
    component.ngOnInit();
  });

  it('loads profile and language, then saves valid business settings', () => {
    expect(component.settingsForm.getRawValue()).toMatchObject({ shopName: 'Clinic', shopAddress: '1 Main St', shopPhone: '123' });
    component.settingsForm.setValue({ shopName: 'New Clinic', shopAddress: '2 Oak St', shopPhone: '456' });
    component.selectLanguageOption('hi');

    component.saveSettings();

    expect(settingsService.updateProfile).toHaveBeenCalledWith({
      shopName: 'New Clinic', shopAddress: '2 Oak St', shopPhone: '456'
    });
    expect(translationService.setLanguage).toHaveBeenCalledWith('hi');
    expect(toastService.success).toHaveBeenCalledWith('Settings saved successfully.');
  });

  it('does not save an invalid required profile', () => {
    component.settingsForm.setValue({ shopName: '', shopAddress: '', shopPhone: '' });

    component.saveSettings();

    expect(settingsService.updateProfile).not.toHaveBeenCalled();
    expect(toastService.success).not.toHaveBeenCalled();
  });

  it('tracks tab visibility drafts and persists changes with profile settings', () => {
    component.setHeaderTabVisibility('customers', { target: { checked: false } } as unknown as Event);
    expect(component.headerTabDraft().customers).toBe(false);
    expect(component.hasUnsavedHeaderTabChanges()).toBe(true);

    component.settingsForm.setValue({ shopName: 'Clinic', shopAddress: '1 Main St', shopPhone: '123' });
    component.saveSettings();
    expect(settingsService.saveHeaderTabVisibility).toHaveBeenCalledWith(
      expect.objectContaining({ customers: false })
    );
    expect(component.hasUnsavedHeaderTabChanges()).toBe(false);

    component.setHeaderTabVisibility('customers', { target: { checked: true } } as unknown as Event);
    expect(component.hasUnsavedHeaderTabChanges()).toBe(false);
  });

  it('saves or rejects Supabase credentials and clears the saved configuration', () => {
    component.supabaseForm.setValue({ url: '', anonKey: '' });
    component.saveSupabaseConfig();
    expect(supabaseService.saveCredentials).not.toHaveBeenCalled();

    component.supabaseForm.setValue({ url: 'https://db.example.test', anonKey: 'public-key' });
    component.saveSupabaseConfig();
    expect(supabaseService.saveCredentials).toHaveBeenCalledWith('https://db.example.test', 'public-key');
    expect(component.supabaseSaveMsg()).toBe('Supabase configuration updated successfully!');

    supabaseService.saveCredentials.mockReturnValueOnce({ success: false, error: 'Invalid key' });
    component.saveSupabaseConfig();
    expect(toastService.error).toHaveBeenCalledWith('Invalid key');
    supabaseService.saveCredentials.mockReturnValueOnce({ success: false });
    component.saveSupabaseConfig();
    expect(toastService.error).toHaveBeenCalledWith('Failed to save configuration.');

    component.clearSupabaseConfig();
    expect(supabaseService.clearCredentials).toHaveBeenCalledOnce();
    expect(component.supabaseForm.getRawValue()).toEqual({ url: '', anonKey: '' });
    expect(component.supabaseSaveMsg()).toBe('Supabase credentials cleared.');
  });

  it('exports data, accepts file selection, and handles successful or failed imports', async () => {
    component.exportAppData();
    expect(settingsService.exportData).toHaveBeenCalledOnce();

    component.confirmImport();
    expect(settingsService.importData).not.toHaveBeenCalled();
    const emptyInput = { files: null, value: 'stale-value' };
    component.onFileSelected({ target: emptyInput } as unknown as Event);
    expect(emptyInput.value).toBe('');
    expect(component.importFile()).toBeNull();
    const file = new File(['backup'], 'backup.json', { type: 'application/json' });
    const input = { files: [file], value: 'backup.json' };
    component.onFileSelected({ target: input } as unknown as Event);
    expect(component.importFile()).toBe(file);
    expect(component.showImportConfirmation()).toBe(true);
    expect(input.value).toBe('');

    vi.useFakeTimers();
    component.confirmImport();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(settingsService.importData).toHaveBeenCalledWith(file);
    expect(component.showImportConfirmation()).toBe(false);
    expect(component.importFile()).toBeNull();
    expect(toastService.success).toHaveBeenCalledWith('Data imported successfully.');

    settingsService.importData.mockRejectedValueOnce(new Error('bad archive'));
    component.importFile.set(file);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    component.confirmImport();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(toastService.error).toHaveBeenCalledWith('bad archive');
    expect(component.importFile()).toBeNull();
    expect(error).toHaveBeenCalled();

    settingsService.importData.mockRejectedValueOnce('malformed file');
    component.importFile.set(file);
    component.confirmImport();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(toastService.error).toHaveBeenCalledWith('Failed to import data.');
    expect(component.showImportConfirmation()).toBe(false);
    error.mockRestore();
    vi.useRealTimers();
  });

  it('copies SQL text and resets the copied indicator after its timeout', () => {
    const writeText = vi.fn();
    const previousClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });
    vi.useFakeTimers();

    component.copySql();

    expect(writeText).toHaveBeenCalledWith(component.sqlScript);
    expect(component.sqlCopied()).toBe(true);
    vi.advanceTimersByTime(3000);
    expect(component.sqlCopied()).toBe(false);
    if (previousClipboard) {
      Object.defineProperty(navigator, 'clipboard', previousClipboard);
    } else {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
    vi.useRealTimers();
  });

  it('only resets after confirmation and reports database failures', async () => {
    const confirmMock = vi.fn().mockReturnValue(false);
    vi.stubGlobal('confirm', confirmMock);
    await component.resetAllData();
    expect(settingsService.resetDatabase).not.toHaveBeenCalled();

    confirmMock.mockReturnValue(true);
    settingsService.resetDatabase.mockResolvedValueOnce({ success: false, error: 'Offline' });
    await component.resetAllData();
    expect(toastService.error).toHaveBeenCalledWith('Offline');

    settingsService.resetDatabase.mockResolvedValueOnce({ success: true });
    vi.useFakeTimers();
    await component.resetAllData();
    expect(toastService.success).toHaveBeenCalledWith('Database reset successfully.');
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});
