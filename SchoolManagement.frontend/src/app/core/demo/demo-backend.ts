import {
  HttpBackend,
  HttpErrorResponse,
  HttpEvent,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, defer, of } from 'rxjs';
import { TokenResponse } from '../models/auth.models';
import { Enrollment, Section, SectionSubject } from '../models/phase2.models';
import { AttendanceSummaryRow, EnrollmentSummaryRow, ManagedUser } from '../models/phase3.models';
import { GradeRecord } from '../models/phase36.models';
import { DemoData, localDate } from './demo-data';

const ADMIN = ['Super Admin', 'Admin'];
const REGISTRAR = [...ADMIN, 'Registrar'];
const GRADERS = [...ADMIN, 'Teacher', 'Adviser', 'Principal'];

function fail(status: number, detail: string): never {
  throw new HttpErrorResponse({
    status,
    error: { title: 'Demo request rejected', detail, status },
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

class Body {
  constructor(private readonly value: unknown) {}

  private field(key: string): unknown {
    if (!isObject(this.value)) fail(400, 'Expected a request object.');
    return this.value[key];
  }

  text(key: string, required = true): string {
    const value = this.field(key);
    if (typeof value !== 'string' || (required && !value.trim()))
      fail(400, `Enter a valid ${key}.`);
    return value.trim();
  }

  optionalText(key: string): string | null {
    const value = this.field(key);
    if (value === null || value === undefined || value === '') return null;
    return this.text(key);
  }

  number(key: string, minimum = 0): number {
    const value = this.field(key);
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum)
      fail(400, `Enter a valid ${key}.`);
    return value;
  }

  id(key: string): number {
    const value = this.number(key, 1);
    if (!Number.isInteger(value)) fail(400, `${key} must be a whole number.`);
    return value;
  }

  optionalNumber(key: string): number | null {
    const value = this.field(key);
    return value === null || value === undefined ? null : this.number(key);
  }

  bool(key: string, defaultValue = true): boolean {
    const value = this.field(key);
    if (value === undefined) return defaultValue;
    if (typeof value !== 'boolean') fail(400, `Enter a valid ${key}.`);
    return value;
  }

  list(key: string): unknown[] {
    const value = this.field(key);
    if (!Array.isArray(value)) fail(400, `Expected a ${key} array.`);
    return value;
  }

  ids(key: string): number[] {
    return this.list(key).map((value) => {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 1)
        fail(400, `Invalid ${key}.`);
      return value;
    });
  }
}

/** Terminal backend: every request is handled locally; there is no network delegate. */
@Injectable()
export class DemoBackend implements HttpBackend {
  private readonly data = inject(DemoData);

  handle(request: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    return defer(() => {
      if (!request.url.startsWith('/demo-api/'))
        fail(404, 'External requests are disabled in this standalone demo.');
      const path = request.url.slice('/demo-api/'.length).split('?')[0].split('/');
      const result = this.dispatch(request, path, new Body(request.body));
      this.syncRelations();
      const body = result instanceof Blob ? result : structuredClone(result);
      return of(new HttpResponse({ status: 200, body, url: request.urlWithParams }));
    });
  }

  private dispatch(request: HttpRequest<unknown>, path: string[], body: Body): unknown {
    const [resource, rawId, action, rawChildId] = path;
    const id = rawId && /^\d+$/.test(rawId) ? Number(rawId) : undefined;
    const method = request.method;
    if (resource === 'auth') return this.auth(method, rawId, body);
    const user = this.user(request);
    const writing = method !== 'GET';

    switch (resource) {
      case 'students': {
        if (writing) this.allow(user, REGISTRAR);
        if (id !== undefined && action === 'enrollment-history' && method === 'GET') {
          const student = this.find(this.data.students, (row) => row.studentId === id);
          return {
            ...student,
            studentName: `${student.firstName} ${student.lastName}`,
            enrollments: this.data.enrollments.filter((row) => row.studentId === id),
          };
        }
        if (method === 'GET') {
          if (id !== undefined) return this.find(this.data.students, (row) => row.studentId === id);
          return this.page(
            this.data.students.filter(
              (row) =>
                this.search(request, [
                  row.studentNumber,
                  row.lrn ?? '',
                  row.firstName,
                  row.lastName,
                ]) && this.filter(request, 'status', row.status),
            ),
            request,
          );
        }
        if (method !== 'POST' && method !== 'PUT') break;
        const existing =
          id === undefined
            ? undefined
            : this.find(this.data.students, (row) => row.studentId === id);
        const studentNumber = body.text('studentNumber');
        const lrn = body.optionalText('lrn');
        this.unique(
          this.data.students,
          (row) =>
            row.studentId !== id &&
            (row.studentNumber === studentNumber || (lrn !== null && row.lrn === lrn)),
        );
        const status = existing ? body.text('status') : 'Active';
        if (
          !['Active', 'Inactive', 'Transferred', 'Dropped', 'Graduated', 'Archived'].includes(
            status,
          )
        )
          fail(400, 'Invalid student status.');
        const student: (typeof this.data.students)[number] = {
          studentId: existing?.studentId ?? this.nextId(this.data.students, (row) => row.studentId),
          studentNumber,
          lrn,
          firstName: body.text('firstName'),
          middleName: body.optionalText('middleName'),
          lastName: body.text('lastName'),
          suffix: body.optionalText('suffix'),
          birthDate: body.optionalText('birthDate'),
          status: this.studentStatus(status),
          createdAtUtc: existing?.createdAtUtc ?? new Date().toISOString(),
        };
        return this.save(this.data.students, existing, student);
      }
      case 'users': {
        this.allow(user, ADMIN);
        if (method === 'GET')
          return this.page(
            this.data.users.filter(
              (row) =>
                this.search(request, [row.username, row.email ?? '']) &&
                this.filter(request, 'isActive', String(row.isActive)),
            ),
            request,
          );
        const existing =
          id === undefined ? undefined : this.find(this.data.users, (row) => row.userId === id);
        if (method === 'PUT' && action === 'roles' && existing) {
          const roles = this.roleNames(body.ids('roleIds'));
          existing.roles = roles;
          return existing;
        }
        if (method !== 'POST' && method !== 'PUT') break;
        const username = body.text('username');
        const email = body.optionalText('email');
        const teacherId = body.optionalNumber('teacherId');
        if (teacherId !== null)
          this.find(this.data.teachers, (row) => row.teacherId === teacherId && row.isActive);
        this.unique(
          this.data.users,
          (row) =>
            row.userId !== id &&
            (row.username.toLowerCase() === username.toLowerCase() ||
              (email !== null && row.email === email) ||
              (teacherId !== null && row.teacherId === teacherId)),
        );
        const password = existing ? body.optionalText('newPassword') : body.text('initialPassword');
        const saved: ManagedUser = {
          userId: existing?.userId ?? this.nextId(this.data.users, (row) => row.userId),
          username,
          email,
          teacherId,
          isActive: body.bool('isActive'),
          createdAtUtc: existing?.createdAtUtc ?? new Date().toISOString(),
          roles: existing?.roles ?? this.roleNames(body.ids('roleIds')),
        };
        if (password) this.data.passwords.set(saved.userId, password);
        return this.save(this.data.users, existing, saved);
      }
      case 'roles':
        this.allow(user, ADMIN);
        if (method === 'GET') return this.data.roles;
        break;
      case 'teachers': {
        this.allow(user, method === 'GET' && rawId === 'lookup' ? REGISTRAR : ADMIN);
        if (method === 'GET') return this.data.teachers;
        if (method !== 'POST' && method !== 'PUT') break;
        const employeeNumber = body.text('employeeNumber');
        this.unique(
          this.data.teachers,
          (row) => row.teacherId !== id && row.employeeNumber === employeeNumber,
        );
        return this.crud(
          request,
          id,
          this.data.teachers,
          (row) => row.teacherId,
          (newId) => ({
            teacherId: newId,
            employeeNumber,
            firstName: body.text('firstName'),
            lastName: body.text('lastName'),
            isActive: body.bool('isActive'),
            linkedUserId: null,
          }),
        );
      }
      case 'academic':
        if (writing) this.allow(user, REGISTRAR);
        return this.academic(request, path, body);
      case 'sections': {
        if (writing) this.allow(user, REGISTRAR);
        if (id !== undefined && action === 'subjects') {
          const section = this.find(this.data.sections, (row) => row.sectionId === id);
          const childId = rawChildId ? Number(rawChildId) : undefined;
          if (method === 'GET') return this.data.offerings.filter((row) => row.sectionId === id);
          if (method !== 'POST' && method !== 'PUT') break;
          const existing =
            childId === undefined
              ? undefined
              : this.find(
                  this.data.offerings,
                  (row) => row.sectionSubjectId === childId && row.sectionId === id,
                );
          const subject = this.find(
            this.data.subjects,
            (row) => row.subjectId === (existing?.subjectId ?? body.id('subjectId')),
          );
          this.unique(
            this.data.offerings,
            (row) =>
              row.sectionId === id && row.subjectId === subject.subjectId && row !== existing,
          );
          const teacherId = body.optionalNumber('teacherId');
          const teacher =
            teacherId === null
              ? null
              : this.find(this.data.teachers, (row) => row.teacherId === teacherId && row.isActive);
          const offering: SectionSubject = {
            sectionSubjectId:
              existing?.sectionSubjectId ??
              this.nextId(this.data.offerings, (row) => row.sectionSubjectId),
            sectionId: section.sectionId,
            subjectId: subject.subjectId,
            subjectCode: subject.code,
            subjectName: subject.name,
            teacherId,
            teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : null,
            isActive: body.bool('isActive'),
          };
          return this.save(this.data.offerings, existing, offering);
        }
        if (method === 'GET')
          return this.data.sections.filter((row) =>
            this.filter(request, 'schoolYearId', row.schoolYearId),
          );
        return this.crud(
          request,
          id,
          this.data.sections,
          (row) => row.sectionId,
          (newId) => {
            const existing = this.data.sections.find((row) => row.sectionId === newId);
            const year = this.find(
              this.data.schoolYears,
              (row) => row.schoolYearId === (existing?.schoolYearId ?? body.id('schoolYearId')),
            );
            const grade = this.find(
              this.data.gradeLevels,
              (row) => row.gradeLevelId === (existing?.gradeLevelId ?? body.id('gradeLevelId')),
            );
            const strandId = body.optionalNumber('strandId');
            const strand =
              strandId === null
                ? null
                : this.find(this.data.strands, (row) => row.strandId === strandId);
            const adviserTeacherId = body.optionalNumber('adviserTeacherId');
            const adviser =
              adviserTeacherId === null
                ? null
                : this.find(
                    this.data.teachers,
                    (row) => row.teacherId === adviserTeacherId && row.isActive,
                  );
            const name = body.text('name');
            this.unique(
              this.data.sections,
              (row) =>
                row.sectionId !== newId &&
                row.schoolYearId === year.schoolYearId &&
                row.gradeLevelId === grade.gradeLevelId &&
                row.name === name,
            );
            return {
              sectionId: newId,
              schoolYearId: year.schoolYearId,
              schoolYearCode: year.code,
              gradeLevelId: grade.gradeLevelId,
              gradeLevelName: grade.name,
              strandId,
              strandName: strand?.name ?? null,
              name,
              adviserTeacherId,
              adviserName: adviser ? `${adviser.firstName} ${adviser.lastName}` : null,
            };
          },
        );
      }
      case 'enrollments': {
        if (writing) this.allow(user, REGISTRAR);
        if (method === 'GET')
          return this.page(
            this.data.enrollments.filter((row) =>
              ['schoolYearId', 'sectionId', 'studentId', 'status'].every((key) =>
                this.filter(
                  request,
                  key,
                  key === 'schoolYearId'
                    ? row.schoolYearId
                    : key === 'sectionId'
                      ? row.sectionId
                      : key === 'studentId'
                        ? row.studentId
                        : row.status,
                ),
              ),
            ),
            request,
            25,
          );
        const existing =
          id === undefined
            ? undefined
            : this.find(this.data.enrollments, (row) => row.enrollmentId === id);
        if (method === 'POST' && action && existing)
          return this.enrollmentAction(existing, action, body);
        return this.crud(
          request,
          id,
          this.data.enrollments,
          (row) => row.enrollmentId,
          (newId): Enrollment => {
            if (existing && existing.status !== 'Pending')
              fail(409, 'Only pending enrollments can be edited.');
            const student = this.find(
              this.data.students,
              (row) =>
                row.studentId === (existing?.studentId ?? body.id('studentId')) &&
                row.status === 'Active',
            );
            const year = this.find(
              this.data.schoolYears,
              (row) => row.schoolYearId === (existing?.schoolYearId ?? body.id('schoolYearId')),
            );
            const section = this.find(
              this.data.sections,
              (row) =>
                row.sectionId === body.id('sectionId') && row.schoolYearId === year.schoolYearId,
            );
            this.unique(
              this.data.enrollments,
              (row) =>
                row.enrollmentId !== newId &&
                row.studentId === student.studentId &&
                row.schoolYearId === year.schoolYearId,
            );
            const type = body.text('enrollmentType');
            if (type !== 'New' && type !== 'Returning' && type !== 'Transferee')
              fail(400, 'Invalid enrollment type.');
            const subjects = body
              .ids('sectionSubjectIds')
              .map((subjectId) =>
                this.find(
                  this.data.offerings,
                  (row) =>
                    row.sectionSubjectId === subjectId &&
                    row.sectionId === section.sectionId &&
                    row.isActive,
                ),
              );
            if (!subjects.length) fail(400, 'Select at least one active section subject.');
            return {
              enrollmentId: newId,
              studentId: student.studentId,
              studentNumber: student.studentNumber,
              studentName: `${student.firstName} ${student.lastName}`,
              schoolYearId: year.schoolYearId,
              schoolYearCode: year.code,
              sectionId: section.sectionId,
              sectionName: section.name,
              gradeLevelId: section.gradeLevelId,
              gradeLevelName: section.gradeLevelName,
              enrollmentType: type,
              status: 'Pending',
              createdAtUtc: existing?.createdAtUtc ?? new Date().toISOString(),
              updatedAtUtc: existing ? new Date().toISOString() : null,
              enrolledAtUtc: null,
              subjects,
            };
          },
        );
      }
      case 'schedules': {
        if (writing) this.allow(user, REGISTRAR);
        if (method === 'GET')
          return this.data.schedules.filter((row) =>
            this.filter(request, 'sectionId', row.sectionId),
          );
        if (method === 'DELETE' && id !== undefined) {
          const existing = this.find(this.data.schedules, (row) => row.scheduleEntryId === id);
          this.data.schedules.splice(this.data.schedules.indexOf(existing), 1);
          return null;
        }
        return this.crud(
          request,
          id,
          this.data.schedules,
          (row) => row.scheduleEntryId,
          (newId) => {
            const existing = this.data.schedules.find((row) => row.scheduleEntryId === newId);
            const offering = this.find(
              this.data.offerings,
              (row) =>
                row.sectionSubjectId ===
                (existing?.sectionSubjectId ?? body.id('sectionSubjectId')),
            );
            const section = this.find(
              this.data.sections,
              (row) => row.sectionId === offering.sectionId,
            );
            const roomId = body.optionalNumber('roomId');
            const room =
              roomId === null
                ? null
                : this.find(this.data.rooms, (row) => row.roomId === roomId && row.isActive);
            const dayOfWeek = body.number('dayOfWeek');
            if (!Number.isInteger(dayOfWeek) || dayOfWeek > 6) fail(400, 'Choose a valid weekday.');
            const startTime = this.time(body.text('startTime'));
            const endTime = this.time(body.text('endTime'));
            if (startTime >= endTime) fail(400, 'Start time must be before end time.');
            this.unique(
              this.data.schedules,
              (row) =>
                row.scheduleEntryId !== newId &&
                row.dayOfWeek === dayOfWeek &&
                row.startTime < endTime &&
                startTime < row.endTime &&
                (row.sectionId === section.sectionId ||
                  (roomId !== null && row.roomId === roomId) ||
                  (offering.teacherId !== null && row.teacherId === offering.teacherId)),
            );
            return {
              scheduleEntryId: newId,
              ...offering,
              sectionName: section.name,
              roomId,
              roomName: room?.name ?? null,
              dayOfWeek,
              startTime,
              endTime,
            };
          },
        );
      }
      case 'attendance':
        this.allow(user, [...ADMIN, 'Teacher', 'Adviser', 'Staff']);
        return this.attendance(request, rawId, body, user);
      case 'grading':
        this.allow(user, GRADERS);
        return this.grading(request, path, body, user);
      case 'system-settings':
        this.allow(user, ADMIN);
        if (method === 'GET') return this.data.settings;
        if (method === 'PUT') {
          const key = body.text('key');
          const existing = this.data.settings.find((row) => row.key === key);
          return this.save(this.data.settings, existing, { key, value: body.text('value', false) });
        }
        break;
      case 'reports':
        if (rawId !== 'dashboard') this.allow(user, [...ADMIN, 'Principal']);
        if (method === 'GET') {
          const enrollment = this.enrollmentSummary(request);
          if (rawId === 'enrollment-summary')
            return action === 'export' ? this.exportRows(enrollment, request) : enrollment;
          const attendance = this.attendanceSummary(request);
          if (rawId === 'attendance-summary')
            return action === 'export' ? this.exportRows(attendance, request) : attendance;
          if (rawId === 'dashboard' && action === 'summary') return { enrollment, attendance };
        }
        break;
    }
    return fail(404, `No demo handler for ${method} ${path.join('/')}.`);
  }

  private auth(method: string, action: string, body: Body): TokenResponse | null {
    if (method !== 'POST') fail(404, 'Unsupported demo authentication request.');
    if (action === 'logout') return null;
    let user: ManagedUser;
    if (action === 'login') {
      const username = body.text('username');
      const password = body.text('password');
      user = this.find(
        this.data.users,
        (row) =>
          row.username.toLowerCase() === username.toLowerCase() &&
          row.isActive &&
          this.data.passwords.get(row.userId) === password,
        401,
      );
    } else if (action === 'refresh') {
      const token = body.text('refreshToken');
      user = this.find(
        this.data.users,
        (row) => token === `demo-refresh-${row.userId}` && row.isActive,
        401,
      );
    } else return fail(404, 'Unknown demo authentication action.');
    return {
      accessToken: `demo-access-${user.userId}`,
      refreshToken: `demo-refresh-${user.userId}`,
      accessTokenExpiresAtUtc: new Date(Date.now() + 3600000).toISOString(),
      refreshTokenExpiresAtUtc: new Date(Date.now() + 86400000).toISOString(),
      userId: user.userId,
      username: user.username,
      roles: [...user.roles],
    };
  }

  private academic(request: HttpRequest<unknown>, path: string[], body: Body): unknown {
    const kind = path[1];
    const id = path[2] ? Number(path[2]) : undefined;
    if (kind === 'school-years' && path[3] === 'activate' && request.method === 'POST') {
      const selected = this.find(this.data.schoolYears, (row) => row.schoolYearId === id);
      this.data.schoolYears.forEach((row) => (row.isActive = row === selected));
      return null;
    }
    switch (kind) {
      case 'school-years':
        return this.crud(
          request,
          id,
          this.data.schoolYears,
          (row) => row.schoolYearId,
          (newId) => {
            const code = body.text('code');
            this.unique(
              this.data.schoolYears,
              (row) => row.schoolYearId !== newId && row.code === code,
            );
            const startsOn = this.date(body.text('startsOn'));
            const endsOn = this.date(body.text('endsOn'));
            if (startsOn > endsOn) fail(400, 'Invalid school year date range.');
            return {
              schoolYearId: newId,
              code,
              startsOn,
              endsOn,
              isActive:
                this.data.schoolYears.find((row) => row.schoolYearId === newId)?.isActive ?? false,
            };
          },
        );
      case 'departments':
        return this.crud(
          request,
          id,
          this.data.departments,
          (row) => row.departmentId,
          (newId) => ({
            departmentId: newId,
            name: body.text('name'),
            isActive: body.bool('isActive'),
          }),
        );
      case 'grade-levels':
        return this.crud(
          request,
          id,
          this.data.gradeLevels,
          (row) => row.gradeLevelId,
          (newId) => {
            const existing = this.data.gradeLevels.find((row) => row.gradeLevelId === newId);
            const department = this.find(
              this.data.departments,
              (row) => row.departmentId === (existing?.departmentId ?? body.id('departmentId')),
            );
            return {
              gradeLevelId: newId,
              departmentId: department.departmentId,
              departmentName: department.name,
              code: body.text('code'),
              name: body.text('name'),
              sortOrder: body.number('sortOrder'),
            };
          },
        );
      case 'subjects':
        return this.crud(
          request,
          id,
          this.data.subjects,
          (row) => row.subjectId,
          (newId) => {
            const code = body.text('code');
            this.unique(this.data.subjects, (row) => row.subjectId !== newId && row.code === code);
            return {
              subjectId: newId,
              code,
              name: body.text('name'),
              isActive: body.bool('isActive'),
            };
          },
        );
      case 'rooms':
        return this.crud(
          request,
          id,
          this.data.rooms,
          (row) => row.roomId,
          (newId) => ({
            roomId: newId,
            code: body.text('code'),
            name: body.text('name'),
            capacity: body.optionalNumber('capacity'),
            isActive: body.bool('isActive'),
          }),
        );
      case 'tracks':
        return this.crud(
          request,
          id,
          this.data.tracks,
          (row) => row.trackId,
          (newId) => ({
            trackId: newId,
            name: body.text('name'),
            isActive: body.bool('isActive'),
          }),
        );
      case 'strands':
        return this.crud(
          request,
          id,
          this.data.strands,
          (row) => row.strandId,
          (newId) => {
            const existing = this.data.strands.find((row) => row.strandId === newId);
            const track = this.find(
              this.data.tracks,
              (row) => row.trackId === (existing?.trackId ?? body.id('trackId')),
            );
            return {
              strandId: newId,
              trackId: track.trackId,
              trackName: track.name,
              code: body.text('code'),
              name: body.text('name'),
            };
          },
        );
    }
    return fail(404, 'Unknown academic demo resource.');
  }

  private enrollmentAction(row: Enrollment, action: string, body: Body): Enrollment {
    const allowed: Record<string, string[]> = {
      confirm: ['Pending'],
      cancel: ['Pending'],
      transfer: ['Enrolled'],
      drop: ['Enrolled'],
    };
    if (!allowed[action]?.includes(row.status)) fail(409, 'Invalid enrollment status transition.');
    if (action !== 'confirm') body.text('reason');
    row.status =
      action === 'confirm'
        ? 'Enrolled'
        : action === 'cancel'
          ? 'Cancelled'
          : action === 'transfer'
            ? 'Transferred'
            : 'Dropped';
    row.updatedAtUtc = new Date().toISOString();
    if (action === 'confirm') row.enrolledAtUtc = row.updatedAtUtc;
    return row;
  }

  private attendance(
    request: HttpRequest<unknown>,
    action: string,
    body: Body,
    user: ManagedUser,
  ): unknown {
    if (action === 'rules') {
      if (request.method === 'GET') return this.data.rules;
      if (request.method === 'PUT') {
        this.allow(user, ADMIN);
        const rules = {
          morningStart: this.time(body.text('morningStart')),
          morningLateThresholdMinutes: body.number('morningLateThresholdMinutes'),
          afternoonStart: this.time(body.text('afternoonStart')),
          afternoonLateThresholdMinutes: body.number('afternoonLateThresholdMinutes'),
          teacherStart: this.time(body.text('teacherStart')),
          teacherLateThresholdMinutes: body.number('teacherLateThresholdMinutes'),
          teacherEndTime: this.time(body.text('teacherEndTime')),
        };
        this.data.rules = rules;
        return rules;
      }
    }
    if (request.method === 'GET' && (action === 'records' || action === 'teacher-records')) {
      const date = this.date(request.params.get('date') ?? '');
      return action === 'records'
        ? this.data.attendance.filter(
            (row) =>
              row.attendanceDate === date && this.filter(request, 'sectionId', row.sectionId),
          )
        : this.data.teacherAttendance.filter((row) => row.attendanceDate === date);
    }
    if (request.method !== 'POST') fail(404, 'Unsupported demo attendance action.');
    const scannedAt = new Date(body.text('scannedAtUtc'));
    if (!Number.isFinite(scannedAt.getTime())) fail(400, 'Invalid scan timestamp.');
    const attendanceDate = localDate(scannedAt);
    const minutes = scannedAt.getHours() * 60 + scannedAt.getMinutes();
    const timeIn = scannedAt.toISOString();
    if (action === 'student-scans') {
      const code = body.text('code');
      const student = this.find(
        this.data.students,
        (row) => (row.studentNumber === code || row.lrn === code) && row.status === 'Active',
      );
      const enrollment = this.find(
        this.data.enrollments,
        (row) =>
          row.studentId === student.studentId &&
          row.status === 'Enrolled' &&
          this.data.schoolYears.some(
            (year) => year.schoolYearId === row.schoolYearId && year.isActive,
          ),
      );
      const session =
        minutes < this.timeMinutes(this.data.rules.afternoonStart) ? 'Morning' : 'Afternoon';
      const start =
        session === 'Morning' ? this.data.rules.morningStart : this.data.rules.afternoonStart;
      const threshold =
        session === 'Morning'
          ? this.data.rules.morningLateThresholdMinutes
          : this.data.rules.afternoonLateThresholdMinutes;
      const existing = this.data.attendance.find(
        (row) =>
          row.enrollmentId === enrollment.enrollmentId &&
          row.attendanceDate === attendanceDate &&
          row.session === session,
      );
      if (existing?.timeIn) {
        if (existing.timeOut) fail(409, 'This attendance session already has a time-out.');
        existing.timeOut = timeIn;
        return existing;
      }
      const record = {
        attendanceRecordId:
          existing?.attendanceRecordId ??
          this.nextId(this.data.attendance, (row) => row.attendanceRecordId),
        enrollmentId: enrollment.enrollmentId,
        attendanceDate,
        session,
        status: minutes > this.timeMinutes(start) + threshold ? 'Late' : 'Present',
        timeIn,
        timeOut: null,
        isManualCorrection: false,
        correctionReason: null,
        studentId: student.studentId,
        studentNumber: student.studentNumber,
        firstName: student.firstName,
        middleName: student.middleName,
        lastName: student.lastName,
        sectionId: enrollment.sectionId,
        sectionName: enrollment.sectionName,
      };
      return this.save(this.data.attendance, existing, record);
    }
    if (action === 'teacher-scans') {
      const employeeNumber = body.text('employeeNumber');
      const teacher = this.find(
        this.data.teachers,
        (row) => row.employeeNumber === employeeNumber && row.isActive,
      );
      const existing = this.data.teacherAttendance.find(
        (row) => row.teacherId === teacher.teacherId && row.attendanceDate === attendanceDate,
      );
      if (existing?.timeIn) {
        if (existing.timeOut) fail(409, 'This teacher already has a time-out for this date.');
        existing.timeOut = timeIn;
        existing.overtimeMinutes = Math.max(
          0,
          minutes - this.timeMinutes(this.data.rules.teacherEndTime),
        );
        return existing;
      }
      const record = {
        teacherAttendanceRecordId: this.nextId(
          this.data.teacherAttendance,
          (row) => row.teacherAttendanceRecordId,
        ),
        teacherId: teacher.teacherId,
        employeeNumber,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        attendanceDate,
        timeIn,
        timeOut: null,
        status:
          minutes >
          this.timeMinutes(this.data.rules.teacherStart) +
            this.data.rules.teacherLateThresholdMinutes
            ? 'Late'
            : 'Present',
        overtimeMinutes: null,
        isManualCorrection: false,
        correctionReason: null,
      };
      return this.save(this.data.teacherAttendance, existing, record);
    }
    return fail(404, 'Unknown attendance demo action.');
  }

  private grading(
    request: HttpRequest<unknown>,
    path: string[],
    body: Body,
    user: ManagedUser,
  ): unknown {
    const [, kind, rawId, action, rawGradeId] = path;
    const id = rawId ? Number(rawId) : undefined;
    const method = request.method;
    if (kind === 'templates') {
      if (method === 'GET') {
        if (action === 'components') {
          this.find(this.data.templates, (row) => row.gradingTemplateId === id);
          return this.data.components.filter((row) => row.gradingTemplateId === id);
        }
        return this.data.templates.filter((row) =>
          this.filter(request, 'templateKey', row.templateKey),
        );
      }
      if (method === 'POST') {
        this.allow(user, ADMIN);
        const templateKey = body.text('templateKey');
        const versionNumber = body.id('versionNumber');
        this.unique(
          this.data.templates,
          (row) => row.templateKey === templateKey && row.versionNumber === versionNumber,
        );
        const name = body.text('name');
        const gradingTemplateId = this.nextId(this.data.templates, (row) => row.gradingTemplateId);
        const nextComponentId = this.nextId(
          this.data.components,
          (row) => row.gradingTemplateComponentId,
        );
        const components = body.list('components').map((value, index) => {
          const part = new Body(value);
          return {
            gradingTemplateComponentId: nextComponentId + index,
            gradingTemplateId,
            name: part.text('name'),
            weightPercent: part.number('weightPercent'),
            sortOrder: part.number('sortOrder'),
          };
        });
        if (
          !components.length ||
          Math.abs(components.reduce((sum, row) => sum + row.weightPercent, 0) - 100) > 0.000001
        )
          fail(400, 'Component weights must total 100%.');
        this.data.templates.push({
          gradingTemplateId,
          templateKey,
          versionNumber,
          name,
          isActive: true,
          createdAtUtc: new Date().toISOString(),
        });
        this.data.components.push(...components);
        return { gradingTemplateId };
      }
    }
    if (kind === 'periods') {
      if (method === 'GET' && id === undefined)
        return this.data.periods.filter(
          (row) =>
            this.filter(request, 'schoolYearId', row.schoolYearId) &&
            this.filter(request, 'gradeLevelId', row.gradeLevelId),
        );
      if (method === 'POST') {
        this.allow(user, ADMIN);
        const year = this.find(
          this.data.schoolYears,
          (row) => row.schoolYearId === body.id('schoolYearId'),
        );
        const grade = this.find(
          this.data.gradeLevels,
          (row) => row.gradeLevelId === body.id('gradeLevelId'),
        );
        const template = this.find(
          this.data.templates,
          (row) => row.gradingTemplateId === body.id('gradingTemplateId'),
        );
        const startsOn = this.date(body.text('startsOn'));
        const endsOn = this.date(body.text('endsOn'));
        if (startsOn > endsOn) fail(400, 'Invalid period date range.');
        const periodType = body.text('periodType');
        const periodNumber = body.id('periodNumber');
        this.unique(
          this.data.periods,
          (row) =>
            row.schoolYearId === year.schoolYearId &&
            row.gradeLevelId === grade.gradeLevelId &&
            row.periodType === periodType &&
            row.periodNumber === periodNumber,
        );
        const gradingPeriodId = this.nextId(this.data.periods, (row) => row.gradingPeriodId);
        this.data.periods.push({
          gradingPeriodId,
          schoolYearId: year.schoolYearId,
          gradeLevelId: grade.gradeLevelId,
          gradingTemplateId: template.gradingTemplateId,
          periodType,
          periodNumber,
          name: body.text('name'),
          startsOn,
          endsOn,
          departmentId: grade.departmentId,
          templateKey: template.templateKey,
          versionNumber: template.versionNumber,
          templateName: template.name,
        });
        return { gradingPeriodId };
      }
      const period = this.find(this.data.periods, (row) => row.gradingPeriodId === id);
      const sections = this.data.sections.filter(
        (row) =>
          row.schoolYearId === period.schoolYearId && row.gradeLevelId === period.gradeLevelId,
      );
      if (method === 'GET' && action === 'sections')
        return sections
          .filter((section) => this.sectionAccessible(user, section))
          .map((row) => ({
            sectionId: row.sectionId,
            sectionName: row.name,
            gradeLevelName: row.gradeLevelName,
          }));
      if (method === 'GET' && action === 'entries') {
        const section = this.find(
          sections,
          (row) => row.sectionId === Number(request.params.get('sectionId')),
        );
        if (!this.sectionAccessible(user, section))
          fail(403, 'This section is not assigned to this demo account.');
        return this.page(
          this.data.enrollments.filter(
            (row) => row.sectionId === section.sectionId && row.status === 'Enrolled',
          ),
          request,
        ).items.map((row) => ({
          enrollmentId: row.enrollmentId,
          studentNumber: row.studentNumber,
          studentName: row.studentName,
          subjects: row.subjects
            .filter((subject) => this.subjectAccessible(user, section, subject.teacherId))
            .map((subject) => ({
              sectionSubjectId: subject.sectionSubjectId,
              subjectCode: subject.subjectCode,
              subjectName: subject.subjectName,
            })),
        }));
      }
      if (action === 'grades') {
        const rows = this.data.grades.filter(
          (row) => row.gradingPeriodId === id && this.gradeAccessible(user, row),
        );
        if (method === 'GET')
          return rows.filter((row) => this.filter(request, 'sectionId', row.sectionId));
        if (method === 'PUT' && path[5] === 'scores') {
          const grade = this.find(rows, (row) => row.gradeRecordId === Number(rawGradeId));
          if (grade.workflowStatus !== 'Draft') fail(409, 'Only draft grades can be edited.');
          const components = this.data.components.filter(
            (row) => row.gradingTemplateId === period.gradingTemplateId,
          );
          const scores = body.list('scores').map((value) => {
            const score = new Body(value);
            return {
              componentId: score.id('gradingTemplateComponentId'),
              raw: score.number('rawScore'),
              max: score.number('maximumScore', Number.EPSILON),
            };
          });
          if (
            scores.length !== components.length ||
            new Set(scores.map((row) => row.componentId)).size !== components.length ||
            scores.some(
              (row) =>
                row.raw > row.max ||
                !components.some(
                  (component) => component.gradingTemplateComponentId === row.componentId,
                ),
            )
          )
            fail(400, 'Provide valid scores for every component.');
          grade.computedGrade =
            Math.round(
              components.reduce((sum, component) => {
                const score = this.find(
                  scores,
                  (row) => row.componentId === component.gradingTemplateComponentId,
                );
                return sum + (score.raw / score.max) * component.weightPercent;
              }, 0) * 100,
            ) / 100;
          grade.updatedAtUtc = new Date().toISOString();
          return { gradeRecordId: grade.gradeRecordId, computedGrade: grade.computedGrade };
        }
      }
    }
    if (kind === 'grades' && method === 'POST') {
      if (action === 'transitions') {
        const grade = this.find(
          this.data.grades,
          (row) => row.gradeRecordId === id && this.gradeAccessible(user, row),
        );
        const next = body.text('newStatus');
        const transitions: Record<string, string[]> = {
          Draft: ['Submitted'],
          Submitted: ['UnderReview'],
          UnderReview: ['Draft', 'Approved'],
          Approved: ['Finalized'],
          Finalized: ['Draft'],
        };
        if (!transitions[grade.workflowStatus]?.includes(next))
          fail(409, 'Invalid grade workflow transition.');
        if (next === 'Submitted' && grade.computedGrade === null)
          fail(400, 'Save scores before submitting a grade.');
        if (grade.workflowStatus !== 'Draft') this.allow(user, [...ADMIN, 'Adviser', 'Principal']);
        if (grade.workflowStatus === 'Finalized') this.allow(user, ADMIN);
        if (next === 'Draft') body.text('reason');
        grade.workflowStatus = next;
        grade.updatedAtUtc = new Date().toISOString();
        return { gradeRecordId: grade.gradeRecordId, workflowStatus: next };
      }
      const enrollment = this.find(
        this.data.enrollments,
        (row) => row.enrollmentId === body.id('enrollmentId') && row.status === 'Enrolled',
      );
      const subject = this.find(
        enrollment.subjects,
        (row) => row.sectionSubjectId === body.id('sectionSubjectId'),
      );
      const period = this.find(
        this.data.periods,
        (row) =>
          row.gradingPeriodId === body.id('gradingPeriodId') &&
          row.schoolYearId === enrollment.schoolYearId &&
          row.gradeLevelId === enrollment.gradeLevelId,
      );
      const section = this.find(
        this.data.sections,
        (row) => row.sectionId === enrollment.sectionId,
      );
      if (!this.subjectAccessible(user, section, subject.teacherId))
        fail(403, 'This subject is not assigned to this demo account.');
      this.unique(
        this.data.grades,
        (row) =>
          row.enrollmentId === enrollment.enrollmentId &&
          row.sectionSubjectId === subject.sectionSubjectId &&
          row.gradingPeriodId === period.gradingPeriodId,
      );
      const student = this.find(
        this.data.students,
        (row) => row.studentId === enrollment.studentId,
      );
      const grade: GradeRecord = {
        gradeRecordId: this.nextId(this.data.grades, (row) => row.gradeRecordId),
        enrollmentId: enrollment.enrollmentId,
        sectionSubjectId: subject.sectionSubjectId,
        gradingPeriodId: period.gradingPeriodId,
        workflowStatus: 'Draft',
        computedGrade: null,
        createdAtUtc: new Date().toISOString(),
        updatedAtUtc: null,
        studentId: student.studentId,
        studentNumber: student.studentNumber,
        firstName: student.firstName,
        middleName: student.middleName,
        lastName: student.lastName,
        sectionId: section.sectionId,
        sectionName: section.name,
        subjectId: subject.subjectId,
        subjectCode: subject.subjectCode,
        subjectName: subject.subjectName,
        teacherId: subject.teacherId,
      };
      this.data.grades.push(grade);
      return { gradeRecordId: grade.gradeRecordId, workflowStatus: grade.workflowStatus };
    }
    return fail(404, 'Unknown grading demo request.');
  }

  private enrollmentSummary(request: HttpRequest<unknown>): EnrollmentSummaryRow[] {
    const rows: EnrollmentSummaryRow[] = [];
    for (const enrollment of this.data.enrollments.filter((row) =>
      this.filter(request, 'schoolYearId', row.schoolYearId),
    )) {
      const existing = rows.find(
        (row) =>
          row.schoolYearId === enrollment.schoolYearId &&
          row.gradeLevelId === enrollment.gradeLevelId &&
          row.status === enrollment.status,
      );
      if (existing) existing.count++;
      else
        rows.push({
          schoolYearId: enrollment.schoolYearId,
          schoolYearCode: enrollment.schoolYearCode,
          gradeLevelId: enrollment.gradeLevelId,
          gradeLevelName: enrollment.gradeLevelName,
          status: enrollment.status,
          count: 1,
        });
    }
    return rows;
  }

  private attendanceSummary(request: HttpRequest<unknown>): AttendanceSummaryRow[] {
    const from = this.date(request.params.get('from') ?? '');
    const to = this.date(request.params.get('to') ?? '');
    if (from > to) fail(400, 'Invalid report date range.');
    const rows: AttendanceSummaryRow[] = [];
    for (const record of this.data.attendance.filter(
      (row) =>
        row.attendanceDate >= from &&
        row.attendanceDate <= to &&
        this.filter(request, 'sectionId', row.sectionId) &&
        this.data.enrollments.some(
          (enrollment) =>
            enrollment.enrollmentId === row.enrollmentId &&
            this.filter(request, 'schoolYearId', enrollment.schoolYearId),
        ),
    )) {
      const status = record.status;
      if (status !== 'Present' && status !== 'Late' && status !== 'Absent' && status !== 'Excused')
        fail(500, 'Unknown sample attendance status.');
      const existing = rows.find(
        (row) => row.sectionId === record.sectionId && row.status === status,
      );
      if (existing) existing.rowCount++;
      else
        rows.push({
          sectionId: record.sectionId,
          sectionName: record.sectionName,
          status,
          rowCount: 1,
        });
    }
    return rows;
  }

  private exportRows(
    rows: Array<EnrollmentSummaryRow | AttendanceSummaryRow>,
    request: HttpRequest<unknown>,
  ): Blob {
    const format = request.params.get('format');
    const keys = rows.length ? Object.keys(rows[0]) : ['Result'];
    const values = rows.map((row) => Object.values(row).map(String));
    if (format === 'csv') {
      const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
      return new Blob([[keys, ...values].map((row) => row.map(escape).join(',')).join('\r\n')], {
        type: 'text/csv',
      });
    }
    if (format === 'html') {
      const escape = (value: string) =>
        value
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;');
      return new Blob(
        [
          `<!doctype html><html><head><meta charset="utf-8"><title>Demo report</title></head><body><h1>Sample Academy - Demo report</h1><p>Fictional data only.</p><table border="1"><thead><tr>${keys.map((key) => `<th>${escape(key)}</th>`).join('')}</tr></thead><tbody>${values.map((row) => `<tr>${row.map((value) => `<td>${escape(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`,
        ],
        { type: 'text/html' },
      );
    }
    return fail(400, 'Choose CSV or HTML export.');
  }

  private user(request: HttpRequest<unknown>): ManagedUser {
    return this.find(
      this.data.users,
      (row) =>
        request.headers.get('Authorization') === `Bearer demo-access-${row.userId}` && row.isActive,
      401,
    );
  }

  private allow(user: ManagedUser, roles: string[]): void {
    if (!user.roles.some((role) => roles.includes(role)))
      fail(403, 'This action is not available for this demo role.');
  }

  private sectionAccessible(user: ManagedUser, section: Section): boolean {
    return (
      user.roles.some((role) => [...ADMIN, 'Principal'].includes(role)) ||
      (user.roles.includes('Adviser') &&
        user.teacherId !== null &&
        section.adviserTeacherId === user.teacherId) ||
      (user.roles.includes('Teacher') &&
        user.teacherId !== null &&
        this.data.offerings.some(
          (row) => row.sectionId === section.sectionId && row.teacherId === user.teacherId,
        ))
    );
  }

  private subjectAccessible(
    user: ManagedUser,
    section: Section,
    teacherId: number | null,
  ): boolean {
    return (
      user.roles.some((role) => [...ADMIN, 'Principal'].includes(role)) ||
      (user.roles.includes('Adviser') &&
        user.teacherId !== null &&
        section.adviserTeacherId === user.teacherId) ||
      (user.roles.includes('Teacher') && user.teacherId !== null && teacherId === user.teacherId)
    );
  }

  private gradeAccessible(user: ManagedUser, grade: GradeRecord): boolean {
    const section = this.find(this.data.sections, (row) => row.sectionId === grade.sectionId);
    return this.subjectAccessible(user, section, grade.teacherId);
  }

  private roleNames(ids: number[]): string[] {
    if (!ids.length) fail(400, 'Choose at least one role.');
    return [...new Set(ids)].map(
      (id) => this.find(this.data.roles, (row) => row.roleId === id).name,
    );
  }

  private find<T>(rows: T[], predicate: (row: T) => boolean, status = 404): T {
    const row = rows.find(predicate);
    if (!row)
      fail(
        status,
        status === 401
          ? 'Invalid demo credentials or session.'
          : 'The requested demo record was not found.',
      );
    return row;
  }

  private unique<T>(rows: T[], predicate: (row: T) => boolean): void {
    if (rows.some(predicate)) fail(409, 'A duplicate or conflicting demo record already exists.');
  }

  private nextId<T>(rows: T[], getId: (row: T) => number): number {
    return Math.max(0, ...rows.map(getId)) + 1;
  }

  private save<T>(rows: T[], existing: T | undefined, value: T): T {
    if (existing) rows[rows.indexOf(existing)] = value;
    else rows.push(value);
    return value;
  }

  private crud<T>(
    request: HttpRequest<unknown>,
    id: number | undefined,
    rows: T[],
    getId: (row: T) => number,
    create: (id: number) => T,
  ): T | T[] {
    if (request.method === 'GET') return rows;
    if (request.method === 'POST' && id === undefined)
      return this.save(rows, undefined, create(this.nextId(rows, getId)));
    if (request.method === 'PUT' && id !== undefined) {
      const existing = this.find(rows, (row) => getId(row) === id);
      return this.save(rows, existing, create(id));
    }
    return fail(404, 'Unsupported demo operation.');
  }

  private page<T>(
    rows: T[],
    request: HttpRequest<unknown>,
    defaultPageSize = 20,
  ): { items: T[]; page: number; pageSize: number; totalCount: number } {
    const page = Number(request.params.get('page') ?? 1);
    const pageSize = Number(request.params.get('pageSize') ?? defaultPageSize);
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    )
      fail(400, 'Invalid pagination.');
    return {
      items: rows.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      totalCount: rows.length,
    };
  }

  private filter(request: HttpRequest<unknown>, key: string, value: string | number): boolean {
    const filter = request.params.get(key);
    return !filter || filter === String(value);
  }

  private search(request: HttpRequest<unknown>, values: string[]): boolean {
    const search = request.params.get('search')?.toLowerCase() ?? '';
    return values.some((value) => value.toLowerCase().includes(search));
  }

  private time(value: string): string {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)) fail(400, 'Enter a valid time.');
    return value.length === 5 ? `${value}:00` : value;
  }

  private timeMinutes(value: string): number {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private date(value: string): string {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(new Date(`${value}T00:00:00`).getTime()) ||
      localDate(new Date(`${value}T00:00:00`)) !== value
    )
      fail(400, 'Enter a valid date.');
    return value;
  }

  private studentStatus(value: string): (typeof this.data.students)[number]['status'] {
    switch (value) {
      case 'Active':
      case 'Inactive':
      case 'Transferred':
      case 'Dropped':
      case 'Graduated':
      case 'Archived':
        return value;
      default:
        return fail(400, 'Invalid student status.');
    }
  }

  private syncRelations(): void {
    for (const teacher of this.data.teachers)
      teacher.linkedUserId =
        this.data.users.find((row) => row.teacherId === teacher.teacherId)?.userId ?? null;
    for (const grade of this.data.gradeLevels)
      grade.departmentName = this.find(
        this.data.departments,
        (row) => row.departmentId === grade.departmentId,
      ).name;
    for (const strand of this.data.strands)
      strand.trackName = this.find(this.data.tracks, (row) => row.trackId === strand.trackId).name;
    for (const section of this.data.sections) {
      section.schoolYearCode = this.find(
        this.data.schoolYears,
        (row) => row.schoolYearId === section.schoolYearId,
      ).code;
      section.gradeLevelName = this.find(
        this.data.gradeLevels,
        (row) => row.gradeLevelId === section.gradeLevelId,
      ).name;
      section.strandName =
        section.strandId === null
          ? null
          : this.find(this.data.strands, (row) => row.strandId === section.strandId).name;
      const teacher = this.data.teachers.find((row) => row.teacherId === section.adviserTeacherId);
      section.adviserName = teacher ? `${teacher.firstName} ${teacher.lastName}` : null;
    }
    for (const offering of this.data.offerings) {
      const subject = this.find(this.data.subjects, (row) => row.subjectId === offering.subjectId);
      offering.subjectCode = subject.code;
      offering.subjectName = subject.name;
      const teacher = this.data.teachers.find((row) => row.teacherId === offering.teacherId);
      offering.teacherName = teacher ? `${teacher.firstName} ${teacher.lastName}` : null;
    }
    for (const enrollment of this.data.enrollments) {
      const student = this.find(
        this.data.students,
        (row) => row.studentId === enrollment.studentId,
      );
      const section = this.find(
        this.data.sections,
        (row) => row.sectionId === enrollment.sectionId,
      );
      enrollment.studentNumber = student.studentNumber;
      enrollment.studentName = `${student.firstName} ${student.lastName}`;
      enrollment.sectionName = section.name;
      enrollment.schoolYearCode = section.schoolYearCode;
      enrollment.gradeLevelName = section.gradeLevelName;
      enrollment.subjects = enrollment.subjects.map((subject) =>
        this.find(this.data.offerings, (row) => row.sectionSubjectId === subject.sectionSubjectId),
      );
    }
    for (const schedule of this.data.schedules) {
      const offering = this.find(
        this.data.offerings,
        (row) => row.sectionSubjectId === schedule.sectionSubjectId,
      );
      Object.assign(schedule, {
        subjectName: offering.subjectName,
        teacherId: offering.teacherId,
        teacherName: offering.teacherName,
        sectionName: this.find(this.data.sections, (row) => row.sectionId === schedule.sectionId)
          .name,
        roomName: this.data.rooms.find((row) => row.roomId === schedule.roomId)?.name ?? null,
      });
    }
    for (const grade of this.data.grades) {
      const student = this.find(this.data.students, (row) => row.studentId === grade.studentId);
      const offering = this.find(
        this.data.offerings,
        (row) => row.sectionSubjectId === grade.sectionSubjectId,
      );
      Object.assign(grade, {
        firstName: student.firstName,
        middleName: student.middleName,
        lastName: student.lastName,
        studentNumber: student.studentNumber,
        subjectCode: offering.subjectCode,
        subjectName: offering.subjectName,
        teacherId: offering.teacherId,
        sectionName: this.find(this.data.sections, (row) => row.sectionId === grade.sectionId).name,
      });
    }
    for (const record of this.data.attendance) {
      const student = this.find(this.data.students, (row) => row.studentId === record.studentId);
      Object.assign(record, {
        firstName: student.firstName,
        middleName: student.middleName,
        lastName: student.lastName,
        studentNumber: student.studentNumber,
        sectionName: this.find(this.data.sections, (row) => row.sectionId === record.sectionId)
          .name,
      });
    }
    for (const record of this.data.teacherAttendance) {
      const teacher = this.find(this.data.teachers, (row) => row.teacherId === record.teacherId);
      Object.assign(record, {
        employeeNumber: teacher.employeeNumber,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
      });
    }
  }
}
