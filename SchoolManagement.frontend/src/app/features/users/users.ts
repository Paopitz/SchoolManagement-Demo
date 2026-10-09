import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ManagedRole, ManagedUser, TeacherProfile } from '../../core/models/phase3.models';
import { AuthService } from '../../core/services/auth.service';
import { Phase3ApiService } from '../../core/services/phase3-api.service';
import { apiErrorMessage } from '../../core/utils/api-error-message';

@Component({ selector: 'app-users', standalone: true, imports: [FormsModule], templateUrl: './users.html', styleUrl: './users.scss' })
export class UsersPage implements OnInit {
  private readonly api = inject(Phase3ApiService);
  private readonly auth = inject(AuthService);
  readonly canManagePrivilegedRoles = () => this.auth.hasAnyRole(['Super Admin']);
  readonly users = signal<ManagedUser[]>([]);
  readonly roles = signal<ManagedRole[]>([]);
  readonly teachers = signal<TeacherProfile[]>([]);
  readonly page = signal(1);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  search = '';
  activeFilter: boolean | null = null;
  editing: ManagedUser | null = null;
  username = ''; email = ''; teacherId: number | null = null; password = ''; isActive = true;
  selectedRoleIds: number[] = [];

  ngOnInit(): void {
    this.load();
    this.api.getRoles().subscribe({ next: (roles) => this.roles.set(roles), error: (error) => this.showError(error) });
    this.api.getTeachers().subscribe({ next: (teachers) => this.teachers.set(teachers), error: (error) => this.showError(error) });
  }

  load(page = this.page()): void {
    this.loading.set(true); this.page.set(page);
    this.api.getUsers(page, this.search, this.activeFilter).subscribe({
      next: (response) => { this.users.set(response.items); this.totalCount.set(response.totalCount); this.loading.set(false); },
      error: (error) => { this.loading.set(false); this.showError(error); },
    });
  }

  edit(user: ManagedUser): void {
    this.editing = user; this.username = user.username; this.email = user.email ?? ''; this.teacherId = user.teacherId;
    this.isActive = user.isActive; this.password = '';
    this.selectedRoleIds = this.roles().filter((role) => user.roles.includes(role.name)).map((role) => role.roleId);
  }

  resetForm(): void { this.editing = null; this.username = ''; this.email = ''; this.teacherId = null; this.password = ''; this.isActive = true; this.selectedRoleIds = []; }

  toggleRole(roleId: number, checked: boolean): void {
    this.selectedRoleIds = checked ? [...new Set([...this.selectedRoleIds, roleId])] : this.selectedRoleIds.filter((id) => id !== roleId);
    if (!this.hasTeacherRole()) this.teacherId = null;
  }

  hasTeacherRole(): boolean { return this.roles().some((role) => role.name === 'Teacher' && this.selectedRoleIds.includes(role.roleId)); }
  teacherChoices(): TeacherProfile[] {
    return this.teachers().filter((teacher) => teacher.isActive || teacher.teacherId === this.teacherId)
      .filter((teacher) => teacher.linkedUserId === null || teacher.linkedUserId === this.editing?.userId);
  }
  teacherName(teacherId: number | null): string {
    if (teacherId === null) return 'Not linked';
    const teacher = this.teachers().find((item) => item.teacherId === teacherId);
    return teacher ? `${teacher.firstName} ${teacher.lastName} (${teacher.employeeNumber})` : 'Profile unavailable';
  }

  roleAllowed(role: ManagedRole): boolean { return role.name !== 'Super Admin' || this.canManagePrivilegedRoles(); }
  canEditUser(user: ManagedUser): boolean { return !user.roles.includes('Super Admin') || this.canManagePrivilegedRoles(); }
  maxPage(): number { return Math.max(1, Math.ceil(this.totalCount() / 20)); }

  save(): void {
    this.error.set(''); this.notice.set('');
    if (!this.username.trim()) { this.error.set('Username is required.'); return; }
    if (!this.editing && this.password.length < 8) { this.error.set('Initial password must be at least 8 characters.'); return; }
    if (this.hasTeacherRole() && this.teacherId === null) { this.error.set('Select a teacher profile before assigning the Teacher role.'); return; }
    this.saving.set(true);
    if (!this.editing) {
      this.api.createUser({ username: this.username.trim(), email: this.email.trim() || null, initialPassword: this.password, teacherId: this.hasTeacherRole() ? this.teacherId : null, isActive: this.isActive, roleIds: this.selectedRoleIds }).subscribe({
        next: () => this.finish('User account created.'), error: (error) => this.fail(error),
      });
      return;
    }

    const user = this.editing;
    this.api.updateUser(user.userId, { username: this.username.trim(), email: this.email.trim() || null, teacherId: this.hasTeacherRole() ? this.teacherId : null, isActive: this.isActive, newPassword: this.password || null }).subscribe({
      next: () => this.api.replaceUserRoles(user.userId, this.selectedRoleIds).subscribe({
        next: () => this.finish('User account updated.'),
        error: (error) => this.fail(error, 'Account details saved, but roles were not updated.'),
      }),
      error: (error) => this.fail(error),
    });
  }

  private finish(message: string): void { this.saving.set(false); this.notice.set(message); this.resetForm(); this.load(); }
  private fail(error: unknown, prefix = ''): void { this.saving.set(false); this.showError(error, prefix); }
  private showError(error: unknown, prefix = ''): void {
    this.error.set([prefix, apiErrorMessage(error)].filter(Boolean).join(' '));
  }
}