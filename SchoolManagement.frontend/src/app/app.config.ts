import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { HttpBackend, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withHashLocation } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { DemoBackend } from './core/demo/demo-backend';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withHashLocation()),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: HttpBackend, useClass: DemoBackend },
  ]
};
