import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApplicationDto, HealthDto } from './enrollment-application.contracts';
import { AcademicReview, ApplicationDetail, DocumentKind, ExternalGrade, HealthProfile, PortalOptions, StudentProfile } from './enrollment-application.models';
import { fromApplicationDto, fromHealthDto, toCreateDto, toHealthDto, toProfileDto } from './enrollment-application.mapper';

/** Parent supplies school-approved public options from the agreed backend configuration API. */
export const ENROLLMENT_PORTAL_OPTIONS_LOADER = new InjectionToken<() => Observable<PortalOptions>>('ENROLLMENT_PORTAL_OPTIONS_LOADER');
export const documentKind = (kind: DocumentKind) => kind === 'PSA' || kind === 'LiveBirth' ? 'BirthCertificate' : kind;

@Injectable({ providedIn: 'root' })
export class EnrollmentApplicationApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/enrollment-applications`;
  linkStudent(studentId: number, email: string, reason: string): Observable<unknown> {
    return this.http.post(`${this.base}/link-student`, { studentId, email, reason });
  }
  list(page: number, status: string, schoolYearId: number | null): Observable<ApplicationDetail[]> {
    let params = new HttpParams().set('page', page).set('pageSize', 25);
    if (status) params = params.set('status', status);
    if (schoolYearId) params = params.set('schoolYearId', schoolYearId);
    return this.http.get<ApplicationDto[]>(this.base, { params }).pipe(map(items => items.map(fromApplicationDto)));
  }
  get(id: string): Observable<ApplicationDetail> { return this.http.get<ApplicationDto>(`${this.base}/${id}`).pipe(map(fromApplicationDto)); }
  create(profile: StudentProfile): Observable<ApplicationDetail> { return this.http.post<ApplicationDto>(this.base, toCreateDto(profile)).pipe(map(fromApplicationDto)); }
  update(detail: ApplicationDetail, profile: StudentProfile): Observable<ApplicationDetail> {
    return this.http.put<ApplicationDto>(`${this.base}/${detail.id}/profile`, { expectedVersion: detail.version, profile: toProfileDto(profile) }).pipe(map(fromApplicationDto));
  }
  resolveLrn(detail: ApplicationDetail, lrn: string, reason: string): Observable<ApplicationDetail> {
    return this.post(detail, 'resolve-lrn', { lrn, reason });
  }
  health(id: string): Observable<HealthProfile | null> { return this.http.get<HealthDto | null>(`${this.base}/${id}/health`).pipe(map(fromHealthDto)); }
  saveHealth(id: string, health: HealthProfile): Observable<unknown> { return this.http.put(`${this.base}/${id}/health`, toHealthDto(health)); }
  upload(id: string, kind: DocumentKind, file: File): Observable<ApplicationDetail> {
    const body = new FormData(); body.append('file', file);
    return this.http.post<ApplicationDto>(`${this.base}/${id}/documents/${documentKind(kind)}`, body).pipe(map(fromApplicationDto));
  }
  download(id: string, documentId: number): Observable<Blob> { return this.http.get(`${this.base}/${id}/documents/${documentId}`, { responseType: 'blob' }); }
  physical(detail: ApplicationDetail, kind: DocumentKind, remarks: string): Observable<ApplicationDetail> {
    return this.post(detail, 'documents/physical', { kind: documentKind(kind), remarks });
  }
  reviewDocument(detail: ApplicationDetail, documentId: number, verified: boolean, remarks: string): Observable<ApplicationDetail> {
    return this.post(detail, `documents/${documentId}/review`, { verified, remarks });
  }
  previousGrades(detail: ApplicationDetail, grades: ExternalGrade[], evidenceRemarks: string): Observable<ApplicationDetail> {
    return this.http.put<ApplicationDto>(`${this.base}/${detail.id}/previous-grades`, {
      expectedVersion: detail.version, evidenceRemarks,
      grades: grades.map(v => ({ subjectName: v.subject, grade: v.grade, outcome: v.outcome, remarks: v.remarks || null })),
    }).pipe(map(fromApplicationDto));
  }
  academicReview(detail: ApplicationDetail, review: AcademicReview, grades: ExternalGrade[]): Observable<ApplicationDetail> {
    return this.post(detail, 'academic-review', {
      decision: review.decision, remarks: review.studentVisibleRemarks, internalNotes: review.internalRemarks || null,
      subjects: grades.map(v => ({ evidenceId: v.evidenceId, outcome: v.outcome, remarks: v.remarks || null })),
    });
  }
  approve(detail: ApplicationDetail, sectionId: number, sectionSubjectIds: number[], reason: string): Observable<ApplicationDetail> {
    return this.post(detail, 'approve', { sectionId, sectionSubjectIds, reason });
  }
  status(detail: ApplicationDetail, status: string, reason: string): Observable<ApplicationDetail> { return this.post(detail, 'status', { status, reason }); }
  private post(detail: ApplicationDetail, path: string, body: object): Observable<ApplicationDetail> {
    return this.http.post<ApplicationDto>(`${this.base}/${detail.id}/${path}`, { expectedVersion: detail.version, ...body }).pipe(map(fromApplicationDto));
  }
}
