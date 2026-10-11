import { HttpInterceptorFn, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { routes } from '../../app.routes';
import { environment } from '../../../environments/environment';
import { ENROLLMENT_PORTAL_OPTIONS_LOADER } from '../enrollment-applications/enrollment-application-api.service';
import { PortalOptions, portalConfigurationUnavailable } from '../enrollment-applications/enrollment-application.models';
import { enrollmentApplicationUnsavedChangesGuard } from '../enrollment-applications/enrollment-application-unsaved.guard';
import { enrollmentPortalOptionsProvider } from './student-portal-options.service';
import { studentPortalUnsavedChangesGuard } from './student-portal-unsaved.guard';

const configured: PortalOptions = {
  schoolYears: [{ id: 17, name: 'Server test year' }], gradeLevels: [{ id: 28, name: 'Server test grade' }],
  declarationText: 'Isolated test declaration only', declarationVersion: 'test-v3', privacyNotice: 'Isolated test privacy notice only',
  acceptedFileTypes: ['application/pdf', '.png'], maxUploadBytes: 3145728,
};
describe('Student portal public options production wiring', () => {
  let http: HttpTestingController;
  const interceptor = vi.fn<HttpInterceptorFn>((request, next) => next(request.clone({ setHeaders: { Authorization: 'Bearer staff-test-token' } })));
  beforeEach(() => {
    interceptor.mockClear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([interceptor])), provideHttpClientTesting(), enrollmentPortalOptionsProvider] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('loads real public options through the production provider without either identity header', () => {
    const loader = TestBed.inject(ENROLLMENT_PORTAL_OPTIONS_LOADER);
    const received = vi.fn(); loader().subscribe(received);
    const request = http.expectOne(`${environment.apiBaseUrl}/student-portal/options`);
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.has('Authorization')).toBe(false);
    expect(request.request.headers.has('X-Portal-Session')).toBe(false);
    expect(request.request.params.keys()).toEqual([]);
    request.flush(configured);
    expect(received).toHaveBeenCalledWith(configured);
    expect(interceptor).not.toHaveBeenCalled();
    expect(portalConfigurationUnavailable(configured)).toBe('');
  });
  it('preserves empty school legal configuration instead of fabricating defaults', () => {
    const received = vi.fn();
    TestBed.inject(ENROLLMENT_PORTAL_OPTIONS_LOADER)().subscribe(received);
    const unavailable = { ...configured, declarationText: '', privacyNotice: '' };
    http.expectOne(`${environment.apiBaseUrl}/student-portal/options`).flush(unavailable);
    expect(received).toHaveBeenCalledWith(unavailable);
    expect(portalConfigurationUnavailable(unavailable)).toContain('not configured');
  });
  it('surfaces unavailable options API errors without a local policy fallback', () => {
    const success = vi.fn(); const error = vi.fn();
    TestBed.inject(ENROLLMENT_PORTAL_OPTIONS_LOADER)().subscribe({ next: success, error });
    http.expectOne(`${environment.apiBaseUrl}/student-portal/options`).flush({ title: 'Unavailable' }, { status: 503, statusText: 'Unavailable' });
    expect(success).not.toHaveBeenCalled(); expect(error).toHaveBeenCalled();
  });
  it('attaches the loader and unsaved guards to exactly the two integrated routes', () => {
    const portal = routes.find(route => route.path === 'student-portal')!;
    const staff = routes.find(route => route.path === '')!.children!.find(route => route.path === 'enrollment-applications')!;
    expect(portal.providers).toContain(enrollmentPortalOptionsProvider);
    expect(staff.providers).toContain(enrollmentPortalOptionsProvider);
    expect(portal.canDeactivate).toContain(studentPortalUnsavedChangesGuard);
    expect(staff.canDeactivate).toContain(enrollmentApplicationUnsavedChangesGuard);
    expect(staff.data?.['permission']).toBe('enrollment.read');
    expect(portal.canActivate).toBeUndefined();
  });
});
