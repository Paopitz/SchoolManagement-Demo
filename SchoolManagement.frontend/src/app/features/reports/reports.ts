import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AttendanceSummaryRow, EnrollmentSummaryRow } from '../../core/models/phase3.models';
import { SchoolYear, Section } from '../../core/models/phase2.models';
import { Phase2ApiService } from '../../core/services/phase2-api.service';
import { Phase3ApiService } from '../../core/services/phase3-api.service';
import { Phase36ApiService } from '../../core/services/phase36-api.service';
import { apiErrorMessage } from '../../core/utils/api-error-message';

@Component({ selector: 'app-reports', standalone: true, imports: [FormsModule], templateUrl: './reports.html', styleUrl: './reports.scss' })
export class ReportsPage implements OnInit {
  private readonly api = inject(Phase3ApiService);
  private readonly exports = inject(Phase36ApiService);
  private readonly lookups = inject(Phase2ApiService);
  readonly enrollmentRows = signal<EnrollmentSummaryRow[]>([]);
  readonly attendanceRows = signal<AttendanceSummaryRow[]>([]);
  readonly schoolYears = signal<SchoolYear[]>([]);
  readonly sections = signal<Section[]>([]);
  readonly loadingEnrollment = signal(false);
  readonly loadingAttendance = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  enrollmentYearId = 0;
  attendanceYearId = 0;
  sectionId = 0;
  from = this.monthStart();
  to = this.today();
  activeTab = 'attendance';
  format: 'csv' | 'html' = 'csv';

  ngOnInit(): void {
    this.lookups.getSchoolYears().subscribe({ next: (rows) => { this.schoolYears.set(rows); this.attendanceYearId = rows.find((row) => row.isActive)?.schoolYearId ?? 0; this.loadEnrollment(); this.loadAttendance(); }, error: (error) => this.showError(error) });
    this.lookups.getSections().subscribe({ next: (rows) => this.sections.set(rows), error: (error) => this.showError(error) });
  }

  loadEnrollment(): void {
    this.loadingEnrollment.set(true); this.error.set('');
    this.api.getEnrollmentSummary(this.enrollmentYearId || undefined).subscribe({ next: (rows) => { this.enrollmentRows.set(rows); this.loadingEnrollment.set(false); }, error: (error) => { this.loadingEnrollment.set(false); this.showError(error); } });
  }

  loadAttendance(): void {
    if (!this.from || !this.to) { this.error.set('Choose a start and end date.'); return; }
    if (this.from > this.to) { this.error.set('Start date must be on or before end date.'); return; }
    this.loadingAttendance.set(true); this.error.set('');
    this.api.getAttendanceSummary({ from: this.from, to: this.to, sectionId: this.sectionId || undefined, schoolYearId: this.attendanceYearId || undefined }).subscribe({ next: (rows) => { this.attendanceRows.set(rows); this.loadingAttendance.set(false); }, error: (error) => { this.loadingAttendance.set(false); this.showError(error); } });
  }

  enrollmentTotal(): number { return this.enrollmentRows().reduce((sum, row) => sum + row.count, 0); }
  attendanceTotal(): number { return this.attendanceRows().reduce((sum, row) => sum + row.rowCount, 0); }
  attendanceForStatus(status: string): number { return this.attendanceRows().filter((row) => row.status === status).reduce((sum, row) => sum + row.rowCount, 0); }
  attendanceForSection(sectionId: number): number { return this.attendanceRows().filter((row) => row.sectionId === sectionId).reduce((sum, row) => sum + row.rowCount, 0); }
  countFor(sectionId: number, status: string): number { return this.attendanceRows().find((row) => row.sectionId === sectionId && row.status === status)?.rowCount ?? 0; }
  sectionsInReport(): AttendanceSummaryRow[] { return this.attendanceRows().filter((row, index, rows) => rows.findIndex((candidate) => candidate.sectionId === row.sectionId) === index); }
  barWidth(count: number): number { return this.attendanceTotal() ? Math.max(3, Math.round((count / this.attendanceTotal()) * 100)) : 0; }

  exportReport(): void {
    const request = this.activeTab === 'attendance'
      ? this.exports.exportAttendance({ from: this.from, to: this.to, sectionId: this.sectionId || undefined, schoolYearId: this.attendanceYearId || undefined }, this.format)
      : this.exports.exportEnrollment(this.enrollmentYearId || undefined, this.format);
    request.subscribe({
      next: blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${this.activeTab}-summary-${this.today()}.${this.format}`;
        link.click(); URL.revokeObjectURL(link.href);
        this.notice.set(`${this.format.toUpperCase()} report downloaded from the reporting service.`);
      },
      error: error => this.showError(error),
    });
  }

  private today(): string { return this.formatDate(new Date()); }
  private monthStart(): string { const now = new Date(); return this.formatDate(new Date(now.getFullYear(), now.getMonth(), 1)); }
  private formatDate(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
  private showError(error: unknown): void { this.error.set(apiErrorMessage(error)); }
}