export interface NavItem {
  label: string;
  path: string;
  /** Role names allowed to see this item. Empty array means visible to every authenticated role. */
  roles: string[];
}

/**
 * Role-aware demo navigation, also used by the demo child-route guard.
 * This fictional client-only application is not a production authorization boundary.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', roles: [] },
  { label: 'Students', path: '/students', roles: [] },
  { label: 'Enrollment', path: '/enrollment', roles: [] },
  { label: 'Academic setup', path: '/academic', roles: [] },
  { label: 'Schedules', path: '/schedules', roles: ['Super Admin', 'Admin', 'Registrar', 'Teacher', 'Adviser', 'Principal', 'Staff'] },
  { label: 'Attendance', path: '/attendance', roles: ['Super Admin', 'Admin', 'Teacher', 'Adviser', 'Staff'] },
  { label: 'Grading', path: '/grading', roles: ['Super Admin', 'Admin', 'Teacher', 'Adviser', 'Principal'] },
  { label: 'Reports', path: '/reports', roles: ['Super Admin', 'Admin', 'Principal'] },
  { label: 'User Management', path: '/users', roles: ['Super Admin', 'Admin'] },
  { label: 'Teachers', path: '/teachers', roles: ['Super Admin', 'Admin'] },
  { label: 'Settings', path: '/settings', roles: ['Super Admin', 'Admin'] },
];
