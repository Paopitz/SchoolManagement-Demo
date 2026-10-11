import { HttpBackend, HttpClient, HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { appConfig } from '../../app.config';
import { AuthService } from '../services/auth.service';
import { ApplicationDto } from '../../features/enrollment-applications/enrollment-application.contracts';
import { emptyProfile } from '../../features/enrollment-applications/enrollment-application.models';
import { toProfileDto } from '../../features/enrollment-applications/enrollment-application.mapper';
import { DemoData, DEMO_PASSWORD } from './demo-data';
import { DemoPermissions } from './demo-permissions';

describe('Revised enrollment standalone demo', () => {
  let http: HttpClient;
  let staff: HttpClient;
  let data: DemoData;
  let headers: HttpHeaders;
  const base = '/demo-api/enrollment-applications';

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: appConfig.providers });
    staff = TestBed.inject(HttpClient);
    http = new HttpClient(TestBed.inject(HttpBackend));
    data = TestBed.inject(DemoData);
    await firstValueFrom(TestBed.inject(AuthService).login({ username: 'demo.admin', password: DEMO_PASSWORD }));
    await firstValueFrom(http.post('/demo-api/student-portal/email/request', { email: 'new@example.invalid' }));
    const session = await firstValueFrom(http.post<{ sessionToken: string }>('/demo-api/student-portal/email/verify', { email: 'new@example.invalid', code: '12345678' }));
    headers = new HttpHeaders({ 'X-Portal-Session': session.sessionToken });
  });
  afterEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); });

  it('reviews unresolved New applications, resolves with history, and creates records only at approval without network', async () => {
    const xhr = vi.spyOn(XMLHttpRequest.prototype, 'send');
    const fetch = vi.spyOn(globalThis, 'fetch');
    const students = data.students.length;
    const enrollments = data.enrollments.length;
    const apps = await firstValueFrom(http.get<ApplicationDto[]>('/demo-api/student-portal/applications', { headers }));
    let app = apps[0];
    const url = `${base}/${app.applicationId}`;
    const approval = () => ({ expectedVersion: app.version, sectionId: 1, sectionSubjectIds: [1], reason: 'Fictional review' });
    await expect(firstValueFrom(staff.post(`${url}/approve`, approval()))).rejects.toMatchObject({ status: 409 });
    app = await firstValueFrom(staff.post<ApplicationDto>(`${url}/academic-review`, {
      expectedVersion: app.version, decision: 'NotApplicable', remarks: 'Fictional first schooling', subjects: [],
    }));
    app = await firstValueFrom(staff.post<ApplicationDto>(`${url}/resolve-lrn`, {
      expectedVersion: app.version, lrn: '980000009999', reason: 'Fictional LIS check',
    }));
    expect(app.academicDecision).toBeNull();
    expect(app.history.some(h => h.action === 'LrnResolution')).toBe(true);
    expect(data.students.length).toBe(students);
    app = await firstValueFrom(staff.post<ApplicationDto>(`${url}/academic-review`, {
      expectedVersion: app.version, decision: 'NotApplicable', remarks: 'Fictional first schooling reviewed again', subjects: [],
    }));
    app = await firstValueFrom(staff.post<ApplicationDto>(`${url}/approve`, approval()));
    expect(app.status).toBe('Approved');
    expect(data.students.length).toBe(students + 1);
    expect(data.enrollments.length).toBe(enrollments + 1);
    expect(xhr).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects duplicate application and unresolved Returning/Transferee without altering records', async () => {
    const p = emptyProfile();
    Object.assign(p, { firstName: 'Fictional', lastName: 'Applicant', birthDate: '2010-01-01',
      declarationAcknowledged: true, declarationVersion: 'demo-preview-v1', accomplishingPersonName: 'Fictional Guardian', accomplishingCapacity: 'Guardian' });
    const body = { email: 'new@example.invalid', schoolYearId: 1, requestedGradeLevelId: 1, applicationType: 'New', profile: toProfileDto(p) };
    await expect(firstValueFrom(staff.post(base, body))).rejects.toMatchObject({ status: 409 });
    for (const type of ['Returning', 'Transferee']) {
      await expect(firstValueFrom(staff.post(base, { ...body, email: 'another@example.invalid', applicationType: type }))).rejects.toMatchObject({ status: 400 });
    }
  });

  it('enforces dynamic permission revocation and rejects unauthenticated or external requests', async () => {
    const grants = TestBed.inject(DemoPermissions);
    const teacher = data.roles.find(r => r.name === 'Teacher')!;
    await firstValueFrom(staff.put(`/demo-api/role-permissions/${teacher.roleId}`, {
      permissions: grants.grants.get(teacher.roleId)!.filter(p => !p.startsWith('enrollment.')),
      reason: 'Fictional client access change',
    }));
    await firstValueFrom(TestBed.inject(AuthService).login({ username: 'demo.teacher', password: DEMO_PASSWORD }));
    await expect(firstValueFrom(staff.get(base))).rejects.toMatchObject({ status: 403 });
    await expect(firstValueFrom(http.get(base))).rejects.toMatchObject({ status: 401 });
    await expect(firstValueFrom(http.get('https://localhost:52362/api/students'))).rejects.toMatchObject({ status: 404 });
    expect(grants.audit).toHaveLength(1);
  });

  it('preserves Registrar setup and Teacher/Adviser attendance permissions', () => {
    const permissions = TestBed.inject(DemoPermissions);
    const registrar = data.users.find(u => u.username === 'demo.registrar')!;
    expect(permissions.has(registrar, 'academic.write')).toBe(true);
    expect(permissions.has(registrar, 'schedule.write')).toBe(true);
    for (const username of ['demo.teacher', 'demo.adviser']) {
      expect(permissions.has(data.users.find(u => u.username === username)!, 'attendance.write')).toBe(true);
    }
  });
});
