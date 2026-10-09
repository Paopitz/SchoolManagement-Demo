import { Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Section } from '../../core/models/phase2.models';
import { AttendanceRecord, AttendanceScanResult, TeacherAttendanceRecord, TeacherAttendanceScanResult } from '../../core/models/phase36.models';
import { Phase2ApiService } from '../../core/services/phase2-api.service';
import { Phase36ApiService } from '../../core/services/phase36-api.service';
import { apiErrorMessage } from '../../core/utils/api-error-message';
import { AuthService } from '../../core/services/auth.service';

interface AttendanceRulesDraft {
  morningStart: string;
  morningLateThresholdMinutes: number | null;
  afternoonStart: string;
  afternoonLateThresholdMinutes: number | null;
  teacherStart: string;
  teacherLateThresholdMinutes: number | null;
  teacherEndTime: string;
}

@Component({ selector: 'app-attendance', standalone: true, imports: [FormsModule], templateUrl: './attendance.html', styleUrl: './attendance.scss' })
export class AttendancePage implements OnInit {
  private readonly api = inject(Phase36ApiService);
  private readonly lookups = inject(Phase2ApiService);
  private readonly auth = inject(AuthService);
  @ViewChild('scanInput') private scanInput?: ElementRef<HTMLInputElement>;
  readonly canConfigure = () => this.auth.hasAnyRole(['Super Admin', 'Admin']);
  readonly sections = signal<Section[]>([]);
  readonly records = signal<AttendanceRecord[]>([]);
  readonly teacherRecords = signal<TeacherAttendanceRecord[]>([]);
  readonly lastResult = signal<AttendanceScanResult | null>(null);
  readonly lastTeacherResult = signal<TeacherAttendanceScanResult | null>(null);
  readonly rules = signal<AttendanceRulesDraft | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  activeTab = 'scan';
  scanType = 'students';
  viewType = 'students';
  scanId = '';
  date = this.today();
  sectionId = 0;

  ngOnInit(): void {
    this.lookups.getSections().subscribe({ next: rows => this.sections.set(rows), error: e => this.showError(e) });
    this.loadRecords();
  }

  scan(): void {
    const value = this.scanId.trim();
    if (!value) { this.error.set(this.scanType === 'teachers' ? 'Enter or scan an employee ID first.' : 'Enter or scan a student ID first.'); return; }
    this.loading.set(true); this.error.set(''); this.notice.set('');
    if (this.scanType === 'teachers') {
      this.viewType = 'teachers';
      this.api.scanTeacherAttendance(value).subscribe({
        next: result => {
          this.lastTeacherResult.set(result); this.notice.set(`Teacher attendance recorded: ${result.status}.`);
          this.scanId = ''; this.loading.set(false); this.setScanFocus(); this.loadRecords();
        },
        error: e => { this.loading.set(false); this.showError(e); this.setScanFocus(); },
      });
      return;
    }
    this.viewType = 'students';
    this.api.scanAttendance(value).subscribe({
      next: result => {
        this.lastResult.set(result);
        this.notice.set(`Attendance recorded: ${result.status} · ${result.session}.`);
        this.scanId = '';
        this.loading.set(false);
        this.loadRecords();
        this.setScanFocus();
      },
      error: e => { this.loading.set(false); this.showError(e); this.scanInput?.nativeElement.focus(); },
    });
  }

  private setScanFocus(): void { setTimeout(() => this.scanInput?.nativeElement.focus()); }
  loadRecords(): void {
    if (!this.date) { this.error.set('Choose a date to load attendance.'); return; }
    this.loading.set(true); this.error.set('');
    if (this.viewType === 'teachers') {
      this.api.getTeacherAttendance(this.date).subscribe({
        next: rows => { this.teacherRecords.set(rows); this.loading.set(false); },
        error: e => { this.loading.set(false); this.showError(e); },
      });
      return;
    }
    this.api.getAttendance(this.date, this.sectionId || undefined).subscribe({
      next: rows => { this.records.set(rows); this.loading.set(false); },
      error: e => { this.loading.set(false); this.showError(e); },
    });
  }

  loadRules(): void {
    this.loading.set(true); this.error.set('');
    this.api.getAttendanceRules().subscribe({
      next: rules => { this.rules.set({ ...rules }); this.loading.set(false); },
      error: e => { this.loading.set(false); this.showError(e); },
    });
  }

  startRulesSetup(): void {
    this.error.set('');
    this.rules.set({ morningStart: '', morningLateThresholdMinutes: null, afternoonStart: '', afternoonLateThresholdMinutes: null, teacherStart: '', teacherLateThresholdMinutes: null, teacherEndTime: '' });
  }

  saveRules(): void {
    const value = this.rules();
    if (!value || !value.morningStart || !value.afternoonStart
      || value.morningLateThresholdMinutes === null || value.afternoonLateThresholdMinutes === null
      || value.teacherLateThresholdMinutes === null || !value.teacherStart || !value.teacherEndTime
      || !Number.isFinite(value.morningLateThresholdMinutes) || !Number.isFinite(value.afternoonLateThresholdMinutes)
      || !Number.isFinite(value.teacherLateThresholdMinutes)
      || value.morningLateThresholdMinutes < 0 || value.afternoonLateThresholdMinutes < 0 || value.teacherLateThresholdMinutes < 0) {
      this.error.set('Enter both start times and non-negative late thresholds.'); return;
    }
    this.saving.set(true); this.error.set('');
    this.api.saveAttendanceRules({
      morningStart: value.morningStart,
      morningLateThresholdMinutes: value.morningLateThresholdMinutes,
      afternoonStart: value.afternoonStart,
      afternoonLateThresholdMinutes: value.afternoonLateThresholdMinutes,
      teacherStart: value.teacherStart,
      teacherLateThresholdMinutes: value.teacherLateThresholdMinutes,
      teacherEndTime: value.teacherEndTime,
    }).subscribe({
      next: saved => { this.rules.set(saved); this.saving.set(false); this.notice.set('Attendance rules saved.'); },
      error: e => { this.saving.set(false); this.showError(e); },
    });
  }

  private today(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  private showError(error: unknown): void { this.error.set(apiErrorMessage(error)); }
}
