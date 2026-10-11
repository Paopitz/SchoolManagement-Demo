import { HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApplicationDto, CreateApplicationDto, GradeDto, HealthDto, ProfileDto } from '../../features/enrollment-applications/enrollment-application.contracts';
import { emptyProfile } from '../../features/enrollment-applications/enrollment-application.models';
import { toProfileDto } from '../../features/enrollment-applications/enrollment-application.mapper';
import { ManagedUser } from '../models/phase3.models';
import { DemoData } from './demo-data';
import { DEMO_PERMISSION_CODES, DemoPermissions } from './demo-permissions';
import { AcademicDecision, GradeOutcome } from '../../features/enrollment-applications/enrollment-application.models';

type DemoRequestBody = CreateApplicationDto & HealthDto & {
  code: string; permissions: string[]; reason: string; studentId: number; expectedVersion: number;
  lrn: string; kind: 'BirthCertificate' | 'ReportCard' | 'IdPicture'; remarks: string;
  verified: boolean; evidenceRemarks: string; grades: { subjectName: string; grade: number | null; remarks?: string }[];
  decision: AcademicDecision; subjects: { evidenceId: number; outcome: GradeOutcome; remarks?: string }[];
  internalNotes: string | null; sectionId: number; sectionSubjectIds: number[]; status: string;
};

export const DEMO_CODE = '12345678';
const reject = (status: number, detail: string): never => { throw new HttpErrorResponse({ status, error: { detail, status } }); };
const now = () => new Date().toISOString();
const reason = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > 500) reject(400, 'Provide a reason of 1–500 characters.');
  return (value as string).trim();
};

/** Synthetic presentation state only. No SMTP, persistent files, database, or network delegate. */
@Injectable({ providedIn: 'root' })
export class DemoEnrollment {
  private readonly data = inject(DemoData);
  private readonly permissions = inject(DemoPermissions);
  readonly applications: ApplicationDto[] = [];
  readonly links = new Map<string, number>([['returning@example.invalid', 1]]);
  readonly health = new Map<string, HealthDto>();
  readonly files = new Map<number, Blob>();
  private readonly fileOwners = new Map<number, string>();
  private readonly sessions = new Map<string, { email: string; expires: number }>();
  private readonly codes = new Map<string, { expires: number; requested: number; attempts: number }>();
  private documentId = 1;
  readonly entryGradeLevelIds = [this.data.gradeLevels[0].gradeLevelId];
  readonly maxUploadBytes = 2 * 1024 * 1024;

  constructor() {
    const scenarios = [
      ['new@example.invalid', 'Nova', 'PendingReview', 'New', null],
      ['returning@example.invalid', 'Amelia', 'PendingReview', 'Returning', 1],
      ['conditional@example.invalid', 'Cedar', 'PendingReview', 'Transferee', null],
      ['correction@example.invalid', 'Robin', 'NeedsCorrection', 'New', null],
      ['approved@example.invalid', 'Ben', 'Approved', 'Returning', 2],
    ] as const;
    for (const [email, firstName, status, applicationType, studentId] of scenarios) {
      const p = emptyProfile();
      Object.assign(p, {
        firstName, lastName: 'Demo', sex: 'F', birthDate: `${this.data.year - 13}-05-15`,
        email, mobile: '09000000000', livingWithParents: true, idContact: 'Guardian',
        applicationType, hasPreviousSchooling: applicationType !== 'New', declarationAcknowledged: true,
        declarationVersion: 'demo-preview-v1', accomplishingPersonName: 'Fictional Guardian', accomplishingCapacity: 'Guardian',
        lrn: firstName === 'Nova' ? '' : studentId ? this.data.students[studentId - 1].lrn : `98000000000${this.applications.length}`,
        lrnStatus: firstName === 'Nova' ? 'NotAssigned' : 'Provided',
        previousGradeLevel: applicationType !== 'New' ? 'Grade 7' : '',
        previousSchoolYear: applicationType !== 'New' ? this.data.schoolYears[1].code : '',
        previousSchoolName: applicationType !== 'New' ? 'Fictional Previous School' : '',
      });
      const app = this.make({ email, schoolYearId: 1, requestedGradeLevelId: 1, applicationType, profile: toProfileDto(p) }, 'Online', studentId);
      app.status = status;
      if (status === 'NeedsCorrection') this.record(app, 'Status', 'PendingReview', status, 'Please correct the fictional guardian contact.', 'Demo reviewer');
      if (applicationType === 'Returning') app.grades = this.officialGrades(studentId!);
      if (firstName === 'Cedar') {
        app.grades = [{ evidenceId: 1, subjectName: 'Mathematics', grade: 68, outcome: 'Failed', remarks: 'Fictional remedial plan required.', provenance: 'ExternalSnapshot', gradingPeriod: null, schoolYear: this.data.schoolYears[1].code, gradeLevel: 'Previous school' }];
        app.academicDecision = 'EligibleWithConditions'; app.academicRemarks = 'Attend the fictional remedial program; staff exception permission is required.';
      }
      if (status === 'Approved') {
        this.links.set(email, studentId!);
        app.enrollmentId = this.data.enrollments.find(e => e.studentId === studentId)?.enrollmentId ?? null;
        app.academicDecision = 'Eligible'; app.academicRemarks = 'Seeded fictional approved scenario.';
      }
      for (const kind of ['BirthCertificate', 'IdPicture', ...(p.hasPreviousSchooling ? ['ReportCard'] : [])] as const) {
        app.documents.push({ documentId: this.documentId++, kind: kind as 'BirthCertificate' | 'ReportCard' | 'IdPicture', receipt: 'Physical', state: 'Verified', fileName: null, remarks: 'Synthetic physical receipt for presentation.' });
      }
      this.applications.push(app);
    }
  }

