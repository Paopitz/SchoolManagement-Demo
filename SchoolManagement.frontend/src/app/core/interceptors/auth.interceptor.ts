import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

const PUBLIC_PATHS = ['/auth/login', '/auth/refresh'];

/** Attaches the bearer token to API requests and retries once after a refresh on 401. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  // Student portal uses a separate scoped session and must never refresh or clear staff credentials.
  if (req.url.includes('/student-portal/')) return next(req);
  const isPublic = PUBLIC_PATHS.some((path) => req.url.includes(path));

  const accessToken = authService.getAccessToken();
  const authorizedReq = accessToken && !isPublic ? req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } }) : req;

  return next(authorizedReq).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || isPublic || !authService.getRefreshToken()) {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          authService.clearSession();
          router.navigate(['/login']);
        }
        return throwError(() => error);
      }

      return authService.refresh().pipe(
        switchMap((response) => next(req.clone({ setHeaders: { Authorization: `Bearer ${response.accessToken}` } }))),
        catchError((refreshError: unknown) => {
          authService.clearSession();
          router.navigate(['/login']);
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
