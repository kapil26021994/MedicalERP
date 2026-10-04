import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { HEADER_TABS, SettingsService } from '../services/settings.service';

export const featureVisibilityGuard: CanActivateFn = (_route, state) => {
  const settingsService = inject(SettingsService);
  const router = inject(Router);
  const path = state.url.split(/[?#]/, 1)[0];
  const feature = HEADER_TABS.find(tab =>
    path === `/${tab.id}` || path.startsWith(`/${tab.id}/`)
  );

  if (!feature || settingsService.headerTabVisibility()[feature.id]) return true;

  const fallback = HEADER_TABS.find(tab => settingsService.headerTabVisibility()[tab.id]);
  return router.createUrlTree([fallback ? `/${fallback.id}` : '/settings']);
};
