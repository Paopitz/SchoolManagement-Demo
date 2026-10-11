import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Enrollment, SchoolYear, Section, SectionSubject, Student } from '../../core/models/phase2.models';
import { Phase2ApiService } from '../../core/services/phase2-api.service';
import { apiErrorMessage } from '../../core/utils/api-error-message';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-enrollment',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './enrollment.html',
  styleUrl: './enrollment.scss',
})
export class EnrollmentPage implements OnInit {
  private readonly api = inject(Phase2ApiService);
  private readonly auth = inject(AuthService);
  readonly canWrite = () => this.auth.hasPermission('enrollment.write');
  readonly canConfirm = () => this.auth.hasPermission('enrollment.confirm');
  readonly enrollments = signal<Enrollment[]>([]);
  readonly students = signal<Student[]>([]);
  readonly schoolYears = signal<SchoolYear[]>([]);
  readonly sections = signal<Section[]>([]);
  readonly offerings = signal<SectionSubject[]>([]);
  readonly history = signal<Enrollment[] | null>(null);
  readonly enrollmentPage = signal(1);
  readonly enrollmentTotal = signal(0);
  readonly studentPage = signal(1);
  readonly studentTotal = signal(0);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  search = '';
  studentSearch = '';
  selectedStudentId = 0;
  schoolYearId = 0;
  sectionId = 0;
  enrollmentType = 'New';
  statusFilter = '';
  yearFilter = 0;
  sectionFilter = 0;
  actionReason = '';
  activeActionId = 0;
  selectedSubjectIds: number[] = [];
  editingEnrollmentId = 0;

  ngOnInit(): void {
    this.loadLookups();
    this.loadEnrollments();
  }

  loadLookups(): void {
    this.api.getSchoolYears().subscribe({ next: (items) => {
      this.schoolYears.set(items);
      const active = items.find((item) => item.isActive);
      if (active) { this.schoolYearId = active.schoolYearId; this.loadSections(); }
    }, error: (e) => this.showError(e) });
  }

  loadEnrollments(): void {
    this.loading.set(true); this.error.set('');
    this.api.getEnrollments({ schoolYearId: this.yearFilter || undefined, sectionId: this.sectionFilter || undefined, status: this.statusFilter || undefined, page: this.enrollmentPage() }).subscribe({
      next: (response) => { this.enrollments.set(response.items); this.enrollmentTotal.set(response.totalCount); this.loading.set(false); },
      error: (e) => { this.showError(e); this.loading.set(false); },
    });
  }

  loadStudents(page = 1): void {
    this.error.set('');
    this.studentPage.set(page);
    this.api.getStudents(this.studentSearch, page).subscribe({ next: (response) => { this.students.set(response.items); this.studentTotal.set(response.totalCount); }, error: (e) => this.showError(e) });
  }

  loadSections(): void {
    if (!this.schoolYearId) return;
    this.sectionId = 0; this.offerings.set([]);
    this.api.getSections(this.schoolYearId).subscribe({ next: (items) => this.sections.set(items), error: (e) => this.showError(e) });
  }

  loadOfferings(): void {
    this.selectedSubjectIds = [];
    if (!this.sectionId) { this.offerings.set([]); return; }
    this.api.getSectionSubjects(this.sectionId).subscribe({
      next: (items) => { const active = items.filter((item) => item.isActive); this.offerings.set(active); this.selectedSubjectIds = active.map((item) => item.sectionSubjectId); },
      error: (e) => this.showError(e),
    });
  }

  toggleSubject(id: number, checked: boolean): void {
    this.selectedSubjectIds = checked ? [...this.selectedSubjectIds, id] : this.selectedSubjectIds.filter((item) => item !== id);
  }

  createEnrollment(): void {
    this.error.set(''); this.notice.set('');
    if ((!this.editingEnrollmentId && !this.selectedStudentId) || !this.schoolYearId || !this.sectionId) { this.error.set('Choose a student, school year, and section.'); return; }
    this.saving.set(true);
    const request = this.editingEnrollmentId
      ? this.api.updateEnrollment(this.editingEnrollmentId, { sectionId: this.sectionId, enrollmentType: this.enrollmentType, sectionSubjectIds: this.selectedSubjectIds })
      : this.api.createEnrollment({ studentId: this.selectedStudentId, schoolYearId: this.schoolYearId, sectionId: this.sectionId, enrollmentType: this.enrollmentType, sectionSubjectIds: this.selectedSubjectIds });
    request.subscribe({
      next: () => { this.saving.set(false); this.notice.set(this.editingEnrollmentId ? 'Pending enrollment updated.' : 'Pending enrollment created.'); this.editingEnrollmentId = 0; this.selectedStudentId = 0; this.loadEnrollments(); },
      error: (e) => { this.saving.set(false); this.showError(e); },
    });
  }

  editEnrollment(enrollment: Enrollment): void {
    this.editingEnrollmentId = enrollment.enrollmentId;
    this.schoolYearId = enrollment.schoolYearId;
    this.sectionId = enrollment.sectionId;
    this.enrollmentType = enrollment.enrollmentType;
    this.selectedSubjectIds = enrollment.subjects.map((subject) => subject.sectionSubjectId);
    this.api.getSections(this.schoolYearId).subscribe({ next: (rows) => this.sections.set(rows), error: (e) => this.showError(e) });
    this.api.getSectionSubjects(enrollment.sectionId).subscribe({ next: (rows) => this.offerings.set(rows.filter((item) => item.isActive)), error: (e) => this.showError(e) });
  }

  cancelEdit(): void { this.editingEnrollmentId = 0; this.selectedSubjectIds = []; this.offerings.set([]); }

  changeEnrollmentPage(delta: number): void {
    const nextPage = this.enrollmentPage() + delta;
    if (nextPage < 1 || nextPage > Math.ceil(this.enrollmentTotal() / 25)) return;
    this.enrollmentPage.set(nextPage);
    this.loadEnrollments();
  }

  filterChanged(): void { this.enrollmentPage.set(1); this.loadEnrollments(); }
  maxEnrollmentPage(): number { return Math.max(1, Math.ceil(this.enrollmentTotal() / 25)); }

  openHistory(studentId: number): void {
    this.error.set(''); this.history.set(null);
    this.api.getEnrollmentHistory(studentId).subscribe({ next: (result) => this.history.set(result.enrollments), error: (e) => this.showError(e) });
  }

  act(enrollment: Enrollment, action: 'confirm' | 'cancel' | 'transfer' | 'drop'): void {
    this.error.set(''); this.notice.set('');
    if (action !== 'confirm' && !this.actionReason.trim()) { this.activeActionId = enrollment.enrollmentId; this.error.set('Enter a reason before applying this status change.'); return; }
    this.saving.set(true);
    this.api.enrollmentAction(enrollment.enrollmentId, action, this.actionReason.trim()).subscribe({
      next: () => { this.saving.set(false); this.notice.set(`Enrollment ${action}ed.`); this.activeActionId = 0; this.actionReason = ''; this.loadEnrollments(); },
      error: (e) => { this.saving.set(false); this.showError(e); },
    });
  }

  studentName(student: Student): string { return [student.firstName, student.middleName, student.lastName, student.suffix].filter(Boolean).join(' '); }
  private showError(error: unknown): void { this.error.set(apiErrorMessage(error)); }
}