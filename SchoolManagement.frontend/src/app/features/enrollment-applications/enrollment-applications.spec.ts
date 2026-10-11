import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../core/services/auth.service';
import { Phase2ApiService } from '../../core/services/phase2-api.service';
import { ENROLLMENT_PORTAL_OPTIONS_LOADER, EnrollmentApplicationApiService } from './enrollment-application-api.service';
import { ApplicationDetail, emptyProfile } from './enrollment-application.models';
import { EnrollmentApplicationsPage } from './enrollment-applications';

function application(): ApplicationDetail {
  return { id: 'uuid', reference: 'uuid', studentName: 'Test Applicant', status: 'PendingReview', source: 'Manual', reasons: ['Report card pending'], profile: { ...emptyProfile(), lrn: '001234567890', lrnStatus: 'Provided' }, documents: [], externalGrades: [], academicReview: null, history: [], version: 3, enrollmentId: null };
}
describe('EnrollmentApplicationsPage permissions and manual review', () => {
  let permissions: Set<string>;
  const api = {
    list: vi.fn(() => of([])), get: vi.fn(() => of(application())), create: vi.fn(() => of(application())),
    update: vi.fn(() => of(application())), saveHealth: vi.fn(() => of(undefined)),
    health: vi.fn(() => of(null)), academicReview: vi.fn(() => of(application())),
    approve: vi.fn(() => of(application())), linkStudent: vi.fn(() => of(undefined)),
    resolveLrn: vi.fn(() => of(application())),
  };
  beforeEach(async () => {
    vi.clearAllMocks(); permissions = new Set(['enrollment.read']);
    api.approve.mockImplementation(() => of(application()));
    api.saveHealth.mockImplementation(() => of(undefined));
    api.resolveLrn.mockImplementation(() => of(application()));
    await TestBed.configureTestingModule({
      imports: [EnrollmentApplicationsPage],
      providers: [
        { provide: AuthService, useValue: { hasPermission: (code: string) => permissions.has(code), refreshPermissions: vi.fn(() => of([])) } },
        { provide: EnrollmentApplicationApiService, useValue: api },
        { provide: Phase2ApiService, useValue: { getSections: () => of([]), getSectionSubjects: () => of([]) } },
        { provide: ENROLLMENT_PORTAL_OPTIONS_LOADER, useValue: () => of({ schoolYears: [{ id: 9, name: 'Configured test year' }], gradeLevels: [{ id: 3, name: 'Configured test grade' }], declarationVersion: 'approved-test', declarationText: 'Isolated test declaration', privacyNotice: 'Isolated test privacy notice', acceptedFileTypes: ['application/pdf'], maxUploadBytes: 1024 }) },
      ],
    }).compileComponents();
  });
  it('shows readable orange pending reasons and never fetches restricted health on detail open', () => {
    const fixture = TestBed.createComponent(EnrollmentApplicationsPage); fixture.detectChanges();
    fixture.componentInstance.open(application()); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.status.pending').textContent).toContain('PendingReview');
    expect(api.health).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Separate health permission required');
  });
  it('does not load the queue or permit manual creation when enrollment permissions are absent', () => {
    permissions.clear();
    const fixture = TestBed.createComponent(EnrollmentApplicationsPage); fixture.detectChanges();
    fixture.componentInstance.startManual();
    expect(api.list).not.toHaveBeenCalled(); expect(fixture.componentInstance.editingProfile()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('do not have permission');
  });
  it('requires exception permission and remarks before conditional eligibility', () => {
    permissions.add('enrollment.academic.review');
    const fixture = TestBed.createComponent(EnrollmentApplicationsPage); const c = fixture.componentInstance;
    c.detail.set(application()); c.review.decision = 'EligibleWithConditions'; c.review.studentVisibleRemarks = 'Remediation required';
    c.saveAcademicReview();
    expect(api.academicReview).not.toHaveBeenCalled(); expect(c.error()).toContain('exception');
    permissions.add('enrollment.exceptions.approve'); c.saveAcademicReview();
    expect(api.academicReview).toHaveBeenCalled();
  });
  it('requires subject remarks for failed/incomplete evidence without inferring grade thresholds', () => {
    permissions.add('enrollment.academic.review');
    const fixture = TestBed.createComponent(EnrollmentApplicationsPage); const c = fixture.componentInstance;
    const d = application();
    d.externalGrades = [{ evidenceId: 1, subject: 'Mathematics', grade: 95, outcome: 'Incomplete', remarks: '', provenance: 'External' }];
    c.detail.set(d); c.grades = structuredClone(d.externalGrades);
    c.saveAcademicReview();
    expect(api.academicReview).not.toHaveBeenCalled(); expect(c.error()).toContain('require remarks');
  });
  it('preserves placement input and surfaces a server approval conflict without showing success', () => {
    permissions.add('enrollment.confirm');
    api.approve.mockImplementation(() => throwError(() => new HttpErrorResponse({ status: 409, error: { detail: 'Record changed. Refresh before approval.' } })));
    const fixture = TestBed.createComponent(EnrollmentApplicationsPage); const c = fixture.componentInstance;
    c.detail.set(application()); c.sectionId = 4; c.selectedSubjectIds = [8]; c.reason = 'Reviewed';
    c.approve();
    expect(c.error()).toContain('Record changed'); expect(c.notice()).toBe('');
    expect(c.sectionId).toBe(4); expect(c.selectedSubjectIds).toEqual([8]); expect(c.detail()?.status).toBe('PendingReview');
  });
  it('requires staff verification of both identity and email before legacy linkage', () => {
    permissions.add('enrollment.write');
    const fixture = TestBed.createComponent(EnrollmentApplicationsPage); const c = fixture.componentInstance;
    c.linkStudentId = 42; c.linkEmail = 'family@example.test'; c.linkReason = 'Verified in person'; c.identityVerified = true;
    c.provisionLink(); expect(api.linkStudent).not.toHaveBeenCalled();
    c.emailOwnershipVerified = true; c.provisionLink();
    expect(api.linkStudent).toHaveBeenCalledWith(42, 'family@example.test', 'Verified in person');
    expect(c.notice()).toContain('linked');
  });
  it('shows Pending LRN and disables approval even with placement filled', () => {
    permissions.add('enrollment.confirm');
    const fixture = TestBed.createComponent(EnrollmentApplicationsPage); fixture.detectChanges();
    const c = fixture.componentInstance; const d = application(); d.profile = emptyProfile();
    c.detail.set(d); c.sectionId = 4; c.selectedSubjectIds = [8]; c.reason = 'Reviewed'; fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Pending LRN · NotAssigned');
    const approve = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(b => b.textContent?.includes('Approve and officially enroll'))!;
    expect(approve.disabled).toBe(true);
    c.approve(); expect(api.approve).not.toHaveBeenCalled(); expect(c.error()).toContain('Pending LRN');
  });
  it('requires write permission, 12 digits and reason, then displays server resolution', () => {
    const c = TestBed.createComponent(EnrollmentApplicationsPage).componentInstance;
    const d = application(); d.profile = emptyProfile(); c.detail.set(d);
    c.resolutionLrn = '001234567890'; c.resolutionReason = 'Independently checked identity';
    c.resolveLrn(); expect(api.resolveLrn).not.toHaveBeenCalled();
    permissions.add('enrollment.write'); c.resolutionLrn = '123'; c.resolveLrn();
    expect(api.resolveLrn).not.toHaveBeenCalled(); expect(c.error()).toContain('12');
    c.resolutionLrn = '001234567890'; c.resolutionReason = ' '; c.resolveLrn();
    expect(api.resolveLrn).not.toHaveBeenCalled();
    c.resolutionReason = 'Independently checked identity'; c.resolveLrn();
    expect(api.resolveLrn).toHaveBeenCalledWith(d, '001234567890', 'Independently checked identity');
    expect(c.detail()?.profile.lrnStatus).toBe('Provided');
    expect(c.notice()).toContain('No real identity was verified, merged, or enrolled');
    expect(TestBed.inject(AuthService).refreshPermissions).toHaveBeenCalled();
  });
  for (const status of [403, 409, 503]) {
    it(`retains unresolved profile and resolution input on HTTP ${status}`, () => {
      permissions.add('enrollment.write');
      api.resolveLrn.mockImplementation(() => throwError(() => new HttpErrorResponse({ status })));
      const c = TestBed.createComponent(EnrollmentApplicationsPage).componentInstance;
      const d = application(); d.profile = emptyProfile(); c.detail.set(d);
      c.resolutionLrn = '001234567890'; c.resolutionReason = 'Checked identity'; c.resolutionDirty = true;
      c.resolveLrn();
      expect(c.error()).not.toBe(''); expect(c.notice()).toBe('');
      expect(c.detail()?.profile.lrnStatus).toBe('NotAssigned');
      expect(c.resolutionLrn).toBe('001234567890'); expect(c.resolutionReason).toBe('Checked identity');
      expect(c.resolutionDirty).toBe(true);
    });
  }
  it('creates a manual application through the full reusable profile workflow', () => {
    permissions.add('enrollment.write');
    const fixture = TestBed.createComponent(EnrollmentApplicationsPage); fixture.detectChanges();
    const c = fixture.componentInstance; c.startManual(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-student-profile-form')).not.toBeNull();
    c.saveProfile(emptyProfile());
    expect(api.create).toHaveBeenCalledTimes(1); expect(c.detail()?.source).toBe('Manual');
    expect(c.notice()).toContain('Not officially enrolled'); expect(c.editingProfile()).toBe(false);
  });
  it('retains restricted health entry for retry after partial manual-create failure', () => {
    permissions.add('enrollment.write'); permissions.add('students.health.write');
    api.saveHealth.mockImplementation(() => throwError(() => new HttpErrorResponse({ status: 503 })));
    const fixture = TestBed.createComponent(EnrollmentApplicationsPage); fixture.detectChanges();
    const c = fixture.componentInstance; c.startManual(); c.dirty = true;
    c.profile.health = { bloodType: 'Unknown', heightCm: null, weightKg: null, weighingDate: '', history: 'Entered condition' };
    c.saveProfile(c.profile);
    expect(c.detail()?.id).toBe('uuid'); expect(c.pendingProfileHealth()).toBe(true);
    expect(c.editingProfile()).toBe(true); expect(c.error()).toContain('Health details were not saved');
    c.saveProfile(c.profile); expect(api.create).toHaveBeenCalledTimes(1); expect(api.update).toHaveBeenCalledTimes(1);
  });
  it('checks permissions again after revocation rather than relying on rendered buttons', () => {
    permissions.add('enrollment.confirm');
    const c = TestBed.createComponent(EnrollmentApplicationsPage).componentInstance;
    c.detail.set(application()); c.sectionId = 4; c.selectedSubjectIds = [8]; c.reason = 'Reviewed';
    permissions.delete('enrollment.confirm'); c.approve(); expect(api.approve).not.toHaveBeenCalled();
  });
  it('does not discard a dirty form when the user cancels selection', () => {
    const c = TestBed.createComponent(EnrollmentApplicationsPage).componentInstance; c.dirty = true;
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false); c.open(application());
    expect(api.get).not.toHaveBeenCalled(); expect(c.dirty).toBe(true);
  });
  it('blocks manual creation when approved configuration is missing but still loads review queue', () => {
    permissions.add('enrollment.write');
    const fixture = TestBed.createComponent(EnrollmentApplicationsPage); fixture.detectChanges();
    const c = fixture.componentInstance;
    c.options.set({ ...c.options()!, declarationText: '', privacyNotice: '' }); c.startManual();
    expect(c.editingProfile()).toBe(false); expect(c.error()).toContain('not configured');
    c.load(); expect(api.list).toHaveBeenCalled();
  });
});
