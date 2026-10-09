import { Routes } from '@angular/router';
import { authGuard, demoRoleGuard } from './core/guards/auth.guard';
import { Login } from './features/auth/login/login';
import { EnrollmentPage } from './features/enrollment/enrollment';
import { AcademicPage } from './features/academic/academic';
import { SchedulesPage } from './features/schedules/schedules';
import { StudentsPage } from './features/students/students';
import { UsersPage } from './features/users/users';
import { TeachersPage } from './features/teachers/teachers';
import { Shell } from './layout/shell/shell';

export const routes: Routes = [
  { path: 'login', component: Login },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    canActivateChild: [demoRoleGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard').then((module) => module.Dashboard) },
      { path: 'students', component: StudentsPage },
      { path: 'enrollment', component: EnrollmentPage },
      { path: 'academic', component: AcademicPage },
      { path: 'schedules', component: SchedulesPage },
      { path: 'attendance', loadComponent: () => import('./features/attendance/attendance').then((module) => module.AttendancePage) },
      { path: 'grading', loadComponent: () => import('./features/grading/grading').then((module) => module.GradingPage) },
      { path: 'reports', loadComponent: () => import('./features/reports/reports').then((module) => module.ReportsPage) },
      { path: 'users', component: UsersPage },
      { path: 'teachers', component: TeachersPage },
      { path: 'settings', loadComponent: () => import('./features/settings/settings').then((module) => module.SettingsPage) },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
