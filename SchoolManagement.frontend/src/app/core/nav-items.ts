export interface NavItem {
  label: string;
  path: string;
  permission: string;
}

/**
 * Permission-aware navigation. Visibility here is purely a UX convenience — the API's
 * permission policies remain the actual authorization boundary for every route.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', permission: 'reports.read' },
  { label: 'Students', path: '/students', permission: 'students.read' },
  { label: 'Enrollment applications', path: '/enrollment-applications', permission: 'enrollment.read' },
  { label: 'Enrollment register', path: '/enrollment', permission: 'enrollment.read' },
  { label: 'Academic setup', path: '/academic', permission: 'academic.read' },
  { label: 'Schedules', path: '/schedules', permission: 'schedule.read' },
  { label: 'Attendance', path: '/attendance', permission: 'attendance.read' },
  { label: 'Grading', path: '/grading', permission: 'grading.read' },
  { label: 'Reports', path: '/reports', permission: 'reports.read' },
  { label: 'User Management', path: '/users', permission: 'users.manage' },
  { label: 'Teachers', path: '/teachers', permission: 'users.manage' },
  { label: 'Settings', path: '/settings', permission: 'system-settings.read' },
  { label: 'Roles & permissions', path: '/role-permissions', permission: 'roles.permissions.manage' },
];
