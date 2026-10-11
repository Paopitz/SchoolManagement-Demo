import { Injectable, inject } from '@angular/core';
import { ManagedUser } from '../models/phase3.models';
import { DemoData } from './demo-data';

export const DEMO_PERMISSION_CODES = [
  'reports.read', 'students.read', 'students.write', 'students.health.read', 'students.health.write',
  'enrollment.read', 'enrollment.write', 'enrollment.confirm', 'enrollment.documents.review',
  'enrollment.academic.review', 'enrollment.previous-grades.write', 'enrollment.exceptions.approve',
  'academic.read', 'academic.write', 'schedule.read', 'schedule.write', 'attendance.read', 'attendance.write',
  'grading.read', 'grading.write', 'users.manage', 'users.roles.manage', 'system-settings.read',
  'system-settings.write', 'roles.permissions.manage',
] as const;

/** Mutable fictional grants, shared by all local endpoints. Never reconstructed on a request. */
@Injectable({ providedIn: 'root' })
export class DemoPermissions {
  private readonly data = inject(DemoData);
  readonly audit: { roleId: number; actor: string; reason: string; before: string[]; after: string[] }[] = [];
  readonly grants = new Map(this.data.roles.map(role => {
    let codes: string[] = ['reports.read', 'students.read', 'academic.read', 'schedule.read', 'attendance.read', 'grading.read'];
    if (['Super Admin', 'Admin'].includes(role.name)) codes = [...DEMO_PERMISSION_CODES];
    if (role.name === 'Registrar') codes.push('students.write', 'academic.write', 'schedule.write', 'enrollment.read', 'enrollment.write', 'enrollment.confirm', 'enrollment.documents.review', 'enrollment.previous-grades.write', 'enrollment.academic.review');
    if (['Teacher', 'Adviser', 'Principal'].includes(role.name)) codes.push('enrollment.read', 'enrollment.write', 'enrollment.academic.review', 'enrollment.previous-grades.write', 'grading.write');
    if (['Teacher', 'Adviser', 'Staff'].includes(role.name)) codes.push('attendance.write');
    return [role.roleId, codes] as const;
  }));

  effective(user: ManagedUser): string[] {
    return [...new Set(this.data.roles.filter(role => user.roles.includes(role.name)).flatMap(role => this.grants.get(role.roleId) ?? []))].sort();
  }
  has(user: ManagedUser, code: string): boolean { return this.effective(user).includes(code); }
}
