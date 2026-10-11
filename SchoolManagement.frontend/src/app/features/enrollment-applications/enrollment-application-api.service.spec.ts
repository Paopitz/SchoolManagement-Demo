import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { ApplicationDetail, emptyProfile } from './enrollment-application.models';
import { EnrollmentApplicationApiService } from './enrollment-application-api.service';
import { ApplicationDto } from './enrollment-application.contracts';
import { toProfileDto } from './enrollment-application.mapper';

describe('EnrollmentApplicationApiService exact staff contract', () => {
  let api: EnrollmentApplicationApiService;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/enrollment-applications`;
  const d: ApplicationDetail = { id: 'uuid', reference: 'uuid', studentName: '', status: 'PendingReview', source: 'Manual', reasons: [], profile: emptyProfile(), documents: [], externalGrades: [], academicReview: null, history: [], version: 7, enrollmentId: null };
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(EnrollmentApplicationApiService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('uses bounded server pagination, not fetching all applicants or students', () => {
    api.list(2, 'NeedsCorrection', 9).subscribe();
    const req = http.expectOne(r => r.url === base);
    expect(req.request.params.get('page')).toBe('2'); expect(req.request.params.get('pageSize')).toBe('25');
    expect(req.request.params.get('status')).toBe('NeedsCorrection'); expect(req.request.params.get('schoolYearId')).toBe('9');
    req.flush([]);
  });
  it('sends numeric expectedVersion and structured academic subject review', () => {
    api.academicReview(d, { decision: 'EligibleWithConditions', studentVisibleRemarks: 'Remediation', internalRemarks: 'Staff only', conditions: '' },
      [{ evidenceId: 12, subject: 'Math', grade: 72, outcome: 'Failed', remarks: 'Repeat assessment', provenance: 'External' }]).subscribe({ error: () => {} });
    const req = http.expectOne(`${base}/uuid/academic-review`);
    expect(req.request.body).toEqual({ expectedVersion: 7, decision: 'EligibleWithConditions', remarks: 'Remediation', internalNotes: 'Staff only', subjects: [{ evidenceId: 12, outcome: 'Failed', remarks: 'Repeat assessment' }] });
    expect(req.request.headers.has('X-Portal-Session')).toBe(false);
    req.flush({}, { status: 409, statusText: 'Conflict' });
  });
  it('records physical receipt separately from an upload and includes concurrency version', () => {
    api.physical(d, 'PSA', 'Received original').subscribe({ error: () => {} });
    const req = http.expectOne(`${base}/uuid/documents/physical`);
    expect(req.request.body).toEqual({ expectedVersion: 7, kind: 'BirthCertificate', remarks: 'Received original' });
    req.flush({}, { status: 403, statusText: 'Forbidden' });
  });
  it('posts verified LRN resolution with expectedVersion and no portal session', () => {
    let updated: ApplicationDetail | undefined;
    api.resolveLrn(d, '001234567890', 'Identity independently verified').subscribe(value => updated = value);
    const req = http.expectOne(`${base}/uuid/resolve-lrn`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ expectedVersion: 7, lrn: '001234567890', reason: 'Identity independently verified' });
    expect(req.request.headers.has('X-Portal-Session')).toBe(false);
    const wire: ApplicationDto = {
      applicationId: d.id, email: 'family@example.test', studentId: null, schoolYearId: 9,
      requestedGradeLevelId: 3, applicationType: 'New', source: 'Manual', status: 'PendingReview',
      version: 8, submittedAtUtc: '', enrollmentId: null,
      profile: { ...toProfileDto(d.profile), lrn: '001234567890', lrnStatus: 'Provided' },
      academicDecision: null, academicRemarks: null, internalNotes: null, documents: [], grades: [], history: [],
    };
    req.flush(wire);
    expect(updated?.version).toBe(8);
    expect(updated?.profile.lrn).toBe('001234567890');
    expect(updated?.profile.lrnStatus).toBe('Provided');
  });
});
