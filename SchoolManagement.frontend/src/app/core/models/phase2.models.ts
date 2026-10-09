export interface PagedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface Student {
  studentId: number;
  studentNumber: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  suffix?: string | null;
  status: string;
}

export interface SchoolYear {
  schoolYearId: number;
  code: string;
  startsOn: string;
  endsOn: string;
  isActive: boolean;
}

export interface Department {
  departmentId: number;
  name: string;
  isActive: boolean;
}

export interface GradeLevel {
  gradeLevelId: number;
  departmentId: number;
  departmentName: string;
  code: string;
  name: string;
  sortOrder: number;
}

export interface Subject {
  subjectId: number;
  code: string;
  name: string;
  isActive: boolean;
}

export interface Room {
  roomId: number;
  code: string;
  name: string;
  capacity: number | null;
  isActive: boolean;
}

export interface Section {
  sectionId: number;
  schoolYearId: number;
  schoolYearCode: string;
  gradeLevelId: number;
  gradeLevelName: string;
  strandId: number | null;
  strandName: string | null;
  name: string;
  adviserTeacherId: number | null;
  adviserName: string | null;
}

export interface SectionSubject {
  sectionSubjectId: number;
  sectionId: number;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  teacherId: number | null;
  teacherName: string | null;
  isActive: boolean;
}

export interface EnrollmentSubject {
  sectionSubjectId: number;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  teacherId: number | null;
  teacherName: string | null;
}

export interface Enrollment {
  enrollmentId: number;
  studentId: number;
  studentNumber: string;
  studentName: string;
  schoolYearId: number;
  schoolYearCode: string;
  sectionId: number;
  sectionName: string;
  gradeLevelId: number;
  gradeLevelName: string;
  enrollmentType: 'New' | 'Returning' | 'Transferee';
  status: 'Pending' | 'Enrolled' | 'Cancelled' | 'Transferred' | 'Dropped';
  createdAtUtc: string;
  updatedAtUtc: string | null;
  enrolledAtUtc: string | null;
  subjects: EnrollmentSubject[];
}

export interface EnrollmentHistory {
  studentId: number;
  studentNumber: string;
  studentName: string;
  enrollments: Enrollment[];
}

export interface ScheduleEntry {
  scheduleEntryId: number;
  sectionSubjectId: number;
  sectionId: number;
  sectionName: string;
  subjectId: number;
  subjectName: string;
  teacherId: number | null;
  teacherName: string | null;
  roomId: number | null;
  roomName: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface ProblemResponse {
  title?: string;
  detail?: string;
  status?: number;
}

export interface Track {
  trackId: number;
  name: string;
  isActive: boolean;
}

export interface Strand {
  strandId: number;
  trackId: number;
  trackName: string;
  code: string;
  name: string;
}