import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TeacherProfile } from '../../core/models/phase3.models';
import { AuthService } from '../../core/services/auth.service';
import { Phase3ApiService } from '../../core/services/phase3-api.service';
import { apiErrorMessage } from '../../core/utils/api-error-message';

@Component({
  selector: 'app-teachers',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './teachers.html',
  styleUrl: './teachers.scss',
})
export class TeachersPage implements OnInit {
  private readonly api = inject(Phase3ApiService);
  private readonly auth = inject(AuthService);
  readonly canWrite = () => this.auth.hasAnyRole(['Super Admin', 'Admin']);
  readonly teachers = signal<TeacherProfile[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  editingId = 0;
  employeeNumber = '';
  firstName = '';
  lastName = '';
  isActive = true;

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.getTeachers().subscribe({
      next: (teachers) => { this.teachers.set(teachers); this.loading.set(false); },
      error: (error) => { this.loading.set(false); this.showError(error); },
    });
  }

  edit(teacher: TeacherProfile): void {
    this.editingId = teacher.teacherId;
    this.employeeNumber = teacher.employeeNumber;
    this.firstName = teacher.firstName;
    this.lastName = teacher.lastName;
    this.isActive = teacher.isActive;
  }

  resetForm(): void {
    this.editingId = 0;
    this.employeeNumber = '';
    this.firstName = '';
    this.lastName = '';
    this.isActive = true;
  }

  save(): void {
    this.error.set('');
    this.notice.set('');
    this.saving.set(true);
    const editing = this.editingId > 0;
    const request = editing
      ? this.api.updateTeacher(this.editingId, this.payload())
      : this.api.createTeacher(this.payload());
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.notice.set(editing ? 'Teacher profile updated.' : 'Teacher profile created.');
        this.resetForm();
        this.load();
      },
      error: (error) => { this.saving.set(false); this.showError(error); },
    });
  }

  fullName(teacher: TeacherProfile): string { return `${teacher.firstName} ${teacher.lastName}`; }

  private payload(): { employeeNumber: string; firstName: string; lastName: string; isActive: boolean } {
    return {
      employeeNumber: this.employeeNumber.trim(),
      firstName: this.firstName.trim(),
      lastName: this.lastName.trim(),
      isActive: this.isActive,
    };
  }

  private showError(error: unknown): void { this.error.set(apiErrorMessage(error)); }
}
