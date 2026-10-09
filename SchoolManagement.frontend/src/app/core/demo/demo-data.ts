import { Injectable } from '@angular/core';
import {
  Department,
  Enrollment,
  GradeLevel,
  Room,
  ScheduleEntry,
  SchoolYear,
  Section,
  SectionSubject,
  Strand,
  Subject,
  Track,
} from '../models/phase2.models';
import { ManagedRole, ManagedUser, StudentRecord, TeacherProfile } from '../models/phase3.models';
import {
  AttendanceRecord,
  AttendanceRules,
  GradeRecord,
  GradingComponent,
  GradingPeriod,
  GradingTemplate,
  SystemSetting,
  TeacherAttendanceRecord,
} from '../models/phase36.models';

export const DEMO_PASSWORD = 'Demo123!';
export const DEMO_ACCOUNTS = [
  { username: 'demo.superadmin', role: 'Super Admin', teacherId: null },
  { username: 'demo.admin', role: 'Admin', teacherId: null },
  { username: 'demo.registrar', role: 'Registrar', teacherId: null },
  { username: 'demo.teacher', role: 'Teacher', teacherId: 1 },
  { username: 'demo.adviser', role: 'Adviser', teacherId: 2 },
  { username: 'demo.principal', role: 'Principal', teacherId: null },
  { username: 'demo.staff', role: 'Staff', teacherId: null },
] as const;

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

