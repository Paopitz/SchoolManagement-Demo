import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CurrentUser, LoginRequest, TokenResponse } from '../models/auth.models';

const STORAGE_KEY = 'sms_demo_session';

interface StoredSession {
  accessToken: string;
  accessTokenExpiresAtUtc: string;
  refreshToken: string;
  refreshTokenExpiresAtUtc: string;
  user: CurrentUser;
}

/**
 * Stores the fictional demo session separately from the production application's session.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly session = signal<StoredSession | null>(this.readStoredSession());

  readonly currentUser = computed(() => this.session()?.user ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);

  constructor(private readonly http: HttpClient) {}

  login(request: LoginRequest): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(`${environment.apiBaseUrl}/auth/login`, request)
      .pipe(tap((response) => this.storeSession(response)));
  }

  refresh(): Observable<TokenResponse> {
    const refreshToken = this.session()?.refreshToken;
    return this.http
      .post<TokenResponse>(`${environment.apiBaseUrl}/auth/refresh`, { refreshToken })
      .pipe(tap((response) => this.storeSession(response)));
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${environment.apiBaseUrl}/auth/logout`, {}).pipe(tap(() => this.clearSession()));
  }

  /** Clears local session state without calling the API (used when the server already rejected the session). */
  clearSession(): void {
    this.session.set(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }

  getAccessToken(): string | null {
    return this.session()?.accessToken ?? null;
  }

  getRefreshToken(): string | null {
    return this.session()?.refreshToken ?? null;
  }

  hasAnyRole(roles: readonly string[]): boolean {
    if (roles.length === 0) {
      return true;
    }
    const userRoles = this.currentUser()?.roles ?? [];
    return roles.some((role) => userRoles.some((userRole) => userRole.toLowerCase() === role.toLowerCase()));
  }

  private storeSession(response: TokenResponse): void {
    const stored: StoredSession = {
      accessToken: response.accessToken,
      accessTokenExpiresAtUtc: response.accessTokenExpiresAtUtc,
      refreshToken: response.refreshToken,
      refreshTokenExpiresAtUtc: response.refreshTokenExpiresAtUtc,
      user: { userId: response.userId, username: response.username, roles: response.roles },
    };
    this.session.set(stored);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }

  private readStoredSession(): StoredSession | null {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as StoredSession;
    } catch {
      return null;
    }
  }
}
