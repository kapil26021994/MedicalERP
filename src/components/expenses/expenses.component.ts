import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Expense } from '../../models/expense.model';
import { ExpenseService } from '../../services/expense.service';
import { TranslationService } from '../../services/translation.service';
import { ConfirmationService } from '../../services/confirmation.service';
import { LoaderComponent } from '../layout/loader.component';

@Component({
  selector: 'app-expenses',
  templateUrl: './expenses.component.html',
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    CurrencyPipe, 
    DatePipe,
    LoaderComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpensesComponent implements OnInit {
  private fb: FormBuilder = inject(FormBuilder);
  expenseService = inject(ExpenseService);
  public ts = inject(TranslationService);
  private confirmationService = inject(ConfirmationService);

  ngOnInit() {
    this.expenseService.fetchExpensesFromApi();
  }

  showModal = signal(false);
  showSqlModal = signal(false);
  sqlCopied = signal(false);
  editingExpense = signal<Expense | null>(null);

  sqlScript = `-- Copy & run this in your Supabase SQL Editor (https://supabase.com/dashboard) to create the 'expenses' table:

CREATE TABLE IF NOT EXISTS public.expenses (
  id VARCHAR(100) PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS) & Grant access
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on expenses" ON public.expenses;
CREATE POLICY "Allow all on expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);`;

  copySql() {
    navigator.clipboard.writeText(this.sqlScript);
    this.sqlCopied.set(true);
    setTimeout(() => this.sqlCopied.set(false), 3000);
  }
  
  categories: string[] = ['Rent', 'Salaries', 'Utilities', 'Marketing', 'Supplies', 'Other'];

  dynamicCategories = computed(() => {
    const existingCats = this.expenseService.expenses().map(e => e.category);
    return Array.from(new Set([...this.categories, ...existingCats])).filter(Boolean).sort();
  });

  searchTerm = signal('');
  selectedCategoryFilter = signal('All');
  currentPage = signal(1);
  pageSize = signal(10);
  sortBy = signal<'date' | 'category' | 'desc' | 'amount'>('date');
  sortDirection = signal<'asc' | 'desc'>('desc');

  filteredExpenses = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const cat = this.selectedCategoryFilter();
    let expenses = [...this.expenseService.expenses()];
    const sortField = this.sortBy();
    const direction = this.sortDirection();

    expenses = expenses.filter(e => {
      const matchesCat = cat === 'All' || e.category === cat;
      const matchesSearch = !term || e.description.toLowerCase().includes(term) || e.category.toLowerCase().includes(term);
      return matchesCat && matchesSearch;
    });

    expenses.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortField === 'category') {
        comparison = a.category.localeCompare(b.category);
      } else if (sortField === 'desc') {
        comparison = a.description.localeCompare(b.description);
      } else if (sortField === 'amount') {
        comparison = a.amount - b.amount;
      }
      return direction === 'asc' ? comparison : -comparison;
    });

    return expenses;
  });

  toggleSort(field: 'date' | 'category' | 'desc' | 'amount') {
    if (this.sortBy() === field) {
      this.sortDirection.update(dir => dir === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(field);
      this.sortDirection.set(field === 'date' || field === 'amount' ? 'desc' : 'asc');
    }
    this.currentPage.set(1);
  }

  getSortIcon(field: 'date' | 'category' | 'desc' | 'amount'): string {
    if (this.sortBy() !== field) {
      return 'unfold_more';
    }
    return this.sortDirection() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  paginatedExpenses = computed(() => {
    const expenses = this.filteredExpenses();
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    return expenses.slice(start, start + size);
  });

  totalPages = computed(() => {
    const total = this.filteredExpenses().length;
    return Math.max(1, Math.ceil(total / this.pageSize()));
  });

  startItemIndex = computed(() => {
    if (this.filteredExpenses().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  endItemIndex = computed(() => {
    const total = this.filteredExpenses().length;
    return Math.min(this.currentPage() * this.pageSize(), total);
  });

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  onPageSizeChange(size: number) {
    this.pageSize.set(Number(size));
    this.currentPage.set(1);
  }

  onSearch(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    this.currentPage.set(1);
  }

  onFilterCategory(cat: string) {
    this.selectedCategoryFilter.set(cat);
    this.currentPage.set(1);
  }

  expenseForm = this.fb.group({
    id: [''],
    date: [new Date().toISOString().split('T')[0], Validators.required],
    category: ['Other' as Expense['category'], Validators.required],
    description: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(0.01)]],
  });

  modalError = signal<string | null>(null);

  openAddModal() {
    this.editingExpense.set(null);
    this.modalError.set(null);
    this.expenseForm.reset({
      date: new Date().toISOString().split('T')[0],
      category: 'Other',
      description: '',
      amount: 0,
    });
    this.showModal.set(true);
  }

  openEditModal(expense: Expense) {
    this.editingExpense.set(expense);
    this.modalError.set(null);
    const safeDateObj = expense.date && !isNaN(new Date(expense.date).getTime()) ? new Date(expense.date) : new Date();
    this.expenseForm.setValue({
      id: expense.id,
      date: safeDateObj.toISOString().split('T')[0],
      category: expense.category,
      description: expense.description,
      amount: expense.amount
    });
    this.showModal.set(true);
  }
  
  closeModal() {
    this.modalError.set(null);
    this.showModal.set(false);
  }

  async deleteExpense(expense: Expense) {
    const confirmed = await this.confirmationService.confirm({
      title: 'Delete Expense',
      message: `Are you sure you want to delete this expense: "${expense.description}"?`,
      confirmText: 'Delete',
      type: 'danger'
    });

    if (confirmed) {
      await this.expenseService.deleteExpense(expense.id);
    }
  }

  selectedIds = signal<Set<string>>(new Set());

  isAllSelected = computed(() => {
    const list = this.paginatedExpenses();
    if (list.length === 0) return false;
    return list.every(e => this.selectedIds().has(e.id));
  });

  toggleSelectAll() {
    const list = this.paginatedExpenses();
    const currentSelected = new Set(this.selectedIds());
    if (this.isAllSelected()) {
      list.forEach(e => currentSelected.delete(e.id));
    } else {
      list.forEach(e => currentSelected.add(e.id));
    }
    this.selectedIds.set(currentSelected);
  }

  toggleSelection(id: string) {
    const currentSelected = new Set(this.selectedIds());
    if (currentSelected.has(id)) {
      currentSelected.delete(id);
    } else {
      currentSelected.add(id);
    }
    this.selectedIds.set(currentSelected);
  }

  async deleteSelected() {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;

    const confirmed = await this.confirmationService.confirm({
      title: 'Delete Selected',
      message: `Are you sure you want to delete ${ids.length} selected expense(s)?`,
      confirmText: 'Delete',
      type: 'danger'
    });

    if (confirmed) {
      for (const id of ids) {
        await this.expenseService.deleteExpense(id);
      }
      this.selectedIds.set(new Set());
    }
  }

  async deleteAll() {
    const confirmed = await this.confirmationService.confirm({
      title: 'Delete All Expenses',
      message: `Are you sure you want to delete ALL expenses? This action cannot be undone.`,
      confirmText: 'Delete All',
      type: 'danger'
    });

    if (confirmed) {
      await this.expenseService.deleteAllExpenses();
    }
  }

  async saveExpense() {
    if (this.expenseForm.invalid) {
      this.expenseForm.markAllAsTouched();
      return;
    }

    this.modalError.set(null);
    const formValue = this.expenseForm.getRawValue();
    
    const parsedDate = formValue.date ? new Date(formValue.date) : new Date();
    const safeDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

    const expenseData = {
      date: safeDate,
      category: formValue.category || 'Other',
      description: formValue.description || '',
      amount: Number(formValue.amount) || 0
    } as Omit<Expense, 'id'>;

    try {
      if (this.editingExpense()) {
        const updatedExpense = { ...this.editingExpense()!, ...expenseData };
        await this.expenseService.updateExpense(updatedExpense);
      } else {
        await this.expenseService.addExpense(expenseData);
      }
      this.closeModal();
    } catch (err: any) {
      this.modalError.set(err.message || 'Failed to save expense record.');
    }
  }
}