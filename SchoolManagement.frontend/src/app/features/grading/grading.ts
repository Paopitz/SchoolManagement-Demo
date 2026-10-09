import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GradeLevel, SchoolYear } from '../../core/models/phase2.models';
import { GradeRecord, GradingComponent, GradingEnrollment, GradingPeriod, GradingSection, GradingTemplate } from '../../core/models/phase36.models';
import { Phase2ApiService } from '../../core/services/phase2-api.service';
import { Phase36ApiService } from '../../core/services/phase36-api.service';
import { AuthService } from '../../core/services/auth.service';
import { apiErrorMessage } from '../../core/utils/api-error-message';

interface ComponentDraft { rawScore: number | null; maximumScore: number | null; }

@Component({ selector: 'app-grading', standalone: true, imports: [FormsModule], templateUrl: './grading.html', styleUrl: './grading.scss' })
export class GradingPage implements OnInit {
  private readonly api = inject(Phase36ApiService);
  private readonly lookups = inject(Phase2ApiService);
  private readonly auth = inject(AuthService);
  readonly canConfigure = () => this.auth.hasAnyRole(['Super Admin', 'Admin']);
  readonly canReview = () => this.auth.hasAnyRole(['Adviser', 'Admin', 'Super Admin', 'Principal']);
  readonly templates = signal<GradingTemplate[]>([]);
  readonly periods = signal<GradingPeriod[]>([]);
  readonly years = signal<SchoolYear[]>([]);
  readonly grades = signal<GradeLevel[]>([]);
  readonly sections = signal<GradingSection[]>([]);
  readonly enrollments = signal<GradingEnrollment[]>([]);
  readonly templateComponents = signal<GradingComponent[]>([]);
  readonly records = signal<GradeRecord[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly totalWeight = () => this.components.reduce((sum, item) => sum + (Number(item.weightPercent) || 0), 0);
  readonly selectedEnrollment = () => this.enrollments().find(row => row.enrollmentId === this.enrollmentId) ?? null;
  activeTab = 'work';
  periodId = 0;
  sectionId = 0;
  enrollmentId = 0;
  sectionSubjectId = 0;
  enrollmentPage = 1;
  templateName = '';
  templateKey = '';
  templateVersion = 1;
  components: Array<{ name: string; weightPercent: number }> = [{ name: '', weightPercent: 0 }];
  schoolYearId = 0;
  gradeLevelId = 0;
  templateId = 0;
  periodType = 'Quarter';
  periodNumber = 1;
  periodName = '';
  startsOn = '';
  endsOn = '';
  reasonByGrade: Record<number, string> = {};
  scoreDrafts: Record<number, Record<number, ComponentDraft>> = {};

  ngOnInit(): void {
    this.loadConfiguration();
    if (!this.canConfigure()) return;
    this.lookups.getSchoolYears().subscribe({ next: rows => { this.years.set(rows); this.schoolYearId = rows.find(x => x.isActive)?.schoolYearId ?? rows[0]?.schoolYearId ?? 0; }, error: e => this.showError(e) });
    this.lookups.getGradeLevels().subscribe({ next: rows => { this.grades.set(rows); this.gradeLevelId = rows[0]?.gradeLevelId ?? 0; }, error: e => this.showError(e) });
  }

  loadConfiguration(): void {
    this.api.getGradingTemplates().subscribe({ next: rows => { this.templates.set(rows); this.templateId ||= rows[0]?.gradingTemplateId ?? 0; }, error: e => this.showError(e) });
    this.api.getGradingPeriods().subscribe({ next: rows => { this.periods.set(rows); this.periodId ||= rows[0]?.gradingPeriodId ?? 0; if (this.periodId) this.loadPeriodData(); }, error: e => this.showError(e) });
  }
  periodChanged(): void {
    this.sectionId = 0; this.enrollmentId = 0; this.sectionSubjectId = 0; this.enrollmentPage = 1;
    this.sections.set([]); this.enrollments.set([]); this.records.set([]); this.templateComponents.set([]);
    this.loadPeriodData();
  }
  sectionChanged(): void { this.enrollmentPage = 1; this.enrollmentId = 0; this.sectionSubjectId = 0; this.loadEnrollments(); this.loadRecords(); }
  loadPeriodData(): void {
    const period = this.periods().find(row => row.gradingPeriodId === this.periodId);
    if (!period) { this.records.set([]); this.templateComponents.set([]); return; }
    this.loading.set(true);
    this.api.getGradingTemplateComponents(period.gradingTemplateId).subscribe({
      next: rows => {
        if (this.periodId !== period.gradingPeriodId) return;
        this.templateComponents.set(rows); this.initializeScoreDrafts(); this.loading.set(false); this.loadSections(period);
      },
      error: e => { this.loading.set(false); this.showError(e); },
    });
    this.loadRecords();
  }
  private loadSections(period: GradingPeriod): void {
    this.api.getGradingSections(period.gradingPeriodId).subscribe({
      next: rows => {
        if (this.periodId !== period.gradingPeriodId) return;
        this.sections.set(rows);
        if (!rows.some(row => row.sectionId === this.sectionId)) this.sectionId = 0;
        this.loadEnrollments();
      },
      error: e => this.showError(e),
    });
  }
  loadEnrollments(): void {
    const period = this.periods().find(row => row.gradingPeriodId === this.periodId);
    if (!period || !this.sectionId) { this.enrollments.set([]); return; }
    const sectionId = this.sectionId;
    const page = this.enrollmentPage;
    this.enrollments.set([]); this.enrollmentId = 0; this.sectionSubjectId = 0;
    this.api.getGradingEntries(period.gradingPeriodId, sectionId, page).subscribe({
      next: rows => {
        if (this.periodId !== period.gradingPeriodId || this.sectionId !== sectionId || this.enrollmentPage !== page) return;
        this.enrollments.set(rows);
      },
      error: e => this.showError(e),
    });
  }
  enrollmentPageChanged(page: number): void { if (page >= 1) { this.enrollmentPage = page; this.loadEnrollments(); } }
  onEnrollmentChanged(): void { this.sectionSubjectId = 0; }
  addComponent(): void { this.components = [...this.components, { name: '', weightPercent: 0 }]; }
  removeComponent(index: number): void { if (this.components.length > 1) this.components = this.components.filter((_, i) => i !== index); }
  createTemplate(): void {
    const parts = this.components.map((x, index) => ({ name: x.name.trim(), weightPercent: Number(x.weightPercent), sortOrder: index }));
    if (!this.templateKey.trim() || !this.templateName.trim() || Number(this.templateVersion) <= 0 || parts.some(x => !x.name || !Number.isFinite(x.weightPercent)) || this.totalWeight() !== 100) {
      this.error.set('Enter a template key, name, positive version, complete components, and weights totaling 100%.'); return;
    }
    this.saving.set(true); this.error.set('');
    this.api.createGradingTemplate({ templateKey: this.templateKey.trim(), versionNumber: Number(this.templateVersion), name: this.templateName.trim(), components: parts }).subscribe({
      next: created => {
        this.templateName = ''; this.components = [{ name: '', weightPercent: 0 }]; this.templateId = created.gradingTemplateId;
        this.saving.set(false); this.notice.set('Grading template created.'); this.api.getGradingTemplates().subscribe({ next: rows => this.templates.set(rows), error: e => this.showError(e) });
      },
      error: e => { this.saving.set(false); this.showError(e); },
    });
  }
  createPeriod(): void {
    if (!this.schoolYearId || !this.gradeLevelId || !this.templateId || !this.periodName.trim() || !this.startsOn || !this.endsOn || this.startsOn > this.endsOn) {
      this.error.set('Select a school year, grade level, template, period name, and valid start/end dates.'); return;
    }
    this.saving.set(true); this.error.set('');
    this.api.createGradingPeriod({ schoolYearId: this.schoolYearId, gradeLevelId: this.gradeLevelId, gradingTemplateId: this.templateId, periodType: this.periodType, periodNumber: Number(this.periodNumber), name: this.periodName.trim(), startsOn: this.startsOn, endsOn: this.endsOn }).subscribe({
      next: created => { this.saving.set(false); this.periodName = ''; this.periodId = created.gradingPeriodId; this.notice.set('Grading period created.'); this.loadConfiguration(); },
      error: e => { this.saving.set(false); this.showError(e); },
    });
  }
  createGrade(): void {
    if (!this.enrollmentId || !this.sectionSubjectId || !this.periodId) { this.error.set('Choose an enrolled student and one of their section subjects.'); return; }
    this.saving.set(true); this.error.set('');
    this.api.createGrade({ enrollmentId: this.enrollmentId, sectionSubjectId: this.sectionSubjectId, gradingPeriodId: this.periodId }).subscribe({
      next: () => { this.saving.set(false); this.notice.set('Draft grade record created.'); this.loadRecords(); },
      error: e => { this.saving.set(false); this.showError(e); },
    });
  }
  loadRecords(): void {
    if (!this.periodId) { this.records.set([]); return; }
    const periodId = this.periodId;
    const sectionId = this.sectionId;
    this.loading.set(true); this.error.set('');
    this.api.getGrades(this.periodId, this.sectionId || undefined).subscribe({
      next: rows => {
        if (this.periodId !== periodId || this.sectionId !== sectionId) return;
        this.records.set(rows);
        this.initializeScoreDrafts();
        this.loading.set(false);
      },
      error: e => { this.loading.set(false); this.showError(e); },
    });
  }
  private initializeScoreDrafts(): void {
    for (const row of this.records()) {
      const draft = this.scoreDrafts[row.gradeRecordId] ?? {};
      for (const component of this.templateComponents()) draft[component.gradingTemplateComponentId] ??= { rawScore: null, maximumScore: null };
      this.scoreDrafts[row.gradeRecordId] = draft;
    }
  }
  visibleRecords(): GradeRecord[] {
    const rows = this.records();
    return this.activeTab === 'review' ? rows.filter(row => ['Submitted', 'UnderReview'].includes(row.workflowStatus)) : rows;
  }
  saveScores(record: GradeRecord): void {
    const drafts = this.scoreDrafts[record.gradeRecordId] ?? {};
    const scores = this.templateComponents().map(component => ({ gradingTemplateComponentId: component.gradingTemplateComponentId, rawScore: Number(drafts[component.gradingTemplateComponentId]?.rawScore), maximumScore: Number(drafts[component.gradingTemplateComponentId]?.maximumScore) }));
    if (record.workflowStatus !== 'Draft' || !scores.length || scores.some(score => !Number.isFinite(score.rawScore) || !Number.isFinite(score.maximumScore) || score.maximumScore <= 0 || score.rawScore < 0 || score.rawScore > score.maximumScore)) {
      this.error.set('Enter a valid raw score and maximum score for every template component on this draft.'); return;
    }
    this.saving.set(true); this.error.set('');
    this.api.saveGradeScores(record.gradingPeriodId, record.gradeRecordId, scores, this.reasonByGrade[record.gradeRecordId]).subscribe({
      next: result => { this.records.update(rows => rows.map(row => row.gradeRecordId === result.gradeRecordId ? { ...row, computedGrade: result.computedGrade } : row)); this.saving.set(false); this.notice.set('Demo scores saved. The local adapter computed the weighted grade.'); },
      error: e => { this.saving.set(false); this.showError(e); },
    });
  }
  transition(record: GradeRecord, newStatus: string): void {
    const reason = this.reasonByGrade[record.gradeRecordId]?.trim();
    if (newStatus === 'Draft' && !reason) { this.error.set('A reason is required when returning or reopening a grade to Draft.'); return; }
    this.saving.set(true); this.error.set('');
    this.api.transitionGrade(record.gradeRecordId, newStatus, reason).subscribe({
      next: updated => { this.records.update(rows => rows.map(row => row.gradeRecordId === updated.gradeRecordId ? { ...row, workflowStatus: updated.workflowStatus } : row)); this.saving.set(false); this.notice.set(`Grade status changed to ${updated.workflowStatus}.`); },
      error: e => { this.saving.set(false); this.showError(e); },
    });
  }
  fullName(record: GradeRecord): string { return [record.firstName, record.middleName, record.lastName].filter(Boolean).join(' '); }
  statusClass(state: string): string { return `state state-${state.toLowerCase().replaceAll(' ', '-')}`; }
  private showError(error: unknown): void { this.error.set(apiErrorMessage(error)); }
}
