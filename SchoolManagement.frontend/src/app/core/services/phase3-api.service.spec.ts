import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { Phase3ApiService } from './phase3-api.service';

describe('Phase3ApiService', () => {
  let api: Phase3ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(Phase3ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends paged student search and status filters', () => {
    api.getStudents(2, 'Lee', 'Active').subscribe();
    const request = http.expectOne((candidate) => candidate.url === `${environment.apiBaseUrl}/students`);
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe('20');
    expect(request.request.params.get('search')).toBe('Lee');
    expect(request.request.params.get('status')).toBe('Active');
    request.flush({ items: [], page: 2, pageSize: 20, totalCount: 0 });
  });

  it('posts new user credentials and role IDs without a read endpoint for secrets', () => {
    const payload = { username: 'staff1', email: null, initialPassword: 'strong-pass', teacherId: null, isActive: true, roleIds: [3] };
    api.createUser(payload).subscribe();
    const request = http.expectOne(`${environment.apiBaseUrl}/users`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush({ userId: 7, username: 'staff1', roles: ['Registrar'] });
  });

  it('loads teacher profiles and creates a profile through the teacher API', () => {
    const teacher = { teacherId: 4, employeeNumber: 'EMP-004', firstName: 'Mina', lastName: 'Lee', isActive: true, linkedUserId: null };
    api.getTeachers().subscribe((teachers) => expect(teachers).toEqual([teacher]));
    http.expectOne(`${environment.apiBaseUrl}/teachers`).flush([teacher]);

    const payload = { employeeNumber: 'EMP-004', firstName: 'Mina', lastName: 'Lee', isActive: true };
    api.createTeacher(payload).subscribe((created) => expect(created).toEqual(teacher));
    const request = http.expectOne(`${environment.apiBaseUrl}/teachers`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush(teacher);
  });

  it('requests attendance summaries with inclusive date and optional section filters', () => {
    api.getAttendanceSummary({ from: '2026-09-01', to: '2026-09-30', sectionId: 4, schoolYearId: 2 }).subscribe();
    const request = http.expectOne((candidate) => candidate.url === `${environment.apiBaseUrl}/reports/attendance-summary`);
    expect(request.request.params.get('from')).toBe('2026-09-01');
    expect(request.request.params.get('to')).toBe('2026-09-30');
    expect(request.request.params.get('sectionId')).toBe('4');
    expect(request.request.params.get('schoolYearId')).toBe('2');
    request.flush([]);
  });

  it('replaces user roles through the dedicated endpoint', () => {
    api.replaceUserRoles(7, [1, 3]).subscribe();
    const request = http.expectOne(`${environment.apiBaseUrl}/users/7/roles`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ roleIds: [1, 3] });
    request.flush({ userId: 7, username: 'staff1', roles: ['Admin', 'Registrar'] });
  });
});