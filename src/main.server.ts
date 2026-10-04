import { bootstrapApplication, BootstrapContext } from '@angular/platform-browser';
import { provideZonelessChangeDetection, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { AppComponent } from './app.component';
import { APP_ROUTES } from './app.routes';
import { serverRoutes } from './app.routes.server';
import { authInterceptor } from './interceptors/auth.interceptor';

const bootstrap = (context: BootstrapContext) => bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(APP_ROUTES),
    provideServerRendering(withRoutes(serverRoutes)),
    provideHttpClient(withInterceptors([authInterceptor])),
    importProvidersFrom(ReactiveFormsModule)
  ],
}, context);

export default bootstrap;
