import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { Phase36ApiService } from './phase36-api.service';

describe('Phase36ApiService contract alignment', () => {
  let api: Phase36ApiService;
  let http: HttpTestingController;
  const url = (path: string) => `${environment.apiBaseUrl}${path}`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(Phase36ApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('sends the implemented student and teacher scan payloads and attendance routes', () => {
    api.scanAttendance('S-9', '2026-10-05T01:00:00.000Z').subscribe();
    const student = http.expectOne(url('/attendance/student-scans'));
    expect(student.request.method).toBe('POST');
    expect(student.request.body).toEqual({ code: 'S-9', scannedAtUtc: '2026-10-05T01:00:00.000Z' });
    student.flush({});

    api.scanTeacherAttendance('E-3', '2026-10-05T01:01:00.000Z').subscribe();
    const teacher = http.expectOne(url('/attendance/teacher-scans'));
    expect(teacher.request.body).toEqual({ employeeNumber: 'E-3', scannedAtUtc: '2026-10-05T01:01:00.000Z' });
    teacher.flush({});

    api.getAttendance('2026-10-05', 12).subscribe();
    const records = http.expectOne(request => request.url === url('/attendance/records'));
    expect(records.request.params.get('date')).toBe('2026-10-05');
    expect(records.request.params.get('sectionId')).toBe('12');
    records.flush([]);
    api.getTeacherAttendance('2026-10-05').subscribe();
    http.expectOne(request => request.url === url('/attendance/teacher-records') && request.params.get('date') === '2026-10-05').flush([]);
    api.getAttendanceRules().subscribe();
    http.expectOne(url('/attendance/rules')).flush({});
    api.saveAttendanceRules({
      morningStart: '08:00:00', morningLateThresholdMinutes: 10,
      afternoonStart: '13:00:00', afternoonLateThresholdMinutes: 10,
      teacherStart: '08:00:00', teacherLateThresholdMinutes: 10, teacherEndTime: '17:00:00',
    }).subscribe();
    const rules = http.expectOne(url('/attendance/rules'));
    expect(rules.request.method).toBe('PUT');
    expect(rules.request.body).toEqual({
      morningStart: '08:00:00', morningLateThresholdMinutes: 10,
      afternoonStart: '13:00:00', afternoonLateThresholdMinutes: 10,
      teacherStart: '08:00:00', teacherLateThresholdMinutes: 10, teacherEndTime: '17:00:00',
    });
    rules.flush({});
  });

  it('aligns grading period, template, score and workflow routes and DTO payloads', () => {
    api.createGradingTemplate({
      templateKey: 'general', versionNumber: 2, name: 'General v2',
      components: [{ name: 'Written', weightPercent: 100, sortOrder: 0 }],
    }).subscribe();
    const template = http.expectOne(url('/grading/templates'));
    expect(template.request.method).toBe('POST');
    expect(template.request.body).toEqual({
      templateKey: 'general', versionNumber: 2, name: 'General v2',
      components: [{ name: 'Written', weightPercent: 100, sortOrder: 0 }],
    });
    template.flush({ gradingTemplateId: 8 });

    api.getGradingTemplateComponents(8).subscribe();
    http.expectOne(url('/grading/templates/8/components')).flush([]);
    api.getGradingPeriods({ schoolYearId: 3, gradeLevelId: 2 }).subscribe();
    const periods = http.expectOne(request => request.url === url('/grading/periods'));
    expect(periods.request.params.get('schoolYearId')).toBe('3');
    expect(periods.request.params.get('gradeLevelId')).toBe('2');
    periods.flush([]);
    api.createGradingPeriod({
      schoolYearId: 3, gradeLevelId: 2, gradingTemplateId: 8, periodType: 'Quarter',
      periodNumber: 1, name: 'Quarter One', startsOn: '2026-09-01', endsOn: '2026-11-30',
    }).subscribe();
    const periodCreate = http.expectOne(url('/grading/periods'));
    expect(periodCreate.request.body).toEqual({
      schoolYearId: 3, gradeLevelId: 2, gradingTemplateId: 8, periodType: 'Quarter',
      periodNumber: 1, name: 'Quarter One', startsOn: '2026-09-01', endsOn: '2026-11-30',
    });
    periodCreate.flush({ gradingPeriodId: 4 });
    api.getGrades(4, 12).subscribe();
    const grades = http.expectOne(request => request.url === url('/grading/periods/4/grades'));
    expect(grades.request.params.get('sectionId')).toBe('12');
    grades.flush([]);

    api.getGradingSections(4).subscribe();
    http.expectOne(url('/grading/periods/4/sections')).flush([]);
    api.getGradingEntries(4, 12, 2).subscribe();
    const entries = http.expectOne(request => request.url === url('/grading/periods/4/entries'));
    expect(entries.request.params.get('sectionId')).toBe('12');
    expect(entries.request.params.get('page')).toBe('2');
    expect(entries.request.params.has('actorUserId')).toBe(false);
    entries.flush([]);

    api.createGrade({ enrollmentId: 10, sectionSubjectId: 11, gradingPeriodId: 4 }).subscribe();
    const create = http.expectOne(url('/grading/grades'));
    expect(create.request.body).toEqual({ enrollmentId: 10, sectionSubjectId: 11, gradingPeriodId: 4 });
    create.flush({ gradeRecordId: 17, workflowStatus: 'Draft' });

    api.saveGradeScores(4, 17, [{ gradingTemplateComponentId: 5, rawScore: 8, maximumScore: 10 }], 'checked').subscribe();
    const scores = http.expectOne(url('/grading/periods/4/grades/17/scores'));
    expect(scores.request.method).toBe('PUT');
    expect(scores.request.body).toEqual({
      scores: [{ gradingTemplateComponentId: 5, rawScore: 8, maximumScore: 10 }], reason: 'checked',
    });
    scores.flush({ gradeRecordId: 17, computedGrade: 80 });

    api.transitionGrade(17, 'UnderReview', 'review').subscribe();
    const transition = http.expectOne(url('/grading/grades/17/transitions'));
    expect(transition.request.body).toEqual({ newStatus: 'UnderReview', reason: 'review' });
    transition.flush({ gradeRecordId: 17, workflowStatus: 'UnderReview' });
  });

  it('uses system settings, dashboard summary filters, and server report export routes', () => {
    api.getSettings().subscribe();
    http.expectOne(url('/system-settings')).flush([]);
    api.saveSetting('calendar.term', 'Term 1', 'Calendar configuration').subscribe();
    const setting = http.expectOne(url('/system-settings'));
    expect(setting.request.method).toBe('PUT');
    expect(setting.request.body).toEqual({ key: 'calendar.term', value: 'Term 1', description: 'Calendar configuration' });
    setting.flush({ key: 'calendar.term', value: 'Term 1' });

    api.getDashboard({ from: '2026-10-01', to: '2026-10-31', schoolYearId: 6 }).subscribe();
    const dashboard = http.expectOne(request => request.url === url('/reports/dashboard/summary'));
    expect(dashboard.request.params.get('from')).toBe('2026-10-01');
    expect(dashboard.request.params.get('to')).toBe('2026-10-31');
    expect(dashboard.request.params.get('schoolYearId')).toBe('6');
    dashboard.flush({ enrollment: [], attendance: [] });

    api.exportAttendance({ from: '2026-10-01', to: '2026-10-31', sectionId: 12, schoolYearId: 6 }, 'html').subscribe();
    const exportRequest = http.expectOne(request => request.url === url('/reports/attendance-summary/export'));
    expect(exportRequest.request.params.get('format')).toBe('html');
    expect(exportRequest.request.params.get('sectionId')).toBe('12');
    expect(exportRequest.request.responseType).toBe('blob');
    exportRequest.flush(new Blob(['<html></html>'], { type: 'text/html' }));
    api.exportEnrollment(6, 'csv').subscribe();
    const enrollmentExport = http.expectOne(request => request.url === url('/reports/enrollment-summary/export'));
    expect(enrollmentExport.request.params.get('schoolYearId')).toBe('6');
    expect(enrollmentExport.request.params.get('format')).toBe('csv');
    enrollmentExport.flush(new Blob(['school year']));
  });
});
