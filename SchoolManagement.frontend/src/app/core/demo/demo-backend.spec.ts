import { HttpBackend, HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, firstValueFrom } from 'rxjs';
import { appConfig } from '../../app.config';
import { AuthService } from '../services/auth.service';
import { Phase2ApiService } from '../services/phase2-api.service';
import { Phase3ApiService } from '../services/phase3-api.service';
import { Phase36ApiService } from '../services/phase36-api.service';
import { DemoBackend } from './demo-backend';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, DemoData } from './demo-data';
import { Dashboard } from '../../features/dashboard/dashboard';

describe('Standalone demo integration', () => {
  let auth: AuthService;
  let phase2: Phase2ApiService;
  let phase3: Phase3ApiService;
  let phase36: Phase36ApiService;
  let data: DemoData;

  async function login(username = 'demo.admin'): Promise<void> {
    await firstValueFrom(auth.login({ username, password: DEMO_PASSWORD }));
  }

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ imports: [Dashboard], providers: appConfig.providers });
    auth = TestBed.inject(AuthService);
    phase2 = TestBed.inject(Phase2ApiService);
    phase3 = TestBed.inject(Phase3ApiService);
    phase36 = TestBed.inject(Phase36ApiService);
    data = TestBed.inject(DemoData);
    await login();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('uses the terminal local backend and never sends XHR or fetch requests', async () => {
    expect(TestBed.inject(HttpBackend)).toBeInstanceOf(DemoBackend);
    const xhr = vi.spyOn(XMLHttpRequest.prototype, 'send');
    const fetch = vi.spyOn(globalThis, 'fetch');
    await firstValueFrom(phase2.getStudents(''));
    await firstValueFrom(phase36.getDashboard({ from: data.today, to: data.today }));
    await firstValueFrom(auth.refresh());
    await firstValueFrom(auth.logout());
    expect(xhr).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(auth.isAuthenticated()).toBe(false);
  });

  it.each(DEMO_ACCOUNTS)(
    'authenticates $role using $username and preserves its exact role',
    async (account) => {
      await login(account.username);
      expect(auth.currentUser()?.roles).toEqual([account.role]);
      expect(sessionStorage.getItem('sms_demo_session')).not.toBeNull();
      expect(sessionStorage.getItem('sms_session')).toBeNull();
    },
  );

  it.each(DEMO_ACCOUNTS)('renders sample dashboard summaries for $role', async (account) => {
    await login(account.username);
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.role()).toBe(account.role);
    expect(fixture.componentInstance.enrollmentTotal()).toBe(10);
    expect(fixture.componentInstance.attendanceTotal()).toBe(9);
    expect(fixture.componentInstance.error()).toBe('');
  });

  it('rejects bad credentials and external or unknown endpoints', async () => {
    await expect(
      firstValueFrom(auth.login({ username: 'demo.admin', password: 'wrong' })),
    ).rejects.toMatchObject({ status: 401 });
    await login();
    const http = TestBed.inject(HttpClient);
    await expect(
      firstValueFrom(http.get('https://localhost:52362/api/students')),
    ).rejects.toMatchObject({ status: 404 });
    await expect(firstValueFrom(http.get('/demo-api/not-implemented'))).rejects.toMatchObject({
      status: 404,
    });
  });

  it('implements every existing read surface through the real service contracts', async () => {
    const requests: Observable<unknown>[] = [
      phase2.getStudents(''),
      phase2.getEnrollments(),
      phase2.getEnrollmentHistory(1),
      phase2.getSchoolYears(),
      phase2.getDepartments(),
      phase2.getGradeLevels(),
      phase2.getSubjects(),
      phase2.getRooms(),
      phase2.getTracks(),
      phase2.getStrands(),
      phase2.getSections(1),
      phase2.getSectionSubjects(1),
      phase2.getSchedules(1),
      phase3.getStudents(1, '', ''),
      phase3.getStudent(1),
      phase3.getUsers(1, '', null),
      phase3.getRoles(),
      phase3.getTeachers(),
      phase3.getTeacherLookup(),
      phase3.getEnrollmentSummary(1),
      phase3.getAttendanceSummary({ from: data.today, to: data.today }),
      phase36.getAttendance(data.today),
      phase36.getTeacherAttendance(data.today),
      phase36.getAttendanceRules(),
      phase36.getGradingTemplates(),
      phase36.getGradingTemplateComponents(1),
      phase36.getGradingPeriods(),
      phase36.getGrades(1),
      phase36.getGradingSections(1),
      phase36.getGradingEntries(1, 1),
      phase36.getSettings(),
      phase36.getDashboard({ from: data.today, to: data.today }),
    ];
    for (const request of requests) expect(await firstValueFrom(request)).toBeDefined();
  });

  it('filters and paginates arrays with the existing response shape', async () => {
    const result = await firstValueFrom(phase3.getStudents(1, 'DEMO-001', 'Active'));
    expect(result).toMatchObject({ page: 1, pageSize: 20, totalCount: 1 });
    expect(result.items[0].studentNumber).toBe('DEMO-001');
    expect((await firstValueFrom(phase2.getStudents('', 2))).items).toEqual([]);
    expect((await firstValueFrom(phase2.getEnrollments({ status: 'Pending' }))).totalCount).toBe(1);
    expect(await firstValueFrom(phase2.getSections(2))).toEqual([]);
    expect(
      await firstValueFrom(
        phase3.getAttendanceSummary({
          from: `${data.year - 1}-01-01`,
          to: `${data.year - 1}-01-31`,
        }),
      ),
    ).toEqual([]);
  });

  it('creates and edits students and keeps enrollment display names consistent', async () => {
    const payload = {
      studentNumber: 'DEMO-NEW',
      lrn: null,
      firstName: 'Sample',
      middleName: null,
      lastName: 'Student',
      suffix: null,
      birthDate: null,
    };
    const student = await firstValueFrom(phase3.createStudent(payload));
    expect(student.status).toBe('Active');
    await firstValueFrom(
      phase3.updateStudent(student.studentId, {
        ...payload,
        firstName: 'Edited',
        status: 'Active',
      }),
    );
    expect((await firstValueFrom(phase3.getStudent(student.studentId))).firstName).toBe('Edited');
    await expect(firstValueFrom(phase3.createStudent(payload))).rejects.toMatchObject({
      status: 409,
    });
    const original = data.students[0];
    await firstValueFrom(phase3.updateStudent(1, { ...original, firstName: 'Renamed' }));
    expect(
      (await firstValueFrom(phase2.getEnrollmentHistory(1))).enrollments[0].studentName,
    ).toContain('Renamed');
  });

  it('supports the academic create, update, and activation contracts', async () => {
    const year = await firstValueFrom(
      phase2.createSchoolYear({
        code: 'DEMO-FUTURE',
        startsOn: `${data.year + 1}-06-01`,
        endsOn: `${data.year + 2}-04-30`,
      }),
    );
    await firstValueFrom(
      phase2.updateSchoolYear(year.schoolYearId, { ...year, code: 'DEMO-EDITED' }),
    );
    await firstValueFrom(phase2.activateSchoolYear(year.schoolYearId));
    expect(data.schoolYears.filter((row) => row.isActive).map((row) => row.schoolYearId)).toEqual([
      year.schoolYearId,
    ]);
    const department = await firstValueFrom(phase2.createDepartment({ name: 'Demo Department' }));
    await firstValueFrom(
      phase2.updateDepartment(department.departmentId, {
        name: 'Edited Department',
        isActive: true,
      }),
    );
    const grade = await firstValueFrom(
      phase2.createGradeLevel({
        departmentId: department.departmentId,
        code: 'G-DEMO',
        name: 'Demo Grade',
        sortOrder: 12,
      }),
    );
    await firstValueFrom(
      phase2.updateGradeLevel(grade.gradeLevelId, {
        code: 'G-EDIT',
        name: 'Edited Grade',
        sortOrder: 13,
      }),
    );
    const track = await firstValueFrom(phase2.createTrack({ name: 'Demo Track' }));
    await firstValueFrom(
      phase2.updateTrack(track.trackId, { name: 'Edited Track', isActive: true }),
    );
    const strand = await firstValueFrom(
      phase2.createStrand({ trackId: track.trackId, code: 'DEMO', name: 'Demo Strand' }),
    );
    await firstValueFrom(
      phase2.updateStrand(strand.strandId, { code: 'EDIT', name: 'Edited Strand' }),
    );
    const subject = await firstValueFrom(
      phase2.createSubject({ code: 'DEMO-SUB', name: 'Demo Subject' }),
    );
    await firstValueFrom(
      phase2.updateSubject(subject.subjectId, {
        code: 'EDIT-SUB',
        name: 'Edited Subject',
        isActive: true,
      }),
    );
    const room = await firstValueFrom(
      phase2.createRoom({ code: 'DEMO-R', name: 'Demo Room', capacity: 20 }),
    );
    await firstValueFrom(
      phase2.updateRoom(room.roomId, {
        code: 'EDIT-R',
        name: 'Edited Room',
        capacity: 25,
        isActive: true,
      }),
    );
    const section = await firstValueFrom(
      phase2.createSection({
        schoolYearId: year.schoolYearId,
        gradeLevelId: grade.gradeLevelId,
        strandId: strand.strandId,
        name: 'Demo Section',
        adviserTeacherId: 2,
      }),
    );
    await firstValueFrom(
      phase2.updateSection(section.sectionId, {
        name: 'Edited Section',
        strandId: null,
        adviserTeacherId: 3,
      }),
    );
    const offering = await firstValueFrom(
      phase2.assignSectionSubject(section.sectionId, {
        subjectId: subject.subjectId,
        teacherId: 1,
      }),
    );
    await firstValueFrom(
      phase2.updateSectionSubject(section.sectionId, offering.sectionSubjectId, {
        teacherId: 2,
        isActive: true,
      }),
    );
    expect(
      (await firstValueFrom(phase2.getSectionSubjects(section.sectionId)))[0].teacherName,
    ).toBe('Jose Reyes');
    expect(
      (await firstValueFrom(phase2.getStrands())).find((row) => row.strandId === strand.strandId)
        ?.trackName,
    ).toBe('Edited Track');
  });

  it('creates, edits, confirms and drops enrollment and rejects invalid transitions', async () => {
    const enrollment = await firstValueFrom(
      phase2.createEnrollment({
        studentId: 11,
        schoolYearId: 1,
        sectionId: 1,
        enrollmentType: 'New',
        sectionSubjectIds: [1, 2, 3],
      }),
    );
    expect(enrollment.status).toBe('Pending');
    await firstValueFrom(
      phase2.updateEnrollment(enrollment.enrollmentId, {
        sectionId: 1,
        enrollmentType: 'Returning',
        sectionSubjectIds: [1, 2],
      }),
    );
    expect(
      (await firstValueFrom(phase2.enrollmentAction(enrollment.enrollmentId, 'confirm'))).status,
    ).toBe('Enrolled');
    await expect(
      firstValueFrom(phase2.enrollmentAction(enrollment.enrollmentId, 'confirm')),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (
        await firstValueFrom(
          phase2.enrollmentAction(enrollment.enrollmentId, 'drop', 'Sample reason'),
        )
      ).status,
    ).toBe('Dropped');
    expect(
      (await firstValueFrom(phase2.enrollmentAction(10, 'cancel', 'Sample reason'))).status,
    ).toBe('Cancelled');
    expect(
      (await firstValueFrom(phase2.enrollmentAction(2, 'transfer', 'Sample reason'))).status,
    ).toBe('Transferred');
    expect((await firstValueFrom(phase2.getEnrollmentHistory(11))).enrollments).toHaveLength(1);
  });

  it('creates, edits, and deletes schedules and rejects overlaps', async () => {
    for (const row of data.schedules) {
      expect(
        data.schedules.some(
          (other) =>
            other !== row &&
            other.dayOfWeek === row.dayOfWeek &&
            other.startTime < row.endTime &&
            row.startTime < other.endTime &&
            (other.sectionId === row.sectionId ||
              other.roomId === row.roomId ||
              other.teacherId === row.teacherId),
        ),
      ).toBe(false);
    }
    const schedule = await firstValueFrom(
      phase2.createSchedule({
        sectionSubjectId: 1,
        roomId: 1,
        dayOfWeek: 2,
        startTime: '08:00',
        endTime: '09:00',
      }),
    );
    await expect(
      firstValueFrom(
        phase2.createSchedule({
          sectionSubjectId: 2,
          roomId: 1,
          dayOfWeek: 2,
          startTime: '08:30',
          endTime: '09:30',
        }),
      ),
    ).rejects.toMatchObject({ status: 409 });
    await firstValueFrom(
      phase2.updateSchedule(schedule.scheduleEntryId, {
        roomId: 2,
        dayOfWeek: 2,
        startTime: '10:00',
        endTime: '11:00',
      }),
    );
    expect(
      data.schedules.find((row) => row.scheduleEntryId === schedule.scheduleEntryId)?.roomName,
    ).toBe('Science Laboratory');
    await firstValueFrom(phase2.deleteSchedule(schedule.scheduleEntryId));
    expect(
      data.schedules.find((row) => row.scheduleEntryId === schedule.scheduleEntryId),
    ).toBeUndefined();
  });

  it('records attendance, applies rules and rejects unknown or duplicate-completed scans', async () => {
    const date = `${data.year}-05-20`;
    const first = await firstValueFrom(
      phase36.scanAttendance('DEMO-001', new Date(`${date}T08:16:00`).toISOString()),
    );
    expect(first).toMatchObject({ status: 'Late', session: 'Morning', timeOut: null });
    const second = await firstValueFrom(
      phase36.scanAttendance('DEMO-001', new Date(`${date}T11:00:00`).toISOString()),
    );
    expect(second.timeOut).not.toBeNull();
    await expect(
      firstValueFrom(
        phase36.scanAttendance('DEMO-001', new Date(`${date}T11:01:00`).toISOString()),
      ),
    ).rejects.toMatchObject({ status: 409 });
    const afternoon = await firstValueFrom(
      phase36.scanAttendance('990000000001', new Date(`${date}T13:00:00`).toISOString()),
    );
    expect(afternoon.session).toBe('Afternoon');
    await expect(firstValueFrom(phase36.scanAttendance('UNKNOWN'))).rejects.toMatchObject({
      status: 404,
    });
    await firstValueFrom(
      phase36.saveAttendanceRules({
        ...data.rules,
        teacherStart: '08:00',
        teacherEndTime: '17:00',
      }),
    );
    expect(
      (
        await firstValueFrom(
          phase36.scanTeacherAttendance('EMP-DEMO-001', new Date(`${date}T08:00:00`).toISOString()),
        )
      ).status,
    ).toBe('Present');
    expect(
      (
        await firstValueFrom(
          phase36.scanTeacherAttendance('EMP-DEMO-001', new Date(`${date}T18:00:00`).toISOString()),
        )
      ).overtimeMinutes,
    ).toBe(60);
  });

  it('creates templates, periods and grades, computes exact weights and enforces workflow', async () => {
    const template = await firstValueFrom(
      phase36.createGradingTemplate({
        templateKey: 'DEMO-TEST',
        versionNumber: 1,
        name: 'Test',
        components: [
          { name: 'A', weightPercent: 30, sortOrder: 0 },
          { name: 'B', weightPercent: 70, sortOrder: 1 },
        ],
      }),
    );
    const period = await firstValueFrom(
      phase36.createGradingPeriod({
        schoolYearId: 1,
        gradeLevelId: 1,
        gradingTemplateId: template.gradingTemplateId,
        periodType: 'Quarter',
        periodNumber: 2,
        name: 'Quarter 2',
        startsOn: `${data.year}-08-01`,
        endsOn: `${data.year}-10-31`,
      }),
    );
    const grade = await firstValueFrom(
      phase36.createGrade({
        enrollmentId: 1,
        sectionSubjectId: 1,
        gradingPeriodId: period.gradingPeriodId,
      }),
    );
    await expect(
      firstValueFrom(phase36.transitionGrade(grade.gradeRecordId, 'Submitted')),
    ).rejects.toMatchObject({ status: 400 });
    const components = await firstValueFrom(
      phase36.getGradingTemplateComponents(template.gradingTemplateId),
    );
    const scores = components.map((row, index) => ({
      gradingTemplateComponentId: row.gradingTemplateComponentId,
      rawScore: index === 0 ? 80 : 90,
      maximumScore: 100,
    }));
    expect(
      (
        await firstValueFrom(
          phase36.saveGradeScores(period.gradingPeriodId, grade.gradeRecordId, scores),
        )
      ).computedGrade,
    ).toBe(87);
    for (const status of ['Submitted', 'UnderReview', 'Approved', 'Finalized']) {
      expect(
        (await firstValueFrom(phase36.transitionGrade(grade.gradeRecordId, status))).workflowStatus,
      ).toBe(status);
    }
    await expect(
      firstValueFrom(phase36.saveGradeScores(period.gradingPeriodId, grade.gradeRecordId, scores)),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      firstValueFrom(phase36.transitionGrade(grade.gradeRecordId, 'Draft')),
    ).rejects.toMatchObject({ status: 400 });
    expect(
      (
        await firstValueFrom(
          phase36.transitionGrade(grade.gradeRecordId, 'Draft', 'Sample reopening'),
        )
      ).workflowStatus,
    ).toBe('Draft');
    await expect(
      firstValueFrom(
        phase36.createGrade({
          enrollmentId: 1,
          sectionSubjectId: 1,
          gradingPeriodId: period.gradingPeriodId,
        }),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('scopes teacher and adviser grading and denies staff administration', async () => {
    await login('demo.teacher');
    expect((await firstValueFrom(phase36.getGrades(1))).every((row) => row.teacherId === 1)).toBe(
      true,
    );
    expect(
      (await firstValueFrom(phase36.getGradingEntries(1, 1))).every((row) =>
        row.subjects.every((subject) => subject.subjectCode === 'MATH'),
      ),
    ).toBe(true);
    await expect(firstValueFrom(phase36.transitionGrade(4, 'UnderReview'))).rejects.toMatchObject({
      status: 403,
    });
    await login('demo.adviser');
    expect(await firstValueFrom(phase36.getGradingSections(2))).toEqual([]);
    expect((await firstValueFrom(phase36.getGrades(1))).every((row) => row.sectionId === 1)).toBe(
      true,
    );
    await login('demo.staff');
    await expect(firstValueFrom(phase3.getUsers(1, '', null))).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      firstValueFrom(phase2.createSubject({ code: 'X', name: 'Denied' })),
    ).rejects.toMatchObject({ status: 403 });
    await expect(firstValueFrom(phase36.getSettings())).rejects.toMatchObject({ status: 403 });
    expect((await firstValueFrom(phase2.getStudents(''))).totalCount).toBe(12);
  });

  it('creates and updates teachers, users, passwords and role assignments', async () => {
    const teacher = await firstValueFrom(
      phase3.createTeacher({
        employeeNumber: 'EMP-NEW',
        firstName: 'Demo',
        lastName: 'Teacher',
        isActive: true,
      }),
    );
    await firstValueFrom(
      phase3.updateTeacher(teacher.teacherId, { ...teacher, firstName: 'Edited' }),
    );
    const user = await firstValueFrom(
      phase3.createUser({
        username: 'demo.new',
        email: null,
        initialPassword: 'PublicDemo!',
        teacherId: teacher.teacherId,
        isActive: true,
        roleIds: [4],
      }),
    );
    expect(
      (await firstValueFrom(phase3.getTeachers())).find(
        (row) => row.teacherId === teacher.teacherId,
      )?.linkedUserId,
    ).toBe(user.userId);
    await firstValueFrom(
      phase3.updateUser(user.userId, {
        ...user,
        username: 'demo.edited',
        newPassword: 'ChangedDemo!',
      }),
    );
    await firstValueFrom(phase3.replaceUserRoles(user.userId, [7]));
    await firstValueFrom(auth.login({ username: 'demo.edited', password: 'ChangedDemo!' }));
    expect(auth.currentUser()?.roles).toEqual(['Staff']);
  });

  it('derives reports from changed arrays and exports real CSV and HTML blobs locally', async () => {
    const before = await firstValueFrom(phase3.getEnrollmentSummary(1));
    const pending = before.find((row) => row.status === 'Pending')!.count;
    await firstValueFrom(phase2.enrollmentAction(10, 'confirm'));
    const after = await firstValueFrom(phase3.getEnrollmentSummary(1));
    expect(after.find((row) => row.status === 'Pending')?.count ?? 0).toBe(pending - 1);
    const csv = await firstValueFrom(phase36.exportEnrollment(1, 'csv'));
    const html = await firstValueFrom(
      phase36.exportAttendance({ from: data.today, to: data.today }, 'html'),
    );
    expect(csv).toBeInstanceOf(Blob);
    expect(csv.type).toBe('text/csv');
    expect(csv.size).toBeGreaterThan(100);
    expect(html).toBeInstanceOf(Blob);
    expect(html.type).toBe('text/html');
    expect(html.size).toBeGreaterThan(100);
    await firstValueFrom(phase36.saveSetting('School.Name', 'Edited demo school'));
    expect(
      (await firstValueFrom(phase36.getSettings())).find((row) => row.key === 'School.Name')?.value,
    ).toBe('Edited demo school');
  });

  it('resets arrays with a fresh application and keeps the original session untouched', async () => {
    sessionStorage.setItem('sms_session', 'original-session-marker');
    await firstValueFrom(phase36.saveSetting('School.Name', 'Temporary name'));
    await firstValueFrom(auth.logout());
    expect(sessionStorage.getItem('sms_session')).toBe('original-session-marker');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: appConfig.providers });
    expect(TestBed.inject(DemoData).settings[0].value).toBe('Sample Academy (Client Demo)');
  });
});