@Injectable({ providedIn: 'root' })
export class DemoData {
  readonly createdAt = new Date().toISOString();
  readonly today = localDate();
  readonly year = new Date().getFullYear();
  roles: ManagedRole[] = DEMO_ACCOUNTS.map((account, index) => ({
    roleId: index + 1,
    name: account.role,
    description: `Fictional ${account.role} demo role`,
  }));
  users: ManagedUser[] = DEMO_ACCOUNTS.map((account, index) => ({
    userId: index + 1,
    username: account.username,
    email: `${account.username}@example.invalid`,
    teacherId: account.teacherId,
    isActive: true,
    createdAtUtc: this.createdAt,
    roles: [account.role],
  }));
  readonly passwords = new Map(this.users.map((user) => [user.userId, DEMO_PASSWORD]));
  teachers: TeacherProfile[] = [
    {
      teacherId: 1,
      employeeNumber: 'EMP-DEMO-001',
      firstName: 'Maria',
      lastName: 'Santos',
      isActive: true,
      linkedUserId: 4,
    },
    {
      teacherId: 2,
      employeeNumber: 'EMP-DEMO-002',
      firstName: 'Jose',
      lastName: 'Reyes',
      isActive: true,
      linkedUserId: 5,
    },
    {
      teacherId: 3,
      employeeNumber: 'EMP-DEMO-003',
      firstName: 'Ana',
      lastName: 'Cruz',
      isActive: true,
      linkedUserId: null,
    },
  ];
  students: StudentRecord[] = [
    ['Amelia', 'Garcia'],
    ['Ben', 'Mendoza'],
    ['Carla', 'Ramos'],
    ['Diego', 'Torres'],
    ['Ella', 'Flores'],
    ['Felix', 'Rivera'],
    ['Grace', 'Lopez'],
    ['Hugo', 'Castillo'],
    ['Isabel', 'Navarro'],
    ['Jules', 'Aquino'],
    ['Kara', 'Lim'],
    ['Leo', 'Dizon'],
  ].map(([firstName, lastName], index) => ({
    studentId: index + 1,
    studentNumber: `DEMO-${String(index + 1).padStart(3, '0')}`,
    lrn: `99000000${String(index + 1).padStart(4, '0')}`,
    firstName,
    lastName,
    middleName: null,
    suffix: null,
    birthDate: `${this.year - 13}-05-15`,
    status: index === 11 ? 'Inactive' : 'Active',
    createdAtUtc: this.createdAt,
  }));
  schoolYears: SchoolYear[] = [
    {
      schoolYearId: 1,
      code: `${this.year}-${this.year + 1}`,
      startsOn: `${this.year}-06-01`,
      endsOn: `${this.year + 1}-04-30`,
      isActive: true,
    },
    {
      schoolYearId: 2,
      code: `${this.year - 1}-${this.year}`,
      startsOn: `${this.year - 1}-06-01`,
      endsOn: `${this.year}-04-30`,
      isActive: false,
    },
  ];
  departments: Department[] = [
    { departmentId: 1, name: 'Junior High School', isActive: true },
    { departmentId: 2, name: 'Senior High School', isActive: true },
  ];
  gradeLevels: GradeLevel[] = [
    {
      gradeLevelId: 1,
      departmentId: 1,
      departmentName: 'Junior High School',
      code: 'G7',
      name: 'Grade 7',
      sortOrder: 7,
    },
    {
      gradeLevelId: 2,
      departmentId: 2,
      departmentName: 'Senior High School',
      code: 'G11',
      name: 'Grade 11',
      sortOrder: 11,
    },
  ];
  tracks: Track[] = [{ trackId: 1, name: 'Academic', isActive: true }];
  strands: Strand[] = [
    {
      strandId: 1,
      trackId: 1,
      trackName: 'Academic',
      code: 'STEM',
      name: 'Science, Technology, Engineering and Mathematics',
    },
  ];
  subjects: Subject[] = [
    { subjectId: 1, code: 'MATH', name: 'Mathematics', isActive: true },
    { subjectId: 2, code: 'ENG', name: 'English', isActive: true },
    { subjectId: 3, code: 'SCI', name: 'Science', isActive: true },
  ];
  rooms: Room[] = [
    { roomId: 1, code: 'R101', name: 'Room 101', capacity: 40, isActive: true },
    { roomId: 2, code: 'LAB1', name: 'Science Laboratory', capacity: 30, isActive: true },
  ];
  sections: Section[] = [
    {
      sectionId: 1,
      schoolYearId: 1,
      schoolYearCode: this.schoolYears[0].code,
      gradeLevelId: 1,
      gradeLevelName: 'Grade 7',
      strandId: null,
      strandName: null,
      name: 'Integrity',
      adviserTeacherId: 2,
      adviserName: 'Jose Reyes',
    },
    {
      sectionId: 2,
      schoolYearId: 1,
      schoolYearCode: this.schoolYears[0].code,
      gradeLevelId: 2,
      gradeLevelName: 'Grade 11',
      strandId: 1,
      strandName: this.strands[0].name,
      name: 'Innovation',
      adviserTeacherId: 3,
      adviserName: 'Ana Cruz',
    },
  ];
  offerings: SectionSubject[] = this.sections.flatMap((section) =>
    this.subjects.map((subject) => {
      const teacher = this.teachers[subject.subjectId - 1];
      return {
        sectionSubjectId: (section.sectionId - 1) * 3 + subject.subjectId,
        sectionId: section.sectionId,
        subjectId: subject.subjectId,
        subjectCode: subject.code,
        subjectName: subject.name,
        teacherId: teacher.teacherId,
        teacherName: `${teacher.firstName} ${teacher.lastName}`,
        isActive: true,
      };
    }),
  );
  enrollments: Enrollment[] = this.students.slice(0, 10).map((student, index) => {
    const section = this.sections[index < 6 ? 0 : 1];
    return {
      enrollmentId: index + 1,
      studentId: student.studentId,
      studentNumber: student.studentNumber,
      studentName: `${student.firstName} ${student.lastName}`,
      schoolYearId: 1,
      schoolYearCode: section.schoolYearCode,
      sectionId: section.sectionId,
      sectionName: section.name,
      gradeLevelId: section.gradeLevelId,
      gradeLevelName: section.gradeLevelName,
      enrollmentType: index === 9 ? 'Transferee' : 'New',
      status: index === 9 ? 'Pending' : 'Enrolled',
      createdAtUtc: this.createdAt,
      updatedAtUtc: null,
      enrolledAtUtc: index === 9 ? null : this.createdAt,
      subjects: this.offerings.filter((offering) => offering.sectionId === section.sectionId),
    };
  });
  schedules: ScheduleEntry[] = this.offerings.map((offering) => ({
    scheduleEntryId: offering.sectionSubjectId,
    ...offering,
    sectionName: this.sections.find((section) => section.sectionId === offering.sectionId)!.name,
    roomId: offering.sectionId,
    roomName: this.rooms[offering.sectionId - 1].name,
    dayOfWeek: 1,
    startTime: `${String((offering.sectionId === 1 ? 7 : 12) + offering.subjectId).padStart(2, '0')}:00:00`,
    endTime: `${String((offering.sectionId === 1 ? 8 : 13) + offering.subjectId).padStart(2, '0')}:00:00`,
  }));
  rules: AttendanceRules = {
    morningStart: '08:00:00',
    morningLateThresholdMinutes: 15,
    afternoonStart: '13:00:00',
    afternoonLateThresholdMinutes: 15,
    teacherStart: '07:30:00',
    teacherLateThresholdMinutes: 15,
    teacherEndTime: '17:00:00',
  };
  attendance: AttendanceRecord[] = this.enrollments
    .filter((row) => row.status === 'Enrolled')
    .map((row, index) => {
      const student = this.students.find((item) => item.studentId === row.studentId)!;
      const absent = index === 3;
      return {
        attendanceRecordId: index + 1,
        enrollmentId: row.enrollmentId,
        attendanceDate: this.today,
        session: 'Morning',
        status: absent ? 'Absent' : index === 1 ? 'Late' : 'Present',
        timeIn: absent
          ? null
          : new Date(`${this.today}T08:${index === 1 ? '25' : '00'}:00`).toISOString(),
        timeOut: null,
        isManualCorrection: false,
        correctionReason: null,
        studentId: student.studentId,
        studentNumber: student.studentNumber,
        firstName: student.firstName,
        middleName: null,
        lastName: student.lastName,
        sectionId: row.sectionId,
        sectionName: row.sectionName,
      };
    });
  teacherAttendance: TeacherAttendanceRecord[] = this.teachers.map((teacher, index) => ({
    teacherAttendanceRecordId: index + 1,
    teacherId: teacher.teacherId,
    employeeNumber: teacher.employeeNumber,
    firstName: teacher.firstName,
    lastName: teacher.lastName,
    attendanceDate: this.today,
    timeIn: new Date(`${this.today}T07:30:00`).toISOString(),
    timeOut: null,
    status: 'Present',
    overtimeMinutes: null,
    isManualCorrection: false,
    correctionReason: null,
  }));
  templates: GradingTemplate[] = [
    {
      gradingTemplateId: 1,
      templateKey: 'DEMO-STANDARD',
      versionNumber: 1,
      name: 'Demo weighted grading',
      isActive: true,
      createdAtUtc: this.createdAt,
    },
  ];
  components: GradingComponent[] = [
    {
      gradingTemplateComponentId: 1,
      gradingTemplateId: 1,
      name: 'Written Work',
      weightPercent: 30,
      sortOrder: 0,
    },
    {
      gradingTemplateComponentId: 2,
      gradingTemplateId: 1,
      name: 'Performance Tasks',
      weightPercent: 50,
      sortOrder: 1,
    },
    {
      gradingTemplateComponentId: 3,
      gradingTemplateId: 1,
      name: 'Quarterly Assessment',
      weightPercent: 20,
      sortOrder: 2,
    },
  ];
  periods: GradingPeriod[] = this.gradeLevels.map((grade) => ({
    gradingPeriodId: grade.gradeLevelId,
    schoolYearId: 1,
    gradeLevelId: grade.gradeLevelId,
    gradingTemplateId: 1,
    periodType: 'Quarter',
    periodNumber: 1,
    name: `${grade.name} - Quarter 1`,
    startsOn: `${this.year}-06-01`,
    endsOn: `${this.year}-12-31`,
    departmentId: grade.departmentId,
    templateKey: 'DEMO-STANDARD',
    versionNumber: 1,
    templateName: 'Demo weighted grading',
  }));
  grades: GradeRecord[] = this.enrollments
    .filter((row) => row.status === 'Enrolled')
    .flatMap((enrollment) =>
      enrollment.subjects.map((subject, index) => {
        const student = this.students.find((row) => row.studentId === enrollment.studentId)!;
        const state = ['Draft', 'Submitted', 'UnderReview', 'Approved', 'Finalized'][
          (enrollment.enrollmentId + index - 1) % 5
        ];
        return {
          gradeRecordId: (enrollment.enrollmentId - 1) * 3 + index + 1,
          enrollmentId: enrollment.enrollmentId,
          sectionSubjectId: subject.sectionSubjectId,
          gradingPeriodId: enrollment.gradeLevelId,
          workflowStatus: state,
          computedGrade: state === 'Draft' ? null : 85 + (enrollment.enrollmentId % 10),
          createdAtUtc: this.createdAt,
          updatedAtUtc: null,
          studentId: student.studentId,
          studentNumber: student.studentNumber,
          firstName: student.firstName,
          middleName: null,
          lastName: student.lastName,
          sectionId: enrollment.sectionId,
          sectionName: enrollment.sectionName,
          subjectId: subject.subjectId,
          subjectCode: subject.subjectCode,
          subjectName: subject.subjectName,
          teacherId: subject.teacherId,
        };
      }),
    );
  settings: SystemSetting[] = [
    { key: 'School.Name', value: 'Sample Academy (Client Demo)' },
    { key: 'School.Address', value: 'Fictional Demo Campus' },
  ];
}
