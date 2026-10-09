import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AttendanceRecord, AttendanceRules, AttendanceScanResult, AttendanceSummary, DashboardSummary,
  GradeRecord, GradeScoreResult, GradeTransitionResult, GradingComponent, GradingPeriod,
  GradingTemplate, GradingSection, GradingEnrollment, SystemSetting, TeacherAttendanceRecord, TeacherAttendanceScanResult,
} from '../models/phase36.models';

@Injectable({ providedIn: 'root' })
export class Phase36ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  scanAttendance(code: string, scannedAtUtc = new Date().toISOString()): Observable<AttendanceScanResult> {
    return this.http.post<AttendanceScanResult>(`${this.baseUrl}/attendance/student-scans`, { code, scannedAtUtc });
  }
  scanTeacherAttendance(employeeNumber: string, scannedAtUtc = new Date().toISOString()): Observable<TeacherAttendanceScanResult> {
    return this.http.post<TeacherAttendanceScanResult>(`${this.baseUrl}/attendance/teacher-scans`, { employeeNumber, scannedAtUtc });
  }
  getAttendance(date: string, sectionId?: number): Observable<AttendanceRecord[]> {
    let params = new HttpParams().set('date', date);
    if (sectionId) params = params.set('sectionId', sectionId);
    return this.http.get<AttendanceRecord[]>(`${this.baseUrl}/attendance/records`, { params });
  }
  getTeacherAttendance(date: string): Observable<TeacherAttendanceRecord[]> {
    return this.http.get<TeacherAttendanceRecord[]>(`${this.baseUrl}/attendance/teacher-records`, { params: new HttpParams().set('date', date) });
  }
  getAttendanceRules(): Observable<AttendanceRules> {
    return this.http.get<AttendanceRules>(`${this.baseUrl}/attendance/rules`);
  }
  saveAttendanceRules(rules: AttendanceRules): Observable<AttendanceRules> {
    return this.http.put<AttendanceRules>(`${this.baseUrl}/attendance/rules`, rules);
  }

  getGradingTemplates(templateKey?: string): Observable<GradingTemplate[]> {
    let params = new HttpParams();
    if (templateKey?.trim()) params = params.set('templateKey', templateKey.trim());
    return this.http.get<GradingTemplate[]>(`${this.baseUrl}/grading/templates`, { params });
  }
  getGradingTemplateComponents(templateId: number): Observable<GradingComponent[]> {
    return this.http.get<GradingComponent[]>(`${this.baseUrl}/grading/templates/${templateId}/components`);
  }
  createGradingTemplate(body: {
    templateKey: string; versionNumber: number; name: string;
    components: Array<{ name: string; weightPercent: number; sortOrder: number }>;
  }): Observable<{ gradingTemplateId: number }> {
    return this.http.post<{ gradingTemplateId: number }>(`${this.baseUrl}/grading/templates`, body);
  }
  getGradingPeriods(filters: { schoolYearId?: number; gradeLevelId?: number } = {}): Observable<GradingPeriod[]> {
    let params = new HttpParams();
    if (filters.schoolYearId) params = params.set('schoolYearId', filters.schoolYearId);
    if (filters.gradeLevelId) params = params.set('gradeLevelId', filters.gradeLevelId);
    return this.http.get<GradingPeriod[]>(`${this.baseUrl}/grading/periods`, { params });
  }
  createGradingPeriod(body: {
    schoolYearId: number; gradeLevelId: number; gradingTemplateId: number; periodType: string;
    periodNumber: number; name: string; startsOn: string; endsOn: string;
  }): Observable<{ gradingPeriodId: number }> {
    return this.http.post<{ gradingPeriodId: number }>(`${this.baseUrl}/grading/periods`, body);
  }
  getGrades(periodId: number, sectionId?: number): Observable<GradeRecord[]> {
    let params = new HttpParams();
    if (sectionId) params = params.set('sectionId', sectionId);
    return this.http.get<GradeRecord[]>(`${this.baseUrl}/grading/periods/${periodId}/grades`, { params });
  }
  getGradingSections(periodId: number): Observable<GradingSection[]> {
    return this.http.get<GradingSection[]>(`${this.baseUrl}/grading/periods/${periodId}/sections`);
  }
  getGradingEntries(periodId: number, sectionId: number, page = 1): Observable<GradingEnrollment[]> {
    const params = new HttpParams().set('sectionId', sectionId).set('page', page);
    return this.http.get<GradingEnrollment[]>(`${this.baseUrl}/grading/periods/${periodId}/entries`, { params });
  }
  createGrade(body: { enrollmentId: number; sectionSubjectId: number; gradingPeriodId: number }): Observable<{ gradeRecordId: number; workflowStatus: string }> {
    return this.http.post<{ gradeRecordId: number; workflowStatus: string }>(`${this.baseUrl}/grading/grades`, body);
  }
  saveGradeScores(periodId: number, gradeRecordId: number,
    scores: Array<{ gradingTemplateComponentId: number; rawScore: number; maximumScore: number }>, reason?: string): Observable<GradeScoreResult> {
    return this.http.put<GradeScoreResult>(`${this.baseUrl}/grading/periods/${periodId}/grades/${gradeRecordId}/scores`, { scores, reason });
  }
  transitionGrade(gradeRecordId: number, newStatus: string, reason?: string): Observable<GradeTransitionResult> {
    return this.http.post<GradeTransitionResult>(`${this.baseUrl}/grading/grades/${gradeRecordId}/transitions`, { newStatus, reason });
  }

  getSettings(): Observable<SystemSetting[]> { return this.http.get<SystemSetting[]>(`${this.baseUrl}/system-settings`); }
  saveSetting(key: string, value: string, description?: string): Observable<SystemSetting> {
    return this.http.put<SystemSetting>(`${this.baseUrl}/system-settings`, { key, value, description: description ?? '' });
  }

  getDashboard(filters: { from: string; to: string; schoolYearId?: number }): Observable<DashboardSummary> {
    let params = new HttpParams().set('from', filters.from).set('to', filters.to);
    if (filters.schoolYearId) params = params.set('schoolYearId', filters.schoolYearId);
    return this.http.get<DashboardSummary>(`${this.baseUrl}/reports/dashboard/summary`, { params });
  }
  exportAttendance(filters: { from: string; to: string; sectionId?: number; schoolYearId?: number }, format: 'csv' | 'html'): Observable<Blob> {
    let params = new HttpParams().set('from', filters.from).set('to', filters.to).set('format', format);
    if (filters.sectionId) params = params.set('sectionId', filters.sectionId);
    if (filters.schoolYearId) params = params.set('schoolYearId', filters.schoolYearId);
    return this.http.get(`${this.baseUrl}/reports/attendance-summary/export`, { params, responseType: 'blob' });
  }
  exportEnrollment(schoolYearId: number | undefined, format: 'csv' | 'html'): Observable<Blob> {
    let params = new HttpParams().set('format', format);
    if (schoolYearId) params = params.set('schoolYearId', schoolYearId);
    return this.http.get(`${this.baseUrl}/reports/enrollment-summary/export`, { params, responseType: 'blob' });
  }
}
