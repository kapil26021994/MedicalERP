import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpensesComponent } from './expenses.component';
import { Expense } from '../../models/expense.model';
import { ExpenseService } from '../../services/expense.service';
import { TranslationService } from '../../services/translation.service';
import { ConfirmationService } from '../../services/confirmation.service';
import { ToastService } from '../../services/toast.service';

describe('ExpensesComponent', () => {
  let component: ExpensesComponent;
  let expenses: ReturnType<typeof signal<Expense[]>>;
  let fetchExpensesFromApi: ReturnType<typeof vi.fn>;
  let expenseService: Record<string, any> & { expenses: typeof expenses };
  let confirmationService: { confirm: ReturnType<typeof vi.fn> };
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  afterEach(() => TestBed.resetTestingModule());

  beforeEach(async () => {
    expenses = signal([
      { id: 'e1', date: new Date('2024-01-01'), category: 'Rent', description: 'Shop rent', amount: 500 },
      { id: 'e2', date: new Date('2024-02-01'), category: 'Utilities', description: 'Power bill', amount: 100 },
      { id: 'e3', date: new Date('2024-03-01'), category: 'Rent', description: 'Storage rent', amount: 250 }
    ]);
    fetchExpensesFromApi = vi.fn();
    expenseService = {
      expenses, fetchExpensesFromApi,
      addExpense: vi.fn().mockResolvedValue(undefined),
      updateExpense: vi.fn().mockResolvedValue(undefined),
      deleteExpense: vi.fn().mockResolvedValue(undefined),
      deleteAllExpenses: vi.fn().mockResolvedValue(undefined)
    };
    confirmationService = { confirm: vi.fn().mockResolvedValue(true) };
    toastService = { success: vi.fn(), error: vi.fn() };
    TestBed.overrideComponent(ExpensesComponent, { set: { template: '' } });
    TestBed.configureTestingModule({
      imports: [ExpensesComponent],
      providers: [
        { provide: ExpenseService, useValue: expenseService },
        { provide: TranslationService, useValue: {} },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: ToastService, useValue: toastService }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });
    await TestBed.compileComponents();
    component = TestBed.createComponent(ExpensesComponent).componentInstance;
  });

  it('filters expenses and sorts by amount with page boundaries', () => {
    component.onFilterCategory('Rent');
    component.toggleSort('amount');
    expect(component.filteredExpenses().map(expense => expense.amount)).toEqual([500, 250]);
    component.onSearch({ target: { value: 'storage' } } as unknown as Event);
    expect(component.paginatedExpenses().map(expense => expense.id)).toEqual(['e3']);
    expect(component.startItemIndex()).toBe(1);
    expect(component.endItemIndex()).toBe(1);
  });

  it('resets the add form and validates pagination navigation', () => {
    component.openAddModal();
    expect(component.showModal()).toBe(true);
    expect(component.editingExpense()).toBeNull();
    expect(component.expenseForm.controls.category.value).toBe('Other');
    expect(component.dynamicCategories()).toEqual(['Marketing', 'Other', 'Rent', 'Salaries', 'Supplies', 'Utilities']);

    component.pageSize.set(1);
    component.goToPage(2);
    expect(component.currentPage()).toBe(2);
    component.goToPage(2);
    expect(component.currentPage()).toBe(2);
    component.goToPage(0);
    expect(component.currentPage()).toBe(2);
    component.onPageSizeChange(10);
    expect(component.currentPage()).toBe(1);
    expect(component.totalPages()).toBe(1);
    expect(component.startItemIndex()).toBe(1);
    expect(component.endItemIndex()).toBe(3);
    expect(component.getSortIcon('date')).toBe('arrow_downward');
    expect(component.getSortIcon('amount')).toBe('unfold_more');
    component.toggleSort('date');
    expect(component.getSortIcon('date')).toBe('arrow_upward');
    component.toggleSort('category');
    expect(component.sortDirection()).toBe('asc');
    expect(component.filteredExpenses().map(expense => expense.category)).toEqual(['Rent', 'Rent', 'Utilities']);
    component.toggleSort('desc');
    expect(component.sortBy()).toBe('desc');
    expect(component.sortDirection()).toBe('asc');
    component.toggleSort('desc');
    expect(component.sortDirection()).toBe('desc');
  });

  it('requests expense data on initialization', () => {
    component.ngOnInit();
    expect(fetchExpensesFromApi).toHaveBeenCalledOnce();
  });

  it('loads edit values safely and supports closing the modal', () => {
    const malformed: Expense = {
      id: 'bad-date', date: new Date('invalid'), category: 'Supplies', description: 'Gloves', amount: 15
    };
    component.openEditModal(malformed);
    expect(component.editingExpense()).toBe(malformed);
    expect(component.expenseForm.getRawValue()).toMatchObject({
      id: 'bad-date', category: 'Supplies', description: 'Gloves', amount: 15
    });
    expect(component.expenseForm.controls.date.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    component.modalError.set('old');
    component.closeModal();
    expect(component.showModal()).toBe(false);
    expect(component.modalError()).toBeNull();
  });

  it('adds and updates valid expenses and exposes the form error branch', async () => {
    component.openAddModal();
    await component.saveExpense();
    expect(component.expenseForm.controls.description.touched).toBe(true);
    expect(expenseService.addExpense).not.toHaveBeenCalled();

    component.expenseForm.setValue({
      id: '', date: '2024-04-01', category: 'Rent', description: 'New rent', amount: 200
    });
    await component.saveExpense();
    expect(expenseService.addExpense).toHaveBeenCalledWith({
      date: new Date('2024-04-01'), category: 'Rent', description: 'New rent', amount: 200
    });
    expect(toastService.success).toHaveBeenCalledWith('Expense added.');
    expect(component.showModal()).toBe(false);

    const original: Expense = { id: 'e1', date: new Date('2024-01-01'), category: 'Rent', description: 'Old', amount: 100 };
    component.openEditModal(original);
    component.expenseForm.patchValue({ description: 'Updated rent', amount: 300 });
    await component.saveExpense();
    expect(expenseService.updateExpense).toHaveBeenCalledWith(expect.objectContaining({
      id: 'e1', description: 'Updated rent', amount: 300
    }));
    expect(toastService.success).toHaveBeenCalledWith('Expense updated.');

    expenseService.addExpense.mockRejectedValueOnce(new Error('storage unavailable'));
    component.openAddModal();
    component.expenseForm.setValue({
      id: '', date: 'invalid-date', category: 'Other', description: 'Other', amount: 1
    });
    await component.saveExpense();
    expect(component.modalError()).toBe('storage unavailable');
    expect(component.showModal()).toBe(true);
  });

  it('processes selected and all deletions only after confirmation', async () => {
    expect(component.isAllSelected()).toBe(false);
    component.toggleSelectAll();
    expect(component.isAllSelected()).toBe(true);
    component.toggleSelection('e1');
    expect(component.isAllSelected()).toBe(false);
    component.toggleSelection('e1');
    component.toggleSelectAll();
    expect(component.selectedIds().size).toBe(0);

    component.selectedIds.set(new Set(['e1', 'e2']));
    confirmationService.confirm.mockResolvedValueOnce(false);
    await component.deleteSelected();
    expect(expenseService.deleteExpense).not.toHaveBeenCalled();
    await component.deleteSelected();
    expect(expenseService.deleteExpense).toHaveBeenCalledWith('e1');
    expect(expenseService.deleteExpense).toHaveBeenCalledWith('e2');
    expect(component.selectedIds().size).toBe(0);
    expect(toastService.success).toHaveBeenCalledWith('2 expenses deleted.');

    confirmationService.confirm.mockResolvedValueOnce(false);
    await component.deleteAll();
    expect(expenseService.deleteAllExpenses).not.toHaveBeenCalled();
    await component.deleteAll();
    expect(expenseService.deleteAllExpenses).toHaveBeenCalledOnce();
    expect(toastService.success).toHaveBeenCalledWith('All expenses deleted.');
  });

  it('deletes a single expense after confirmation and leaves it intact when cancelled', async () => {
    confirmationService.confirm.mockResolvedValueOnce(false);
    await component.deleteExpense(expenses()[0]);
    expect(expenseService.deleteExpense).not.toHaveBeenCalled();
    await component.deleteExpense(expenses()[0]);
    expect(expenseService.deleteExpense).toHaveBeenCalledWith('e1');
    expect(toastService.success).toHaveBeenCalledWith('Expense deleted.');
  });
});
