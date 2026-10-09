export interface StudentRecord {
  studentId: number;
  studentNumber: string;
  lrn: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  birthDate: string | null;
  status: 'Active' | 'Inactive' | 'Transferred' | 'Dropped' | 'Graduated' | 'Archived';
  createdAtUtc: string;
}

export interface ManagedUser {
  userId: number;
  username: string;
  email: string | null;
  teacherId: number | null;
  isActive: boolean;
  createdAtUtc: string;
  roles: string[];
}

export interface ManagedRole {
  roleId: number;
  name: string;
  description: string | null;
}

export interface TeacherProfile {
  teacherId: number;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  linkedUserId: number | null;
}

export type TeacherLookup = Omit<TeacherProfile, 'linkedUserId'>;

export interface EnrollmentSummaryRow {
  schoolYearId: number;
  schoolYearCode: string;
  gradeLevelId: number;
  gradeLevelName: string;
  status: string;
  count: number;
}

export interface AttendanceSummaryRow {
  sectionId: number;
  sectionName: string;
  status: 'Present' | 'Late' | 'Absent' | 'Excused';
  rowCount: number;
}

export interface Phase3PagedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface ApiProblem {
  title?: string;
  detail?: string;
  status?: number;
}