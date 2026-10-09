export interface AttendanceRecord {
  attendanceRecordId: number;
  enrollmentId: number;
  attendanceDate: string;
  session: string;
  status: string;
  timeIn: string | null;
  timeOut: string | null;
  isManualCorrection: boolean;
  correctionReason: string | null;
  studentId: number;
  studentNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  sectionId: number;
  sectionName: string;
}

export interface TeacherAttendanceRecord {
  teacherAttendanceRecordId: number;
  teacherId: number;
  attendanceDate: string;
  timeIn: string | null;
  timeOut: string | null;
  status: string;
  overtimeMinutes: number | null;
  isManualCorrection: boolean;
  correctionReason: string | null;
  employeeNumber: string;
  firstName: string;
  lastName: string;
}

export interface AttendanceRules {
  morningStart: string;
  morningLateThresholdMinutes: number;
  afternoonStart: string;
  afternoonLateThresholdMinutes: number;
  teacherStart: string;
  teacherLateThresholdMinutes: number;
  teacherEndTime: string;
}

export interface AttendanceScanResult extends AttendanceRecord {}
export interface TeacherAttendanceScanResult extends TeacherAttendanceRecord {}

export interface GradingComponent {
  gradingTemplateComponentId: number;
  gradingTemplateId: number;
  name: string;
  weightPercent: number;
  sortOrder: number;
}

export interface GradingTemplate {
  gradingTemplateId: number;
  templateKey: string;
  versionNumber: number;
  name: string;
  isActive: boolean;
  createdAtUtc: string;
}

export interface GradingPeriod {
  gradingPeriodId: number;
  schoolYearId: number;
  gradeLevelId: number;
  gradingTemplateId: number;
  periodType: string;
  periodNumber: number;
  name: string;
  startsOn: string;
  endsOn: string;
  departmentId: number;
  templateKey: string;
  versionNumber: number;
  templateName: string;
}

export interface GradeRecord {
  gradeRecordId: number;
  enrollmentId: number;
  sectionSubjectId: number;
  gradingPeriodId: number;
  workflowStatus: string;
  computedGrade: number | null;
  createdAtUtc: string;
  updatedAtUtc: string | null;
  studentId: number;
  studentNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  sectionId: number;
  sectionName: string;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  teacherId: number | null;
}

export interface GradeTransitionResult {
  gradeRecordId: number;
  workflowStatus: string;
}

export interface GradeScoreResult {
  gradeRecordId: number;
  computedGrade: number;
}

export interface EnrollmentSummary {
  schoolYearId: number;
  schoolYearCode: string;
  gradeLevelId: number;
  gradeLevelName: string;
  status: string;
  count: number;
}

export interface AttendanceSummary {
  sectionId: number;
  sectionName: string;
  status: string;
  rowCount: number;
}

export interface DashboardSummary {
  enrollment: EnrollmentSummary[];
  attendance: AttendanceSummary[];
}

export interface SystemSetting {
  key: string;
  value: string;
}
export interface GradingSection {
  sectionId: number;
  sectionName: string;
  gradeLevelName: string;
}

export interface GradingEnrollment {
  enrollmentId: number;
  studentNumber: string;
  studentName: string;
  subjects: Array<{ sectionSubjectId: number; subjectCode: string; subjectName: string }>;
}
