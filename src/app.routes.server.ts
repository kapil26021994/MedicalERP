import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'dashboard',
    renderMode: RenderMode.Client
  },
  {
    path: 'pos',
    renderMode: RenderMode.Client
  },
  {
    path: 'sales',
    renderMode: RenderMode.Client
  },
  {
    path: 'inventory',
    renderMode: RenderMode.Client
  },
  {
    path: 'purchases',
    renderMode: RenderMode.Client
  },
  {
    path: 'challan',
    renderMode: RenderMode.Client
  },
  {
    path: 'expenses',
    renderMode: RenderMode.Client
  },
  {
    path: 'invoices',
    renderMode: RenderMode.Client
  },
  {
    path: 'invoices/new',
    renderMode: RenderMode.Client
  },
  {
    path: 'invoices/edit/:id',
    renderMode: RenderMode.Client
  },
  {
    path: 'customers',
    renderMode: RenderMode.Client
  },
  {
    path: 'customers/:id',
    renderMode: RenderMode.Client
  },
  {
    path: 'reports',
    renderMode: RenderMode.Client
  },
  {
    path: 'settings',
    renderMode: RenderMode.Client
  },
  {
    path: '**',
    renderMode: RenderMode.Server
  }
];