  require(user: ManagedUser | undefined, code: string): void {
    if (!user || !this.permissions.has(user, code)) reject(403, `Demo permission required: ${code}.`);
  }

  async dispatch(request: HttpRequest<unknown>, path: string[], user?: ManagedUser): Promise<unknown> {
    const method = request.method;
    const body = (request.body ?? {}) as DemoRequestBody;
    if (path[0] === 'role-permissions') {
      this.require(user, 'roles.permissions.manage');
      if (method === 'GET' && path[1] === 'catalog') return DEMO_PERMISSION_CODES.map(code => ({ code, description: `Fictional ${code} access` }));
      if (method === 'GET' && path.length === 1) return this.data.roles.map(r => ({ ...r, permissions: this.permissions.grants.get(r.roleId) ?? [] }));
      if (method !== 'PUT' || path.length !== 2) reject(404, 'Unknown demo permission operation.');
      const role = this.data.roles.find(r => r.roleId === Number(path[1]));
      if (!role) reject(404, 'Demo role not found.');
      if (role!.name === 'Super Admin') this.require(user, 'users.roles.manage');
      const explanation = reason(body['reason']);
      const codes = body['permissions'];
      const before = this.permissions.grants.get(role!.roleId) ?? [];
      if (!Array.isArray(codes) || codes.some(c => !DEMO_PERMISSION_CODES.some(known => known === c) || (!before.includes(c) && !this.permissions.has(user!, c)))) reject(403, 'Grant only known permissions you hold.');
      const after = [...new Set<string>(codes)];
      if (user!.roles.includes(role!.name) && before.includes('roles.permissions.manage') && !after.includes('roles.permissions.manage')) reject(409, 'You cannot remove your own permission-management access.');
      const managers = this.data.users.filter(u => u.isActive && this.data.roles.some(r => u.roles.includes(r.name) && (r.roleId === role!.roleId ? after : this.permissions.grants.get(r.roleId) ?? []).includes('roles.permissions.manage')));
      if (!managers.length) reject(409, 'Keep at least one active permission manager.');
      this.permissions.grants.set(role!.roleId, after);
      this.permissions.audit.push({ roleId: role!.roleId, actor: user!.username, reason: explanation, before: [...before], after: [...after] });
      return null;
    }

    let email: string | undefined;
    const portal = path[0] === 'student-portal';
    if (portal) {
      if (method === 'GET' && path[1] === 'options') return {
        schoolYears: this.data.schoolYears.filter(y => y.isActive).map(y => ({ id: y.schoolYearId, name: y.code })),
        gradeLevels: this.data.gradeLevels.map(g => ({ id: g.gradeLevelId, name: g.name })),
        declarationText: 'DEMO acknowledgment only. I understand this is a fictional presentation, not an enrollment or a legal declaration.',
        declarationVersion: 'demo-preview-v1', privacyNotice: 'DEMO: enter synthetic information only. All data stays in this browser tab memory; no email, database, or real verification.',
        acceptedFileTypes: ['application/pdf', 'image/jpeg', 'image/png'], maxUploadBytes: this.maxUploadBytes,
      };
      if (path[1] === 'email' && method === 'POST') {
        email = this.syntheticEmail(body['email']);
        if (path[2] === 'request') {
          const prior = this.codes.get(email);
          if (prior && Date.now() - prior.requested < 60000) reject(429, 'Demo code cooldown: wait 60 seconds.');
          if (this.codes.size >= 100 && !prior) reject(429, 'Reload to reset demo code capacity.');
          this.codes.set(email, { requested: Date.now(), expires: Date.now() + 300000, attempts: 0 });
          return { message: `DEMO: no email sent. Public presentation code: ${DEMO_CODE}. This does not verify a real email.` };
        }
        if (path[2] === 'verify') {
          const challenge = this.codes.get(email);
          if (!challenge || challenge.expires < Date.now() || challenge.attempts >= 5) reject(401, 'Demo code expired or attempt limit reached. Request another code.');
          challenge!.attempts++;
          if (body['code'] !== DEMO_CODE) reject(401, 'Incorrect demo code. Use the public presentation code.');
          this.codes.delete(email);
          const token = `demo-portal-${crypto.randomUUID()}`;
          const expires = Date.now() + 1800000;
          this.sessions.set(token, { email, expires });
          return { sessionToken: token, expiresAtUtc: new Date(expires).toISOString() };
        }
        reject(404, 'Unknown demo code operation.');
      }
      const token = request.headers.get('X-Portal-Session') ?? '';
      const session = this.sessions.get(token);
      if (!session || session.expires < Date.now()) { this.sessions.delete(token); reject(401, 'Demo portal session ended.'); }
      email = session!.email;
      if (method === 'DELETE' && path[1] === 'session') {
        this.sessions.delete(token); this.clearFiles(email); return null;
      }
      const studentId = this.links.get(email) ?? null;
      if (method === 'GET' && path[1] === 'me') return { email, studentId, mobileVerified: false };
      if (method === 'GET' && path[1] === 'grades') return {
        title: 'DEMO — Non-official grade summary', generatedAtUtc: now(),
        student: studentId ? this.data.students.find(s => s.studentId === studentId) : null,
        grades: studentId ? this.officialGrades(studentId) : [],
      };
      if (method === 'GET' && path[1] === 'enrollments') return this.data.enrollments.filter(e => e.studentId === studentId).map(e => ({
        enrollmentId: e.enrollmentId, schoolYear: e.schoolYearCode, gradeLevel: e.gradeLevelName, section: e.sectionName, status: e.status, enrolledAtUtc: e.enrolledAtUtc,
      }));
      if (path[1] !== 'applications') reject(404, 'Unknown demo portal operation.');
      path = ['enrollment-applications', ...path.slice(2)];
    } else {
      const action = path[2];
      const permission = action === 'health' ? (method === 'GET' ? 'students.health.read' : 'students.health.write')
        : action === 'documents' && method === 'GET' ? 'enrollment.documents.review'
        : method === 'GET' ? 'enrollment.read' : action === 'academic-review' ? 'enrollment.academic.review'
        : action === 'previous-grades' ? 'enrollment.previous-grades.write' : action === 'approve' ? 'enrollment.confirm'
        : action === 'documents' && (path[3] === 'physical' || path[4] === 'review') ? 'enrollment.documents.review'
        : action === 'health' ? 'students.health.write' : 'enrollment.write';
      this.require(user, permission);
      // Specialized review permissions are independent of ordinary write permission.
    }

    if (!portal && path[1] === 'link-student' && method === 'POST') {
      const linkedEmail = this.syntheticEmail(body['email']); const id = Number(body['studentId']);
      const student = this.data.students.find(s => s.studentId === id);
      if (!student) reject(404, 'Fictional student not found.');
      if ((this.links.has(linkedEmail) && this.links.get(linkedEmail) !== id) || [...this.links].some(([e, s]) => s === id && e !== linkedEmail)) reject(409, 'Fictional identity is already independently linked.');
      const explanation = reason(body['reason']);
      this.links.set(linkedEmail, id);
      for (const a of this.applications.filter(a => a.email === linkedEmail && a.profile.lrn === student!.lrn && a.studentId === null && ['PendingReview', 'NeedsCorrection'].includes(a.status))) {
        a.studentId = id; this.invalidate(a);
        this.record(a, 'IdentityLink', null, String(id), explanation, user!.username);
      }
      return { message: 'Demo identity link recorded; no real identity verification.' };
    }
    if (path.length === 1) {
      if (method === 'GET') {
        let rows = this.applications.filter(a => portal ? a.email === email : (!request.params.get('status') || a.status === request.params.get('status')) && (!request.params.get('schoolYearId') || a.schoolYearId === Number(request.params.get('schoolYearId'))));
        if (!portal) { const page = Math.max(1, Number(request.params.get('page')) || 1); rows = rows.slice((page - 1) * 25, page * 25); }
        return rows.map(a => this.visible(a, portal));
      }
      if (method === 'POST') {
        if (this.applications.length >= 100) reject(409, 'Reload to reset the 100-application demo limit.');
        const dto = body as CreateApplicationDto;
        dto.email = portal ? email! : this.syntheticEmail(dto.email);
        this.validate(dto);
        const linked = this.links.get(dto.email) ?? null;
        if (linked && this.data.students.find(s => s.studentId === linked)?.lrn !== dto.profile.lrn) reject(409, 'Application LRN must match the linked fictional identity.');
        if (this.applications.some(a => a.schoolYearId === dto.schoolYearId && ['PendingReview', 'NeedsCorrection'].includes(a.status) &&
          (a.email === dto.email || (dto.profile.lrn !== null && a.profile.lrn === dto.profile.lrn)))) reject(409, 'An active demo application already exists for this email or LRN and school year.');
        if (dto.applicationType === 'Returning' && (!linked || this.data.students.find(s => s.studentId === linked)?.lrn !== dto.profile.lrn)) reject(409, 'Returning requires an independently linked fictional identity and matching LRN.');
        if (dto.applicationType !== 'Returning' && this.data.students.some(s => s.lrn === dto.profile.lrn)) reject(409, 'LRN matches an existing fictional student. Staff linkage is required; no automatic merge.');
        const app = this.make(dto, portal ? 'Online' : 'Manual', dto.applicationType === 'Returning' ? linked : null);
        if (linked && dto.applicationType === 'Returning') app.grades = this.officialGrades(linked);
        this.applications.push(app); return this.visible(app, portal);
      }
      reject(404, 'Unknown demo application operation.');
    }
    const app = this.applications.find(a => a.applicationId === path[1] && (!portal || a.email === email));
    if (!app) reject(404, 'Demo application not found.');
    const a = app!;
    const action = path[2];
    if (method === 'GET' && path.length === 2) return this.visible(a, portal);
    if (action === 'health') {
      if (!portal) this.require(user, method === 'GET' ? 'students.health.read' : 'students.health.write');
      if (method === 'GET') return this.health.get(a.applicationId) ?? null;
      if (method !== 'PUT') reject(404, 'Unknown demo health operation.');
      this.editable(a);
      if (JSON.stringify(body).length > 5000 || [body['heightCm'], body['weightKg']].some(v => v !== null && v !== undefined && (typeof v !== 'number' || v < 0 || v > 500))) reject(400, 'Invalid or oversized synthetic health details.');
      this.health.set(a.applicationId, structuredClone(body)); return null;
    }
    if (action === 'documents' && method === 'GET' && path.length === 4) {
      const doc = a.documents.find(d => d.documentId === Number(path[3]));
      const file = doc && this.files.get(doc.documentId);
      if (!file) reject(404, 'No in-memory demo attachment. Upload a synthetic file; physical receipts have no download.');
      return file;
    }
    if (action === 'documents' && method === 'POST' && path.length === 4 && path[3] !== 'physical') {
      this.editable(a);
      const kind = path[3];
      if (!['BirthCertificate', 'ReportCard', 'IdPicture'].includes(kind)) reject(400, 'Unknown document kind.');
      const entry = request.body instanceof FormData ? request.body.get('file') : null;
      if (!(entry instanceof Blob) || !entry.size || entry.size > this.maxUploadBytes || !['application/pdf', 'image/jpeg', 'image/png'].includes(entry.type)) reject(400, 'Use a nonempty PDF/JPEG/PNG up to 2 MiB.');
      const file = entry as File;
      if ([...this.files.values()].reduce((n, f) => n + f.size, 0) + file!.size > 20 * 1024 * 1024) reject(409, 'Demo memory limit is 20 MiB. End the portal session or reload.');
      const name = (file as File).name ?? 'demo-file.pdf';
      const bytes = new Uint8Array(await file!.slice(0, 8).arrayBuffer());
      const valid = file!.type === 'application/pdf' ? /\.pdf$/i.test(name) && new TextDecoder().decode(bytes).startsWith('%PDF-')
        : file!.type === 'image/png' ? /\.png$/i.test(name) && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
        : /\.jpe?g$/i.test(name) && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      if (!valid) reject(400, 'File extension and signature must match PDF/JPEG/PNG.');
      this.editable(a); // Recheck after asynchronous file validation.
      const prior = a.documents.find(d => d.kind === kind);
      if (prior) { this.files.delete(prior.documentId); this.fileOwners.delete(prior.documentId); a.documents = a.documents.filter(d => d !== prior); }
      const id = this.documentId++;
      this.files.set(id, file!); this.fileOwners.set(id, a.email);
      a.documents.push({ documentId: id, kind: kind as 'BirthCertificate', receipt: 'Upload', state: 'Received', fileName: 'demo-document.' + (file!.type === 'application/pdf' ? 'pdf' : file!.type === 'image/png' ? 'png' : 'jpg'), remarks: 'Memory only; not malware-scanned.' });
      this.invalidate(a); this.record(a, 'Upload', null, kind, 'Synthetic attachment received; review invalidated.', portal ? 'Demo applicant' : user!.username);
      return this.visible(a, portal);
    }
    const specialized = action === 'academic-review' ? 'enrollment.academic.review' : action === 'previous-grades' ? 'enrollment.previous-grades.write' : action === 'approve' ? 'enrollment.confirm' : action === 'documents' ? 'enrollment.documents.review' : 'enrollment.write';
    if (!portal) this.require(user, specialized);
    if (body['expectedVersion'] !== a.version) reject(409, 'Demo application changed. Reload it before retrying; your unsaved input is retained.');
    this.editable(a);
    const actor = portal ? 'Demo applicant' : user!.username;
    if (action === 'profile' && method === 'PUT') {
      const profile = body['profile'] as ProfileDto;
      this.validate({ ...a, profile } as CreateApplicationDto);
      if (profile.lrn !== a.profile.lrn || profile.lrnStatus !== a.profile.lrnStatus) reject(409, 'LRN is locked. Authorized staff must resolve it with an audit reason.');
      a.profile = structuredClone(profile); a.status = 'PendingReview'; this.invalidate(a);
      this.record(a, 'ProfileCorrection', null, 'PendingReview', 'Demo profile corrected; review invalidated.', actor);
    } else if (action === 'resolve-lrn' && method === 'POST' && !portal) {
      if (!/^\d{12}$/.test(body['lrn'] ?? '')) reject(400, 'LRN must contain exactly 12 digits.');
      const explanation = reason(body['reason']);
      if (a.profile.lrnStatus === 'Provided') reject(409, 'This demo LRN is already resolved.');
      if (this.data.students.some(s => s.lrn === body['lrn']) || this.applications.some(other => other !== a && other.profile.lrn === body['lrn'])) reject(409, 'LRN already exists. No automatic student merge.');
      const before = a.profile.lrnStatus; a.profile.lrn = body['lrn']; a.profile.lrnStatus = 'Provided';
      this.invalidate(a); this.record(a, 'LrnResolution', before ?? null, 'Provided', explanation, actor);
    } else if (action === 'documents' && !portal && method === 'POST') {
      if (path[3] === 'physical') {
        if (a.source !== 'Manual') reject(409, 'Physical receipts are available only for manual demo applications.');
        if (!['BirthCertificate', 'ReportCard', 'IdPicture'].includes(body['kind'])) reject(400, 'Unknown document kind.');
        const remarks = reason(body['remarks']); const prior = a.documents.find(d => d.kind === body['kind']);
        if (prior) { this.files.delete(prior.documentId); this.fileOwners.delete(prior.documentId); a.documents = a.documents.filter(d => d !== prior); }
        a.documents.push({ documentId: this.documentId++, kind: body['kind'], receipt: 'Physical', state: 'Received', fileName: null, remarks });
        this.invalidate(a); this.record(a, 'PhysicalReceipt', null, body['kind'], remarks, actor);
      } else if (path[4] === 'review') {
        const doc = a.documents.find(d => d.documentId === Number(path[3]));
        if (!doc || typeof body['verified'] !== 'boolean') reject(400, 'Choose a document and review result.');
        const remarks = reason(body['remarks']); doc!.state = body['verified'] ? 'Verified' : 'NeedsCorrection'; doc!.remarks = remarks;
        this.record(a, 'DocumentReview', null, doc!.state, remarks, actor);
      } else reject(404, 'Unknown demo document review.');
    } else if (action === 'previous-grades' && method === 'PUT' && !portal) {
      if (a.applicationType === 'Returning') reject(409, 'Returning grades come from original finalized fictional records, not external encoding.');
      const remarks = reason(body['evidenceRemarks']);
      if (!Array.isArray(body['grades']) || !body['grades'].length || body['grades'].length > 30) reject(400, 'Provide 1–30 fictional grade subjects.');
      const grades: GradeDto[] = body['grades'].map((g, i) => {
        if (typeof g.subjectName !== 'string' || !g.subjectName.trim() || g.subjectName.length > 100 || (g.grade !== null && (typeof g.grade !== 'number' || g.grade < 0 || g.grade > 100))) reject(400, 'Invalid fictional grade evidence.');
        return { evidenceId: i + 1, subjectName: g.subjectName, grade: g.grade, outcome: 'Unreviewed', remarks: g.remarks ?? null, provenance: 'ExternalSnapshot', gradingPeriod: null, schoolYear: a.profile.previousSchoolYear, gradeLevel: a.profile.previousGradeLevel };
      });
      a.grades = grades; this.invalidate(a); this.record(a, 'PreviousGrades', null, 'ExternalSnapshot', remarks, actor);
    } else if (action === 'academic-review' && method === 'POST' && !portal) {
      const decision = body['decision']; const remarks = reason(body['remarks']);
      if (!['NeedsFurtherReview', 'Eligible', 'EligibleWithConditions', 'NotEligible', 'NotApplicable'].includes(decision)) reject(400, 'Choose a review decision.');
      if (decision === 'EligibleWithConditions') this.require(user, 'enrollment.exceptions.approve');
      if (!Array.isArray(body['subjects'])) reject(400, 'Review each subject explicitly.');
      const grades = structuredClone(a.grades);
      for (const g of grades) {
        const result = body['subjects'].find(s => s.evidenceId === g.evidenceId);
        if (!result) return reject(400, 'Classify every grade subject.');
        if (!['Passed', 'Failed', 'Incomplete', 'Unknown'].includes(result.outcome)) reject(400, 'Classify every grade subject.');
        if (result.outcome !== 'Passed') reason(result.remarks);
        g.outcome = result.outcome; g.remarks = result.remarks ?? null;
      }
      if (decision === 'NotApplicable' && (a.profile.hasPreviousSchooling || !this.entryGradeLevelIds.includes(a.requestedGradeLevelId))) reject(409, 'NotApplicable requires no prior schooling and a configured fictional entry grade.');
      if (decision === 'Eligible' && (!grades.length || grades.some(g => g.outcome !== 'Passed'))) reject(409, 'Unconditional eligibility requires all subjects explicitly Passed.');
      if (decision === 'EligibleWithConditions' && !grades.length) reject(409, 'Conditional review requires grade evidence.');
      a.grades = grades; a.academicDecision = decision; a.academicRemarks = remarks; a.internalNotes = body['internalNotes'] ?? null;
      this.record(a, 'AcademicReview', null, decision, remarks, actor);
    } else if (action === 'approve' && method === 'POST' && !portal) {
      const explanation = reason(body['reason']);
      if (a.status !== 'PendingReview' || a.profile.lrnStatus !== 'Provided' || !/^\d{12}$/.test(a.profile.lrn ?? '')) reject(409, 'Approval requires pending review and a resolved 12-digit LRN.');
      if (!['Eligible', 'EligibleWithConditions', 'NotApplicable'].includes(a.academicDecision ?? '')) reject(409, 'Complete academic review before fictional approval.');
      if (a.academicDecision === 'EligibleWithConditions') this.require(user, 'enrollment.exceptions.approve');
      const kinds = ['BirthCertificate', 'IdPicture', ...(a.profile.hasPreviousSchooling ? ['ReportCard'] : [])];
      if (kinds.some(k => !a.documents.some(d => d.kind === k && d.state === 'Verified'))) reject(409, 'Verify all required documents first.');
      const section = this.data.sections.find(s => s.sectionId === body['sectionId'] && s.schoolYearId === a.schoolYearId && s.gradeLevelId === a.requestedGradeLevelId);
      const ids = body['sectionSubjectIds'];
      if (!section || !Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length || ids.some(id => !this.data.offerings.some(o => o.sectionId === section!.sectionId && o.sectionSubjectId === id))) reject(400, 'Choose a matching section and its subjects.');
      let student = a.studentId ? this.data.students.find(s => s.studentId === a.studentId) : undefined;
      if (student && (this.links.get(a.email) !== student.studentId || student.lrn !== a.profile.lrn)) reject(409, 'Returning fictional identity linkage must match.');
      if (!student && this.data.students.some(s => s.lrn === a.profile.lrn)) reject(409, 'Existing LRN requires independent linkage. No automatic merge.');
      if (student && this.data.enrollments.some(e => e.studentId === student!.studentId && e.schoolYearId === a.schoolYearId)) reject(409, 'Fictional student already has enrollment history in this school year.');
      if (!student) {
        const id = Math.max(0, ...this.data.students.map(s => s.studentId)) + 1;
        student = { studentId: id, studentNumber: `DEMO-${String(id).padStart(3, '0')}`, lrn: a.profile.lrn, firstName: a.profile.firstName, lastName: a.profile.lastName, middleName: a.profile.middleName, suffix: a.profile.suffix, birthDate: a.profile.birthDate, status: 'Active', createdAtUtc: now() };
        this.data.students.push(student);
      }
      const enrollmentId = Math.max(0, ...this.data.enrollments.map(e => e.enrollmentId)) + 1;
      this.data.enrollments.push({
        enrollmentId, enrollmentType: a.applicationType, studentId: student.studentId, studentNumber: student.studentNumber, studentName: `${student.firstName} ${student.lastName}`,
        schoolYearId: a.schoolYearId, schoolYearCode: section!.schoolYearCode, gradeLevelId: a.requestedGradeLevelId, gradeLevelName: section!.gradeLevelName,
        sectionId: section!.sectionId, sectionName: section!.name, status: 'Enrolled', enrolledAtUtc: now(), createdAtUtc: now(), updatedAtUtc: null,
        subjects: this.data.offerings.filter(o => ids.includes(o.sectionSubjectId)).map(o => ({ ...o, enrollmentSubjectId: enrollmentId * 100 + o.sectionSubjectId })),
      });
      a.studentId = student.studentId; a.enrollmentId = enrollmentId; a.status = 'Approved'; this.links.set(a.email, student.studentId);
      this.record(a, 'Approval', 'PendingReview', 'Approved', explanation, actor);
    } else if ((action === 'withdraw' && portal || action === 'status' && !portal) && method === 'POST') {
      const next = portal ? 'Withdrawn' : body['status'];
      if (!['NeedsCorrection', 'Rejected', 'Withdrawn', 'PendingReview'].includes(next)) reject(400, 'Invalid demo status.');
      const explanation = reason(body['reason']); const before = a.status; a.status = next;
      this.record(a, 'Status', before, next, explanation, actor);
    } else reject(404, 'Unknown demo application action.');
    return this.visible(a, portal);
  }

