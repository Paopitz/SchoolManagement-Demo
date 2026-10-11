import { HttpBackend, HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApplicationDto, GradeSummaryDto, HealthDto } from '../enrollment-applications/enrollment-application.contracts';
import { ApplicationDetail, DocumentKind, HealthProfile, OfficialHistory, OwnGradeSummary, StudentProfile } from '../enrollment-applications/enrollment-application.models';
import { fromApplicationDto, fromHealthDto, toCreateDto, toHealthDto, toProfileDto } from '../enrollment-applications/enrollment-application.mapper';
import { documentKind } from '../enrollment-applications/enrollment-application-api.service';

@Injectable({ providedIn: 'root' })
export class StudentPortalApiService {
  // Deliberately bypasses the staff JWT/refresh interceptor, including when staff are signed in.
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly base = `${environment.apiBaseUrl}/student-portal`;
  private sessionToken = '';
  readonly expiresAt = signal('');
  readonly authenticated = signal(false);
  readonly email = signal('');
  requestCode(email: string): Observable<{ message: string }> { return this.http.post<{ message: string }>(`${this.base}/email/request`, { email }); }
  verifyCode(email: string, code: string): Observable<{ expiresAtUtc: string }> {
    return this.http.post<{ sessionToken: string; expiresAtUtc: string }>(`${this.base}/email/verify`, { email, code }).pipe(tap(result => {
      this.sessionToken = result.sessionToken; this.expiresAt.set(result.expiresAtUtc); this.email.set(email); this.authenticated.set(true);
    }), map(result => ({ expiresAtUtc: result.expiresAtUtc })));
  }
  logout(): Observable<unknown> {
    const request = this.http.delete(`${this.base}/session`, { headers: this.headers() });
    return request.pipe(tap(() => this.clearSession()));
  }
  clearSession(): void { this.sessionToken = ''; this.email.set(''); this.expiresAt.set(''); this.authenticated.set(false); }
  me(): Observable<{ email: string; studentId: number | null; mobileVerified: boolean }> { return this.http.get<{ email: string; studentId: number | null; mobileVerified: boolean }>(`${this.base}/me`, { headers: this.headers() }); }
  applications(): Observable<ApplicationDetail[]> { return this.http.get<ApplicationDto[]>(`${this.base}/applications`, { headers: this.headers() }).pipe(map(items => items.map(fromApplicationDto))); }
  get(id: string): Observable<ApplicationDetail> { return this.http.get<ApplicationDto>(`${this.base}/applications/${id}`, { headers: this.headers() }).pipe(map(fromApplicationDto)); }
  create(profile: StudentProfile): Observable<ApplicationDetail> {
    return this.http.post<ApplicationDto>(`${this.base}/applications`, toCreateDto(profile), { headers: this.headers() }).pipe(map(fromApplicationDto));
  }
  update(detail: ApplicationDetail, profile: StudentProfile): Observable<ApplicationDetail> {
    return this.http.put<ApplicationDto>(`${this.base}/applications/${detail.id}/profile`, { expectedVersion: detail.version, profile: toProfileDto(profile) }, { headers: this.headers() }).pipe(map(fromApplicationDto));
  }
  health(id: string): Observable<HealthProfile | null> { return this.http.get<HealthDto | null>(`${this.base}/applications/${id}/health`, { headers: this.headers() }).pipe(map(fromHealthDto)); }
  saveHealth(id: string, health: HealthProfile): Observable<unknown> { return this.http.put(`${this.base}/applications/${id}/health`, toHealthDto(health), { headers: this.headers() }); }
  upload(id: string, kind: DocumentKind, file: File): Observable<ApplicationDetail> {
    const body = new FormData(); body.append('file', file);
    return this.http.post<ApplicationDto>(`${this.base}/applications/${id}/documents/${documentKind(kind)}`, body, { headers: this.headers() }).pipe(map(fromApplicationDto));
  }
  download(id: string, documentId: number): Observable<Blob> { return this.http.get(`${this.base}/applications/${id}/documents/${documentId}`, { headers: this.headers(), responseType: 'blob' }); }
  withdraw(detail: ApplicationDetail, reason: string): Observable<ApplicationDetail> {
    return this.http.post<ApplicationDto>(`${this.base}/applications/${detail.id}/withdraw`, { expectedVersion: detail.version, reason }, { headers: this.headers() }).pipe(map(fromApplicationDto));
  }
  grades(): Observable<OwnGradeSummary> {
    return this.http.get<GradeSummaryDto>(`${this.base}/grades`, { headers: this.headers() }).pipe(map(d => ({
      title: d.title, studentName: d.student ? `${d.student.firstName} ${d.student.lastName}` : '', lrn: d.student?.lrn ?? '', generatedAt: d.generatedAtUtc,
      grades: d.grades.map(v => ({ subject: v.subjectName, grade: v.grade, schoolYear: v.schoolYear ?? '', gradeLevel: v.gradeLevel ?? '', gradingPeriod: v.gradingPeriod ?? '', remarks: v.remarks ?? '' })),
    })));
  }
  enrollments(): Observable<OfficialHistory[]> { return this.http.get<OfficialHistory[]>(`${this.base}/enrollments`, { headers: this.headers() }); }
  private headers(): HttpHeaders { return this.sessionToken ? new HttpHeaders({ 'X-Portal-Session': this.sessionToken }) : new HttpHeaders(); }
}
