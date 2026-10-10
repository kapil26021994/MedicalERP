import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { featureVisibilityGuard } from './guards/feature-visibility.guard';

export const APP_ROUTES: Routes = [
  { 
    path: 'login', 
    loadComponent: () => import('./components/auth/auth.component').then(c => c.AuthComponent),
    title: 'Sign In - AdvikaERP'
  },
  { 
    path: 'landing', 
    loadComponent: () => import('./components/landing/landing.component').then(c => c.LandingComponent),
    title: 'Welcome to AdvikaERP'
  },
  { 
    path: 'dashboard', 
    loadComponent: () => import('./components/dashboard/dashboard.component').then(c => c.DashboardComponent),
    canActivate: [authGuard, featureVisibilityGuard],
    title: 'Dashboard'
  },
  { 
    path: 'pos', 
    loadComponent: () => import('./components/pos/pos.component').then(c => c.PosComponent),
    canActivate: [authGuard, featureVisibilityGuard],
    title: 'POS Terminal'
  },
  { 
    path: 'sales', 
    loadComponent: () => import('./components/sales/sales.component').then(c => c.SalesComponent),
    canActivate: [authGuard, featureVisibilityGuard],
    title: 'Sales Register & Analytics'
  },
  { 
    path: 'inventory', 
    loadComponent: () => import('./components/item-master/item-master.component').then(c => c.ItemMasterComponent),
    canActivate: [authGuard, featureVisibilityGuard],
    title: 'Item Master'
  },
  { 
    path: 'purchases', 
    loadComponent: () => import('./components/purchases/purchases.component').then(c => c.PurchasesComponent),
    canActivate: [authGuard, featureVisibilityGuard],
    title: 'Purchases'
  },
  { 
    path: 'challan', 
    loadComponent: () => import('./components/challans/challans.component').then(c => c.ChallansComponent),
    canActivate: [authGuard, featureVisibilityGuard],
    title: 'Challan'
  },
  { 
    path: 'expenses', 
    loadComponent: () => import('./components/expenses/expenses.component').then(c => c.ExpensesComponent),
    canActivate: [authGuard, featureVisibilityGuard],
    title: 'Expenses'
  },
  { 
    path: 'invoices', 
    loadComponent: () => import('./components/invoices/invoices.component').then(c => c.InvoicesComponent),
    canActivate: [authGuard, featureVisibilityGuard],
    title: 'Invoices'
  },
  {
    path: 'invoices/new',
    loadComponent: () => import('./components/invoices/invoice-form.component').then(c => c.InvoiceFormComponent),
    canActivate: [authGuard, featureVisibilityGuard],
    title: 'Create Invoice'
  },
  {
    path: 'invoices/edit/:id',
    loadComponent: () => import('./components/invoices/invoice-form.component').then(c => c.InvoiceFormComponent),
    canActivate: [authGuard, featureVisibilityGuard],
    title: 'Edit Invoice'
  },
  { 
    path: 'customers', 
    loadComponent: () => import('./components/customers/customers.component').then(c => c.CustomersComponent),
    canActivate: [authGuard, featureVisibilityGuard],
    title: 'Customer Management'
  },
  { 
    path: 'customers/:id', 
    loadComponent: () => import('./components/customers/customer-detail.component').then(c => c.CustomerDetailComponent),
    canActivate: [authGuard, featureVisibilityGuard],
    title: 'Customer Profile'
  },
  { 
    path: 'reports', 
    loadComponent: () => import('./components/reports/reports.component').then(c => c.ReportsComponent),
    canActivate: [authGuard],
    title: 'Sales Reports'
  },
  { 
    path: 'settings', 
    loadComponent: () => import('./components/settings/settings.component').then(c => c.SettingsComponent),
    canActivate: [authGuard],
    title: 'Settings'
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' } 
];
