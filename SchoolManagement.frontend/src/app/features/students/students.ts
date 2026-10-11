import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { Phase3ApiService } from '../../core/services/phase3-api.service';
import { StudentRecord } from '../../core/models/phase3.models';
import { apiErrorMessage } from '../../core/utils/api-error-message';

@Component({ selector: 'app-students', standalone: true, imports: [FormsModule, RouterLink], templateUrl: './students.html', styleUrl: './students.scss' })
export class StudentsPage implements OnInit {
  private readonly api = inject(Phase3ApiService);
  private readonly auth = inject(AuthService);
  readonly canWrite = () => this.auth.hasPermission('students.write');
  readonly canOpenApplications = () => this.auth.hasPermission('enrollment.read');
  readonly students = signal<StudentRecord[]>([]);
  readonly page = signal(1);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  search = '';
  statusFilter = '';
  editingId = 0;
  studentNumber = ''; lrn = ''; firstName = ''; middleName = ''; lastName = ''; suffix = ''; birthDate = ''; status = 'Active';
  readonly statuses = ['Active', 'Inactive', 'Transferred', 'Dropped', 'Graduated', 'Archived'];
  allowedEditStatuses(): string[] { return this.status === 'Transferred' || this.status === 'Dropped' ? [this.status] : ['Active', 'Inactive', 'Graduated', 'Archived']; }

  ngOnInit(): void { this.load(); }

  load(page = this.page()): void {
    this.loading.set(true); this.error.set(''); this.page.set(page);
    this.api.getStudents(page, this.search, this.statusFilter).subscribe({
      next: (response) => { this.students.set(response.items); this.totalCount.set(response.totalCount); this.loading.set(false); },
      error: (error) => { this.loading.set(false); this.showError(error); },
    });
  }

  searchChanged(): void { this.load(1); }

  edit(student: StudentRecord): void {
    this.editingId = student.studentId;
    this.studentNumber = student.studentNumber; this.lrn = student.lrn ?? ''; this.firstName = student.firstName;
    this.middleName = student.middleName ?? ''; this.lastName = student.lastName; this.suffix = student.suffix ?? '';
    this.birthDate = student.birthDate ?? ''; this.status = student.status;
  }

  resetForm(): void {
    this.editingId = 0; this.studentNumber = ''; this.lrn = ''; this.firstName = ''; this.middleName = '';
    this.lastName = ''; this.suffix = ''; this.birthDate = ''; this.status = 'Active';
  }

  save(): void {
    if (!this.editingId || !this.canWrite()) {
      this.error.set('Select an existing student to edit. New students are registered automatically after enrollment application approval.');
      return;
    }
    this.error.set(''); this.notice.set(''); this.saving.set(true);
    const payload = {
      studentNumber: this.studentNumber.trim(), lrn: this.lrn.trim() || null, firstName: this.firstName.trim(),
      middleName: this.middleName.trim() || null, lastName: this.lastName.trim(), suffix: this.suffix.trim() || null,
      birthDate: this.birthDate || null,
    };
    const request = this.api.updateStudent(this.editingId, { ...payload, status: this.status });
    request.subscribe({
      next: () => { this.saving.set(false); this.notice.set('Student record updated.'); this.resetForm(); this.load(); },
      error: (error) => { this.saving.set(false); this.showError(error); },
    });
  }

  fullName(student: StudentRecord): string { return [student.firstName, student.middleName, student.lastName, student.suffix].filter(Boolean).join(' '); }
  maxPage(): number { return Math.max(1, Math.ceil(this.totalCount() / 20)); }
  private showError(error: unknown): void { this.error.set(apiErrorMessage(error)); }
}