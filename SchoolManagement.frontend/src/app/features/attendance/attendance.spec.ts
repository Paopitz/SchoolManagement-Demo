import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Phase2ApiService } from '../../core/services/phase2-api.service';
import { Phase36ApiService } from '../../core/services/phase36-api.service';
import { AuthService } from '../../core/services/auth.service';
import { AttendancePage } from './attendance';

describe('AttendancePage', () => {
  let fixture: ComponentFixture<AttendancePage>;
  let component: AttendancePage;
  const api = {
    scanAttendance: vi.fn(),
    getAttendance: vi.fn(() => of([])),
    getAttendanceRules: vi.fn(),
    saveAttendanceRules: vi.fn(),
  };

  beforeEach(async () => {
    api.scanAttendance.mockReset();
    api.getAttendance.mockReturnValue(of([]));
    await TestBed.configureTestingModule({
      imports: [AttendancePage],
      providers: [
        { provide: Phase36ApiService, useValue: api },
        { provide: Phase2ApiService, useValue: { getSections: () => of([]) } },
        { provide: AuthService, useValue: { hasAnyRole: () => false } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AttendancePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('posts a trimmed scanner value, clears the field and reloads the day after success', () => {
    api.scanAttendance.mockReturnValue(of({
      studentName: 'Test Learner', studentNumber: 'TEST-01', status: 'Present',
      session: 'Morning In', recordedAtUtc: '2026-10-05T08:00:00Z',
    }));
    component.scanId = ' TEST-01 ';
    component.scan();

    expect(api.scanAttendance).toHaveBeenCalledWith('TEST-01');
    expect(component.scanId).toBe('');
    expect(component.notice()).toContain('Present');
    expect(component.loading()).toBe(false);
    expect(api.getAttendance).toHaveBeenCalled();
  });

  it('keeps an actionable conflict error visible when a scan is rejected', () => {
    api.scanAttendance.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 409, error: { detail: 'Duplicate scan for this session.' },
    })));
    component.scanId = 'TEST-01';
    component.scan();

    expect(component.error()).toBe('Duplicate scan for this session.');
    expect(component.loading()).toBe(false);
    expect(component.scanId).toBe('TEST-01');
  });
});
