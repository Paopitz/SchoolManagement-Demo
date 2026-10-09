import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Department,
  Enrollment,
  EnrollmentHistory,
  GradeLevel,
  PagedResponse,
  Room,
  ScheduleEntry,
  SchoolYear,
  Section,
  SectionSubject,
  Strand,
  Student,
  Subject,
  Track,
} from '../models/phase2.models';

@Injectable({ providedIn: 'root' })
export class Phase2ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  getStudents(search: string, page = 1): Observable<PagedResponse<Student>> {
    let params = new HttpParams().set('page', page).set('pageSize', 20);
    if (search.trim()) params = params.set('search', search.trim());
    return this.http.get<PagedResponse<Student>>(`${this.baseUrl}/students`, { params });
  }

  getEnrollments(filters: { schoolYearId?: number; sectionId?: number; studentId?: number; status?: string; page?: number } = {}): Observable<PagedResponse<Enrollment>> {
    let params = new HttpParams().set('page', filters.page ?? 1).set('pageSize', 25);
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && key !== 'page' && value !== '') params = params.set(key, value);
    }
    return this.http.get<PagedResponse<Enrollment>>(`${this.baseUrl}/enrollments`, { params });
  }

  getEnrollmentHistory(studentId: number): Observable<EnrollmentHistory> {
    return this.http.get<EnrollmentHistory>(`${this.baseUrl}/students/${studentId}/enrollment-history`);
  }

  createEnrollment(body: { studentId: number; schoolYearId: number; sectionId: number; enrollmentType: string; sectionSubjectIds: number[] }): Observable<Enrollment> {
    return this.http.post<Enrollment>(`${this.baseUrl}/enrollments`, body);
  }

  updateEnrollment(id: number, body: { sectionId: number; enrollmentType: string; sectionSubjectIds: number[] }): Observable<Enrollment> {
    return this.http.put<Enrollment>(`${this.baseUrl}/enrollments/${id}`, body);
  }

  enrollmentAction(id: number, action: 'confirm' | 'cancel' | 'transfer' | 'drop', reason?: string): Observable<Enrollment> {
    const body = action === 'confirm' ? {} : { reason };
    return this.http.post<Enrollment>(`${this.baseUrl}/enrollments/${id}/${action}`, body);
  }

  getSchoolYears(): Observable<SchoolYear[]> { return this.http.get<SchoolYear[]>(`${this.baseUrl}/academic/school-years`); }
  getDepartments(): Observable<Department[]> { return this.http.get<Department[]>(`${this.baseUrl}/academic/departments`); }
  getGradeLevels(): Observable<GradeLevel[]> { return this.http.get<GradeLevel[]>(`${this.baseUrl}/academic/grade-levels`); }
  getSubjects(): Observable<Subject[]> { return this.http.get<Subject[]>(`${this.baseUrl}/academic/subjects`); }
  getRooms(): Observable<Room[]> { return this.http.get<Room[]>(`${this.baseUrl}/academic/rooms`); }
  getTracks(): Observable<Track[]> { return this.http.get<Track[]>(`${this.baseUrl}/academic/tracks`); }
  getStrands(): Observable<Strand[]> { return this.http.get<Strand[]>(`${this.baseUrl}/academic/strands`); }

  createSchoolYear(body: { code: string; startsOn: string; endsOn: string }): Observable<SchoolYear> { return this.http.post<SchoolYear>(`${this.baseUrl}/academic/school-years`, body); }
  updateSchoolYear(id: number, body: { code: string; startsOn: string; endsOn: string }): Observable<SchoolYear> { return this.http.put<SchoolYear>(`${this.baseUrl}/academic/school-years/${id}`, body); }
  activateSchoolYear(id: number): Observable<void> { return this.http.post<void>(`${this.baseUrl}/academic/school-years/${id}/activate`, {}); }
  createDepartment(body: { name: string }): Observable<Department> { return this.http.post<Department>(`${this.baseUrl}/academic/departments`, body); }
  updateDepartment(id: number, body: { name: string; isActive: boolean }): Observable<Department> { return this.http.put<Department>(`${this.baseUrl}/academic/departments/${id}`, body); }
  createGradeLevel(body: { departmentId: number; code: string; name: string; sortOrder: number }): Observable<GradeLevel> { return this.http.post<GradeLevel>(`${this.baseUrl}/academic/grade-levels`, body); }
  updateGradeLevel(id: number, body: { code: string; name: string; sortOrder: number }): Observable<GradeLevel> { return this.http.put<GradeLevel>(`${this.baseUrl}/academic/grade-levels/${id}`, body); }
  createSubject(body: { code: string; name: string }): Observable<Subject> { return this.http.post<Subject>(`${this.baseUrl}/academic/subjects`, body); }
  updateSubject(id: number, body: { code: string; name: string; isActive: boolean }): Observable<Subject> { return this.http.put<Subject>(`${this.baseUrl}/academic/subjects/${id}`, body); }
  createRoom(body: { code: string; name: string; capacity: number | null }): Observable<Room> { return this.http.post<Room>(`${this.baseUrl}/academic/rooms`, body); }
  updateRoom(id: number, body: { code: string; name: string; capacity: number | null; isActive: boolean }): Observable<Room> { return this.http.put<Room>(`${this.baseUrl}/academic/rooms/${id}`, body); }
  createTrack(body: { name: string }): Observable<Track> { return this.http.post<Track>(`${this.baseUrl}/academic/tracks`, body); }
  updateTrack(id: number, body: { name: string; isActive: boolean }): Observable<Track> { return this.http.put<Track>(`${this.baseUrl}/academic/tracks/${id}`, body); }
  createStrand(body: { trackId: number; code: string; name: string }): Observable<Strand> { return this.http.post<Strand>(`${this.baseUrl}/academic/strands`, body); }
  updateStrand(id: number, body: { code: string; name: string }): Observable<Strand> { return this.http.put<Strand>(`${this.baseUrl}/academic/strands/${id}`, body); }

  getSections(schoolYearId?: number): Observable<Section[]> {
    let params = new HttpParams();
    if (schoolYearId) params = params.set('schoolYearId', schoolYearId);
    return this.http.get<Section[]>(`${this.baseUrl}/sections`, { params });
  }

  createSection(body: { schoolYearId: number; gradeLevelId: number; strandId?: number | null; name: string; adviserTeacherId: number | null }): Observable<Section> {
    return this.http.post<Section>(`${this.baseUrl}/sections`, body);
  }

  updateSection(id: number, body: { name: string; strandId: number | null; adviserTeacherId: number | null }): Observable<Section> {
    return this.http.put<Section>(`${this.baseUrl}/sections/${id}`, body);
  }

  getSectionSubjects(sectionId: number): Observable<SectionSubject[]> {
    return this.http.get<SectionSubject[]>(`${this.baseUrl}/sections/${sectionId}/subjects`);
  }

  assignSectionSubject(sectionId: number, body: { subjectId: number; teacherId: number | null }): Observable<SectionSubject> {
    return this.http.post<SectionSubject>(`${this.baseUrl}/sections/${sectionId}/subjects`, body);
  }

  updateSectionSubject(sectionId: number, offeringId: number, body: { teacherId: number | null; isActive: boolean }): Observable<SectionSubject> {
    return this.http.put<SectionSubject>(`${this.baseUrl}/sections/${sectionId}/subjects/${offeringId}`, body);
  }

  getSchedules(sectionId?: number): Observable<ScheduleEntry[]> {
    let params = new HttpParams();
    if (sectionId) params = params.set('sectionId', sectionId);
    return this.http.get<ScheduleEntry[]>(`${this.baseUrl}/schedules`, { params });
  }

  createSchedule(body: { sectionSubjectId: number; roomId: number | null; dayOfWeek: number; startTime: string; endTime: string }): Observable<ScheduleEntry> {
    return this.http.post<ScheduleEntry>(`${this.baseUrl}/schedules`, body);
  }

  updateSchedule(id: number, body: { roomId: number | null; dayOfWeek: number; startTime: string; endTime: string }): Observable<ScheduleEntry> {
    return this.http.put<ScheduleEntry>(`${this.baseUrl}/schedules/${id}`, body);
  }

  deleteSchedule(id: number): Observable<void> { return this.http.delete<void>(`${this.baseUrl}/schedules/${id}`); }
}