import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { Login } from './features/auth/login/login';
import { EnrollmentPage } from './features/enrollment/enrollment';
import { AcademicPage } from './features/academic/academic';
import { SchedulesPage } from './features/schedules/schedules';
import { StudentsPage } from './features/students/students';
import { UsersPage } from './features/users/users';
import { TeachersPage } from './features/teachers/teachers';
import { Shell } from './layout/shell/shell';
import { enrollmentPortalOptionsProvider } from './features/student-portal/student-portal-options.service';
import { studentPortalUnsavedChangesGuard } from './features/student-portal/student-portal-unsaved.guard';
import { enrollmentApplicationUnsavedChangesGuard } from './features/enrollment-applications/enrollment-application-unsaved.guard';

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'student-portal', providers: [enrollmentPortalOptionsProvider], canDeactivate: [studentPortalUnsavedChangesGuard], loadComponent: () => import('./features/student-portal/student-portal').then(module => module.StudentPortalPage) },
  { path: 'access-denied', loadComponent: () => import('./features/access-denied/access-denied').then(module => module.AccessDeniedPage) },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    canActivateChild: [permissionGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', data: { permission: 'reports.read' }, loadComponent: () => import('./features/dashboard/dashboard').then((module) => module.Dashboard) },
      { path: 'students', data: { permission: 'students.read' }, component: StudentsPage },
      { path: 'enrollment', data: { permission: 'enrollment.read' }, component: EnrollmentPage },
      { path: 'enrollment-applications', data: { permission: 'enrollment.read' }, providers: [enrollmentPortalOptionsProvider], canDeactivate: [enrollmentApplicationUnsavedChangesGuard], loadComponent: () => import('./features/enrollment-applications/enrollment-applications').then(module => module.EnrollmentApplicationsPage) },
      { path: 'academic', data: { permission: 'academic.read' }, component: AcademicPage },
      { path: 'schedules', data: { permission: 'schedule.read' }, component: SchedulesPage },
      { path: 'attendance', data: { permission: 'attendance.read' }, loadComponent: () => import('./features/attendance/attendance').then((module) => module.AttendancePage) },
      { path: 'grading', data: { permission: 'grading.read' }, loadComponent: () => import('./features/grading/grading').then((module) => module.GradingPage) },
      { path: 'reports', data: { permission: 'reports.read' }, loadComponent: () => import('./features/reports/reports').then((module) => module.ReportsPage) },
      { path: 'users', data: { permission: 'users.manage' }, component: UsersPage },
      { path: 'teachers', data: { permission: 'users.manage' }, component: TeachersPage },
      { path: 'settings', data: { permission: 'system-settings.read' }, loadComponent: () => import('./features/settings/settings').then((module) => module.SettingsPage) },
      { path: 'role-permissions', data: { permission: 'roles.permissions.manage' }, loadComponent: () => import('./features/role-permissions/role-permissions').then(module => module.RolePermissionsPage) },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
