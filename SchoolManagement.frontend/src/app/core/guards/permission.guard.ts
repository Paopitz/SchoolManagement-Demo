import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const permissionGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const permission: unknown = route.data['permission'];
  if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);
  return auth.refreshPermissions().pipe(
    map(() => typeof permission !== 'string' || auth.hasPermission(permission)
      ? true : router.createUrlTree(['/access-denied'])),
    catchError(() => of(router.createUrlTree(['/access-denied'], { queryParams: { unavailable: '1' } }))),
  );
};
