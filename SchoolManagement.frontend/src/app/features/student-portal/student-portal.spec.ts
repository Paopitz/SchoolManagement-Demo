import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ENROLLMENT_PORTAL_OPTIONS_LOADER } from '../enrollment-applications/enrollment-application-api.service';
import { ApplicationDetail, StudentProfile, emptyProfile } from '../enrollment-applications/enrollment-application.models';
import { StudentPortalApiService } from './student-portal-api.service';
import { StudentPortalPage } from './student-portal';

describe('StudentPortalPage submission and privacy states', () => {
  const app: ApplicationDetail = { id: 'uuid', reference: 'uuid', studentName: 'Test Applicant', status: 'PendingReview', source: 'Online', reasons: [], version: 1, enrollmentId: null, profile: emptyProfile(), documents: [], externalGrades: [], academicReview: null, history: [] };
  const api = {
    authenticated: signal(true), email: signal('family@example.test'), expiresAt: signal('2030-01-01'),
    applications: vi.fn(() => of([])), enrollments: vi.fn(() => of([])), clearSession: vi.fn(),
    create: vi.fn((_profile: StudentProfile) => of(app)), update: vi.fn(() => of(app)), saveHealth: vi.fn(() => of(undefined)),
    grades: vi.fn(() => of({ title: 'Student grade summary', studentName: 'Test Applicant', lrn: '001234567890', generatedAt: '2030-01-01', grades: [] })),
  };
  beforeEach(async () => {
    vi.clearAllMocks(); api.authenticated.set(true);
    api.saveHealth.mockImplementation(() => of(undefined));
    api.create.mockImplementation(() => of(app));
    await TestBed.configureTestingModule({
      imports: [StudentPortalPage], providers: [
        { provide: StudentPortalApiService, useValue: api },
        { provide: ENROLLMENT_PORTAL_OPTIONS_LOADER, useValue: () => of({ schoolYears: [{ id: 9, name: 'Configured test year' }], gradeLevels: [{ id: 3, name: 'Configured test grade' }], declarationVersion: 'approved-test', declarationText: 'Isolated test declaration', privacyNotice: 'Isolated test privacy notice', acceptedFileTypes: ['application/pdf'], maxUploadBytes: 1024 }) },
      ],
    }).compileComponents();
  });
  it('shows submission only after server receipt and never implies official enrollment', () => {
    const fixture = TestBed.createComponent(StudentPortalPage); const c = fixture.componentInstance; fixture.detectChanges();
    c.saveProfile(emptyProfile());
    expect(c.selected()?.id).toBe('uuid');
    expect(c.notice()).toContain('not official enrollment');
    expect(api.create.mock.calls[0][0].email).toBe('family@example.test');
  });
  it('logs in by email only and does not infer Returning from linked identity', () => {
    api.authenticated.set(false);
    const fixture = TestBed.createComponent(StudentPortalPage); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[name=returningLrn]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[name=portalEmail]')).not.toBeNull();
    const c = fixture.componentInstance; c.linked.set(true); c.startNew();
    expect(c.profile.applicationType).toBe('New'); expect(c.profile.lrnStatus).toBe('NotAssigned');
    expect(c.profile.lrn).toBe('');
  });
  it('keeps the profile and errors visible on submission validation failure', () => {
    api.create.mockImplementation(() => throwError(() => new HttpErrorResponse({ status: 400, error: { errors: { Lrn: ['Check LRN.'] } } })));
    const c = TestBed.createComponent(StudentPortalPage).componentInstance;
    c.profile.firstName = 'Entered name'; c.editing.set(true); c.dirty = true;
    c.saveProfile(c.profile);
    expect(c.error()).toContain('Check LRN'); expect(c.profile.firstName).toBe('Entered name');
    expect(c.dirty).toBe(true); expect(c.notice()).toBe('');
  });
  it('does not create duplicate applications when a separately saved health request fails', () => {
    api.saveHealth.mockImplementation(() => throwError(() => new HttpErrorResponse({ status: 503 })));
    const c = TestBed.createComponent(StudentPortalPage).componentInstance; c.editing.set(true); c.dirty = true;
    c.profile.health = { bloodType: 'Unknown', heightCm: null, weightKg: null, weighingDate: '', history: 'Entered condition' };
    c.saveProfile(c.profile);
    expect(c.selected()?.id).toBe('uuid'); expect(c.editing()).toBe(true); expect(c.dirty).toBe(true);
    expect(c.error()).toContain('health information could not be saved');
    c.saveProfile(c.profile);
    expect(api.create).toHaveBeenCalledTimes(1); expect(api.update).toHaveBeenCalledTimes(1);
  });
  it('renders own-finalized-only printable output without internal review notes', () => {
    const fixture = TestBed.createComponent(StudentPortalPage); fixture.detectChanges();
    fixture.componentInstance.loadGrades(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.print-summary').textContent).toContain('not an official report card');
    expect(fixture.nativeElement.querySelector('.print-summary').textContent).toContain('No own finalized grades');
    expect(fixture.nativeElement.querySelector('.print-summary').textContent).not.toContain('Internal');
  });
  it('blocks creation with unconfigured school legal text without blocking own grades', () => {
    const fixture = TestBed.createComponent(StudentPortalPage); fixture.detectChanges();
    const c = fixture.componentInstance;
    c.options.set({ ...c.options()!, declarationText: '', privacyNotice: '' });
    c.startNew(); fixture.detectChanges();
    expect(c.editing()).toBe(false); expect(c.error()).toContain('not configured');
    const newButton = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(b => b.textContent === 'New application')!;
    expect(newButton.disabled).toBe(true);
    c.loadGrades(); expect(api.grades).toHaveBeenCalled();
  });
});
