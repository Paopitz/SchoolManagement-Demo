import { HttpInterceptorFn, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { StudentPortalApiService } from './student-portal-api.service';
import { emptyProfile } from '../enrollment-applications/enrollment-application.models';

describe('StudentPortalApiService isolated identity', () => {
  let api: StudentPortalApiService;
  let http: HttpTestingController;
  const staffInterceptor = vi.fn<HttpInterceptorFn>((req, next) => next(req.clone({ setHeaders: { Authorization: 'Bearer staff-test-token' } })));
  const base = `${environment.apiBaseUrl}/student-portal`;
  beforeEach(() => {
    staffInterceptor.mockClear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([staffInterceptor])), provideHttpClientTesting()] });
    api = TestBed.inject(StudentPortalApiService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function signIn(): void {
    api.verifyCode('family@example.test', '12345678').subscribe();
    http.expectOne(`${base}/email/verify`).flush({ sessionToken: 'opaque-test-session', expiresAtUtc: '2030-01-01T00:00:00Z' });
  }
  it('never invokes staff JWT interceptors for email OTP or scoped requests', () => {
    signIn(); api.me().subscribe();
    const req = http.expectOne(`${base}/me`);
    expect(req.request.headers.get('X-Portal-Session')).toBe('opaque-test-session');
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(staffInterceptor).not.toHaveBeenCalled();
    req.flush({ email: 'family@example.test', studentId: null, mobileVerified: false });
  });
  it('does not establish a session after a rejected code', () => {
    api.verifyCode('family@example.test', '11111111').subscribe({ error: () => {} });
    http.expectOne(`${base}/email/verify`).flush({ title: 'Invalid code' }, { status: 400, statusText: 'Bad Request' });
    expect(api.authenticated()).toBe(false);
  });
  it('clears the in-memory session on logout and does not put identifiers in grade URLs', () => {
    signIn(); api.logout().subscribe(); http.expectOne(`${base}/session`).flush(null);
    expect(api.authenticated()).toBe(false);
    api.grades().subscribe();
    const req = http.expectOne(`${base}/grades`);
    expect(req.request.headers.has('X-Portal-Session')).toBe(false);
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ title: 'Summary', student: null, grades: [], generatedAtUtc: '2030-01-01' });
  });
  it('uploads the accepted birth-document kind privately with multipart file, not a public URL', () => {
    signIn(); api.upload('application-uuid', 'LiveBirth', new File(['test'], 'birth.pdf', { type: 'application/pdf' })).subscribe({ error: () => {} });
    const req = http.expectOne(`${base}/applications/application-uuid/documents/BirthCertificate`);
    expect(req.request.body instanceof FormData).toBe(true);
    expect(req.request.body.get('file').name).toBe('birth.pdf');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ title: 'File rejected' }, { status: 400, statusText: 'Bad Request' });
  });
  it('maps profile mutations to the precise contract, preserving leading zeroes and excluding health', () => {
    signIn(); const profile = emptyProfile(); profile.lrn = '001234567890'; profile.lrnStatus = 'Provided'; profile.email = 'family@example.test'; profile.requestedSchoolYearId = 9; profile.requestedGradeLevelId = 6;
    profile.health = { bloodType: 'Unknown', heightCm: 150, weightKg: 45, weighingDate: '2026-10-10', history: 'Private' };
    api.create(profile).subscribe({ error: () => {} });
    const req = http.expectOne(`${base}/applications`);
    expect(req.request.body.schoolYearId).toBe(9);
    expect(req.request.body.profile.lrn).toBe('001234567890');
    expect(req.request.body.profile.health).toBeUndefined();
    expect(req.request.body.profile.age).toBeUndefined();
    req.flush({ title: 'Validation' }, { status: 400, statusText: 'Bad Request' });
  });
});
