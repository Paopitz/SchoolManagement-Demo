import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { TokenResponse } from '../models/auth.models';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  const tokenResponse: TokenResponse = {
    accessToken: 'access-token',
    accessTokenExpiresAtUtc: new Date().toISOString(),
    refreshToken: 'refresh-token',
    refreshTokenExpiresAtUtc: new Date().toISOString(),
    userId: 1,
    username: 'jdoe',
    roles: ['Registrar'],
  };

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
  });

  it('starts unauthenticated when there is no stored session', () => {
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
  });

  it('stores the session and exposes the current user after a successful login', () => {
    service.login({ username: 'jdoe', password: 'secret' }).subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    req.flush(tokenResponse);
    httpMock.expectOne(`${environment.apiBaseUrl}/auth/permissions`).flush(['students.read']);

    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentUser()).toEqual({ userId: 1, username: 'jdoe', roles: ['Registrar'], permissions: ['students.read'] });
    expect(service.getAccessToken()).toBe('access-token');
  });

  it('clears the session on logout', () => {
    service.login({ username: 'jdoe', password: 'secret' }).subscribe();
    httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`).flush(tokenResponse);
    httpMock.expectOne(`${environment.apiBaseUrl}/auth/permissions`).flush([]);

    service.logout().subscribe();
    httpMock.expectOne(`${environment.apiBaseUrl}/auth/logout`).flush(null);

    expect(service.isAuthenticated()).toBe(false);
  });

  it('matches roles case-insensitively and allows empty role lists', () => {
    service.login({ username: 'jdoe', password: 'secret' }).subscribe();
    httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`).flush(tokenResponse);
    httpMock.expectOne(`${environment.apiBaseUrl}/auth/permissions`).flush([]);

    expect(service.hasAnyRole([])).toBe(true);
    expect(service.hasAnyRole(['registrar'])).toBe(true);
    expect(service.hasAnyRole(['Principal'])).toBe(false);
  });
});