  clearFiles(email?: string): void {
    for (const [id, owner] of this.fileOwners) if (!email || owner === email) { this.files.delete(id); this.fileOwners.delete(id); }
    for (const a of this.applications.filter(a => !email || a.email === email)) for (const d of a.documents) if (d.receipt === 'Upload') {
      d.state = 'NeedsCorrection'; d.remarks = 'Demo session ended; memory-only file cleared. Upload again.'; this.invalidate(a);
    }
  }
  private syntheticEmail(value: unknown): string {
    if (typeof value !== 'string' || !/^[a-z0-9._+-]+@example\.invalid$/i.test(value) || value.length > 150) reject(400, 'Use a fictional email ending in @example.invalid.');
    return (value as string).toLowerCase();
  }
  private validate(dto: CreateApplicationDto): void {
    const p = dto.profile;
    if (!p || !['New', 'Returning', 'Transferee'].includes(dto.applicationType)) reject(400, 'Invalid demo profile or application type.');
    const resolved = p.lrnStatus === 'Provided' && /^\d{12}$/.test(p.lrn ?? '');
    if (!resolved && !(dto.applicationType === 'New' && ['NotAssigned', 'Unknown'].includes(p.lrnStatus ?? '') && p.lrn === null)) reject(400, 'Only New applications may omit LRN. Returning/Transferee require 12 digits.');
    if (!this.data.schoolYears.some(y => y.schoolYearId === dto.schoolYearId && y.isActive) || !this.data.gradeLevels.some(g => g.gradeLevelId === dto.requestedGradeLevelId)) reject(400, 'Choose configured demo school year and grade level.');
    if (!p.firstName?.trim() || !p.lastName?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(p.birthDate ?? '') || !p.declarationAccepted || p.declarationVersion !== 'demo-preview-v1' || !p.accomplishedBy?.trim() || !p.capacity?.trim() || JSON.stringify(p).length > 15000) reject(400, 'Complete the bounded fictional profile and demo acknowledgment.');
  }
  private make(dto: CreateApplicationDto, source: string, studentId: number | null): ApplicationDto {
    return { ...structuredClone(dto), applicationId: crypto.randomUUID(), studentId, source, status: 'PendingReview', version: 1, submittedAtUtc: now(), enrollmentId: null, academicDecision: null, academicRemarks: null, internalNotes: null, documents: [], grades: [], history: [{ historyId: 1, action: 'Submission', beforeValue: null, afterValue: 'PendingReview', reason: 'DEMO application only; not enrolled.', actor: 'Demo applicant', atUtc: now() }] };
  }
  private editable(a: ApplicationDto): void { if (!['PendingReview', 'NeedsCorrection'].includes(a.status)) reject(409, 'This demo application is locked.'); }
  private invalidate(a: ApplicationDto): void { a.academicDecision = null; a.academicRemarks = null; a.internalNotes = null; }
  private record(a: ApplicationDto, action: string, beforeValue: string | null, afterValue: string, explanation: string, actor: string): void {
    a.version++; a.history.push({ historyId: a.history.length + 1, action, beforeValue, afterValue, reason: explanation, actor, atUtc: now() });
  }
  private visible(a: ApplicationDto, portal: boolean): ApplicationDto {
    const result = structuredClone(a);
    if (portal) { result.internalNotes = null; result.history = result.history.filter(h => h.action !== 'IdentityLink'); }
    return result;
  }
  private officialGrades(studentId: number): GradeDto[] {
    const rows = this.data.grades.filter(g => g.studentId === studentId && g.workflowStatus === 'Finalized');
    return rows.map(g => ({ evidenceId: g.gradeRecordId, subjectName: g.subjectName, grade: g.computedGrade, outcome: 'Unreviewed', remarks: null, provenance: 'OfficialFinalized', gradingPeriod: this.data.periods.find(p => p.gradingPeriodId === g.gradingPeriodId)?.name ?? '', schoolYear: this.data.schoolYears.find(y => y.schoolYearId === this.data.enrollments.find(e => e.enrollmentId === g.enrollmentId)?.schoolYearId)?.code ?? '', gradeLevel: this.data.enrollments.find(e => e.enrollmentId === g.enrollmentId)?.gradeLevelName ?? '' }));
  }
}
