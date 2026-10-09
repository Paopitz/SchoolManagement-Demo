import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AttendanceSummaryRow,
  EnrollmentSummaryRow,
  ManagedRole,
  ManagedUser,
  Phase3PagedResponse,
  StudentRecord,
  TeacherProfile,
  TeacherLookup,
} from '../models/phase3.models';

@Injectable({ providedIn: 'root' })
export class Phase3ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  getStudents(page: number, search: string, status: string): Observable<Phase3PagedResponse<StudentRecord>> {
    let params = new HttpParams().set('page', page).set('pageSize', 20);
    if (search.trim()) params = params.set('search', search.trim());
    if (status) params = params.set('status', status);
    return this.http.get<Phase3PagedResponse<StudentRecord>>(`${this.baseUrl}/students`, { params });
  }

  getStudent(id: number): Observable<StudentRecord> { return this.http.get<StudentRecord>(`${this.baseUrl}/students/${id}`); }
  createStudent(body: StudentPayload): Observable<StudentRecord> { return this.http.post<StudentRecord>(`${this.baseUrl}/students`, body); }
  updateStudent(id: number, body: StudentPayload & { status: string }): Observable<StudentRecord> { return this.http.put<StudentRecord>(`${this.baseUrl}/students/${id}`, body); }

  getUsers(page: number, search: string, isActive: boolean | null): Observable<Phase3PagedResponse<ManagedUser>> {
    let params = new HttpParams().set('page', page).set('pageSize', 20);
    if (search.trim()) params = params.set('search', search.trim());
    if (isActive !== null) params = params.set('isActive', isActive);
    return this.http.get<Phase3PagedResponse<ManagedUser>>(`${this.baseUrl}/users`, { params });
  }

  getRoles(): Observable<ManagedRole[]> { return this.http.get<ManagedRole[]>(`${this.baseUrl}/roles`); }
  createUser(body: { username: string; email: string | null; initialPassword: string; teacherId: number | null; isActive: boolean; roleIds: number[] }): Observable<ManagedUser> {
    return this.http.post<ManagedUser>(`${this.baseUrl}/users`, body);
  }
  updateUser(id: number, body: { username: string; email: string | null; teacherId: number | null; isActive: boolean; newPassword: string | null }): Observable<ManagedUser> {
    return this.http.put<ManagedUser>(`${this.baseUrl}/users/${id}`, body);
  }
  replaceUserRoles(id: number, roleIds: number[]): Observable<ManagedUser> {
    return this.http.put<ManagedUser>(`${this.baseUrl}/users/${id}/roles`, { roleIds });
  }

  getTeachers(): Observable<TeacherProfile[]> {
    return this.http.get<TeacherProfile[]>(`${this.baseUrl}/teachers`);
  }
  getTeacherLookup(): Observable<TeacherLookup[]> {
    return this.http.get<TeacherLookup[]>(`${this.baseUrl}/teachers/lookup`);
  }
  createTeacher(body: TeacherPayload): Observable<TeacherProfile> {
    return this.http.post<TeacherProfile>(`${this.baseUrl}/teachers`, body);
  }
  updateTeacher(id: number, body: TeacherPayload): Observable<TeacherProfile> {
    return this.http.put<TeacherProfile>(`${this.baseUrl}/teachers/${id}`, body);
  }

  getEnrollmentSummary(schoolYearId?: number): Observable<EnrollmentSummaryRow[]> {
    let params = new HttpParams();
    if (schoolYearId) params = params.set('schoolYearId', schoolYearId);
    return this.http.get<EnrollmentSummaryRow[]>(`${this.baseUrl}/reports/enrollment-summary`, { params });
  }

  getAttendanceSummary(filters: { from: string; to: string; sectionId?: number; schoolYearId?: number }): Observable<AttendanceSummaryRow[]> {
    let params = new HttpParams().set('from', filters.from).set('to', filters.to);
    if (filters.sectionId) params = params.set('sectionId', filters.sectionId);
    if (filters.schoolYearId) params = params.set('schoolYearId', filters.schoolYearId);
    return this.http.get<AttendanceSummaryRow[]>(`${this.baseUrl}/reports/attendance-summary`, { params });
  }
}

export interface StudentPayload {
  studentNumber: string;
  lrn: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  birthDate: string | null;
}

export interface TeacherPayload {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
}