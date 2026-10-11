import { Component, HostListener, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription, finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { Phase2ApiService } from '../../core/services/phase2-api.service';
import { Section, SectionSubject } from '../../core/models/phase2.models';
import { apiErrorMessage } from '../../core/utils/api-error-message';
import { ApplicationDocuments } from '../student-portal/application-documents';
import { StudentProfileForm } from '../student-portal/student-profile-form';
import { downloadPrivateDocument } from '../student-portal/private-document-download';
import { ApplicationProfileReview } from './application-profile-review';
import { ENROLLMENT_PORTAL_OPTIONS_LOADER, EnrollmentApplicationApiService } from './enrollment-application-api.service';
import { AcademicReview, ApplicationDetail, ApplicationDocument, DocumentKind, ExternalGrade, GradeOutcome, HealthProfile, PortalOptions, StudentProfile, emptyProfile, portalConfigurationUnavailable, hasResolvedLrn, lrnLabel } from './enrollment-application.models';

@Component({
  selector: 'app-enrollment-applications', standalone: true,
  imports: [FormsModule, StudentProfileForm, ApplicationDocuments, ApplicationProfileReview],
  templateUrl: './enrollment-applications.html', styleUrl: '../student-portal/student-portal.scss',
})
export class EnrollmentApplicationsPage implements OnInit, OnDestroy {
  private readonly api = inject(EnrollmentApplicationApiService);
  private readonly lookups = inject(Phase2ApiService);
  private readonly auth = inject(AuthService);
  private readonly loadOptions = inject(ENROLLMENT_PORTAL_OPTIONS_LOADER, { optional: true });
  private readonly subscriptions = new Subscription();
  @ViewChild(StudentProfileForm) form?: StudentProfileForm;
  readonly can = (code: string) => this.auth.hasPermission(code);
  readonly items = signal<ApplicationDetail[]>([]);
  readonly detail = signal<ApplicationDetail | null>(null);
  readonly options = signal<PortalOptions | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly sections = signal<Section[]>([]);
  readonly subjects = signal<SectionSubject[]>([]);
  readonly health = signal<HealthProfile | null>(null);
  readonly healthLoaded = signal(false);
  readonly editingProfile = signal(false);
  readonly pendingProfileHealth = signal(false);
  readonly hasResolvedLrn = hasResolvedLrn;
  readonly lrnLabel = lrnLabel;
  resolutionLrn = ''; resolutionReason = ''; resolutionDirty = false;
  configurationUnavailable = () => this.options() ? portalConfigurationUnavailable(this.options()!) : 'School application configuration is unavailable. Contact the school.';
  page = 1; status = 'PendingReview'; schoolYearId: number | null = null;
  profile = emptyProfile(); dirty = false; physicalKind: DocumentKind = 'PSA'; physicalRemarks = '';
  grades: ExternalGrade[] = []; evidenceRemarks = '';
  review: AcademicReview = { decision: 'NeedsFurtherReview', internalRemarks: '', studentVisibleRemarks: '', conditions: '' };
  readonly decisions = ['NeedsFurtherReview', 'Eligible', 'EligibleWithConditions', 'NotEligible', 'NotApplicable'];
  readonly outcomes: GradeOutcome[] = ['Passed', 'Failed', 'Incomplete', 'Unknown'];
  sectionId = 0; selectedSubjectIds: number[] = []; reason = '';
  linkStudentId: number | null = null; linkEmail = ''; linkReason = '';
  identityVerified = false; emailOwnershipVerified = false;
  linkDirty = false;
  private activeOperations = 0;
  ngOnInit(): void {
    if (this.loadOptions) this.subscriptions.add(this.loadOptions().subscribe({ next: v => this.options.set(v), error: e => this.showError(e) }));
    if (this.can('enrollment.read')) this.load();
  }
  provisionLink(): void {
    if (this.saving() || !this.can('enrollment.write')) return;
    if (!this.linkStudentId || !Number.isSafeInteger(this.linkStudentId) || this.linkStudentId <= 0 || !this.linkEmail.trim() ||
      !this.linkReason.trim() || !this.identityVerified || !this.emailOwnershipVerified) {
      this.error.set('Provide the existing student ID, email, verification reason, and both independent verification acknowledgments.'); return;
    }
    this.act(this.api.linkStudent(this.linkStudentId, this.linkEmail.trim(), this.linkReason.trim()), () => {
      this.notice.set('Verified email linked to the existing student. Matching-LRN applications use this linkage; no student JWT was issued.');
      this.identityVerified = false; this.emailOwnershipVerified = false; this.linkDirty = false;
      if (this.editingProfile() && !this.detail()) { this.profile.email = this.linkEmail.trim(); this.changed(); }
    });
  }
  ngOnDestroy(): void { this.subscriptions.unsubscribe(); }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void { if (this.dirty || this.linkDirty || this.resolutionDirty) { event.preventDefault(); event.returnValue = ''; } }
  canLeave(): boolean { return this.confirmDiscard(); }
  changed(): void { this.dirty = true; }
  load(page = this.page): void {
    if (!this.can('enrollment.read') || this.loading()) return;
    this.page = page; this.loading.set(true); this.error.set('');
    this.subscriptions.add(this.api.list(page, this.status, this.schoolYearId).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: v => this.items.set(v), error: e => { this.items.set([]); this.showError(e); },
    }));
  }
  open(item: ApplicationDetail): void {
    if (!this.can('enrollment.read') || !this.confirmDiscard()) return;
    this.act(this.api.get(item.id), result => { this.setDetail(result); this.editingProfile.set(false); this.dirty = false; this.loadSections(result); });
  }
  startManual(): void {
    if (!this.can('enrollment.write') || !this.confirmDiscard()) return;
    if (this.configurationUnavailable()) { this.error.set(this.configurationUnavailable()); return; }
    this.detail.set(null); this.profile = emptyProfile(); this.editingProfile.set(true); this.pendingProfileHealth.set(false); this.dirty = false;
  }
  editProfile(): void {
    const d = this.detail(); if (!d || !this.can('enrollment.write') || !this.editable(d) || !this.confirmDiscard()) return;
    if (this.configurationUnavailable()) { this.error.set(this.configurationUnavailable()); return; }
    this.profile = structuredClone(d.profile); this.editingProfile.set(true); this.dirty = false;
    // Existing health is deliberately not fetched or included in ordinary profile updates.
  }
  saveProfile(profile: StudentProfile): void {
    if (!this.can('enrollment.write') || this.saving()) return;
    const d = this.detail();
    this.act(d ? this.api.update(d, profile) : this.api.create(profile), result => {
      this.setDetail(result); this.loadSections(result);
      if (profile.health && this.can('students.health.write')) {
        this.pendingProfileHealth.set(true);
        this.act(this.api.saveHealth(result.id, profile.health), () => this.profileSaved(), 'Profile saved. Health details were not saved; the entered health form remains available for retry.');
      }
      else this.profileSaved();
    });
  }
  private profileSaved(): void { this.form?.markSaved(); this.dirty = false; this.pendingProfileHealth.set(false); this.editingProfile.set(false); this.notice.set('Application saved for manual review. Not officially enrolled.'); this.load(); }
  editable = (d: ApplicationDetail) => ['PendingReview', 'NeedsCorrection'].includes(d.status);
  upload(event: { kind: DocumentKind; file: File }): void {
    const d = this.detail(); if (!d || !this.can('enrollment.write') || !this.editable(d)) return;
    this.mutate(this.api.upload(d.id, event.kind, event.file), 'Private document uploaded; review must be completed again.');
  }
  download(doc: ApplicationDocument): void {
    const d = this.detail(); if (!d || !this.can('enrollment.documents.review')) return;
    this.act(this.api.download(d.id, doc.id), blob => downloadPrivateDocument(blob, doc.fileName));
  }
  reviewDocument(event: { document: ApplicationDocument; verified: boolean; remarks: string }): void {
    const d = this.detail(); if (!d || !this.can('enrollment.documents.review')) return;
    this.mutate(this.api.reviewDocument(d, event.document.id, event.verified, event.remarks), event.verified ? 'Document verified.' : 'Document correction recorded.');
  }
  physical(): void {
    const d = this.detail(); if (!d || d.source !== 'Manual' || !this.can('enrollment.documents.review') || !this.physicalRemarks.trim()) return;
    this.mutate(this.api.physical(d, this.physicalKind, this.physicalRemarks), 'Physical receipt recorded — not an upload.');
  }
  addGrade(): void { this.grades = [...this.grades, { evidenceId: 0, subject: '', grade: null, outcome: 'Unknown', remarks: '', provenance: 'External' }]; this.changed(); }
  removeGrade(index: number): void { this.grades = this.grades.filter((_, i) => i !== index); this.changed(); }
  saveGrades(): void {
    const d = this.detail(); if (!d || !this.can('enrollment.previous-grades.write') || d.profile.applicationType === 'Returning') return;
    if (!this.evidenceRemarks.trim() || !this.grades.length || this.grades.some(g => !g.subject.trim() || g.outcome === 'Unreviewed')) { this.error.set('Enter evidence provenance, subjects, and explicit outcomes. Do not infer passing from a numeric grade.'); return; }
    this.mutate(this.api.previousGrades(d, this.grades, this.evidenceRemarks), 'External evidence saved. A fresh academic review is required.');
  }
  saveAcademicReview(): void {
    const d = this.detail(); if (!d || !this.can('enrollment.academic.review')) return;
    if (this.grades.length !== d.externalGrades.length || this.grades.some((g, i) => g.subject !== d.externalGrades[i]?.subject || g.grade !== d.externalGrades[i]?.grade)) {
      this.error.set('Save changed external subjects and original grades before recording the academic decision.'); return;
    }
    if (this.review.decision === 'EligibleWithConditions' && (!this.can('enrollment.exceptions.approve') || !this.review.studentVisibleRemarks.trim())) {
      this.error.set('Conditional eligibility requires exception-approval permission and student-visible conditions/remarks.'); return;
    }
    if (this.grades.some(g => g.outcome === 'Unreviewed' || (['Failed', 'Incomplete', 'Unknown'].includes(g.outcome) && !g.remarks.trim()))) {
      this.error.set('Mark each evidence subject explicitly. Failed, incomplete, and unknown outcomes require remarks.'); return;
    }
    this.mutate(this.api.academicReview(d, this.review, this.grades), 'Academic decision recorded. Placement still requires explicit approval.');
  }
  loadSections(d: ApplicationDetail): void {
    this.sectionId = 0; this.selectedSubjectIds = []; this.subjects.set([]); this.sections.set([]);
    if (!this.can('enrollment.confirm') || !d.profile.requestedSchoolYearId) return;
    this.subscriptions.add(this.lookups.getSections(d.profile.requestedSchoolYearId).subscribe({
      next: items => { if (this.detail()?.id === d.id) this.sections.set(items.filter(s => s.gradeLevelId === d.profile.requestedGradeLevelId)); },
      error: e => this.showError(e),
    }));
  }
  selectSection(): void {
    this.subjects.set([]); this.selectedSubjectIds = []; this.changed();
    const id = this.sectionId;
    if (!id || !this.can('enrollment.confirm')) return;
    this.subscriptions.add(this.lookups.getSectionSubjects(id).subscribe({ next: items => { if (this.sectionId === id) this.subjects.set(items.filter(s => s.isActive)); }, error: e => this.showError(e) }));
  }
  toggleSubject(id: number, checked: boolean): void { this.selectedSubjectIds = checked ? [...this.selectedSubjectIds, id] : this.selectedSubjectIds.filter(v => v !== id); this.changed(); }
  resolveLrn(): void {
    const d = this.detail();
    if (!d || this.saving() || !this.can('enrollment.write') || !this.editable(d) || hasResolvedLrn(d.profile)) return;
    if (!/^\d{12}$/.test(this.resolutionLrn) || !this.resolutionReason.trim()) {
      this.error.set('Enter exactly 12 LRN digits and an identity-verification reason.'); return;
    }
    this.mutate(this.api.resolveLrn(d, this.resolutionLrn, this.resolutionReason.trim()),
      'DEMO LRN resolution audited locally. No real identity was verified, merged, or enrolled.', true);
  }
  approve(): void {
    const d = this.detail(); if (!d || !this.can('enrollment.confirm')) return;
    if (!hasResolvedLrn(d.profile)) { this.error.set('Resolve the Pending LRN with verified identity before approval.'); return; }
    if (this.editingProfile()) { this.error.set('Save the application profile before approval.'); return; }
    if (JSON.stringify(this.grades) !== JSON.stringify(d.externalGrades) || JSON.stringify(this.review) !== JSON.stringify(d.academicReview ?? { decision: 'NeedsFurtherReview', internalRemarks: '', studentVisibleRemarks: '', conditions: '' })) {
      this.error.set('Save academic evidence and the academic decision before approval. Unsaved reviews cannot be used for enrollment.'); return;
    }
    if (d.academicReview?.decision === 'EligibleWithConditions' && !this.can('enrollment.exceptions.approve')) { this.error.set('Conditional approval requires exception-approval permission.'); return; }
    if (!this.sectionId || !this.selectedSubjectIds.length || !this.reason.trim()) { this.error.set('Choose a matching section, offered subjects, and an approval reason.'); return; }
    this.mutate(this.api.approve(d, this.sectionId, this.selectedSubjectIds, this.reason), 'DEMO application approved; fictional Student and Enrollment linked in memory only. Not a real enrollment.');
  }
  changeStatus(status: string): void {
    const d = this.detail(); if (!d || !this.can('enrollment.write') || !this.reason.trim()) return;
    this.mutate(this.api.status(d, status, this.reason), `Application status updated: ${status}.`);
  }
  loadHealth(): void {
    const d = this.detail(); if (!d || this.saving() || this.dirty || !this.can('students.health.read')) return;
    this.act(this.api.health(d.id), value => { this.health.set(value); this.healthLoaded.set(true); });
  }
  newHealth(): void { if (this.can('students.health.write')) { this.health.set({ bloodType: 'Unknown', heightCm: null, weightKg: null, weighingDate: '', history: '' }); this.healthLoaded.set(true); this.changed(); } }
  saveHealth(): void {
    const d = this.detail(); const h = this.health(); if (!d || !h || !this.can('students.health.write')) return;
    this.act(this.api.saveHealth(d.id, h), () => { this.notice.set('Restricted health details saved. Other unsaved review changes, if any, still need saving.'); });
  }
  private setDetail(d: ApplicationDetail): void {
    this.detail.set(d); this.grades = structuredClone(d.externalGrades);
    this.evidenceRemarks = ''; this.physicalRemarks = ''; this.reason = '';
    this.resolutionLrn = ''; this.resolutionReason = ''; this.resolutionDirty = false;
    this.review = d.academicReview ? structuredClone(d.academicReview) : { decision: 'NeedsFurtherReview', internalRemarks: '', studentVisibleRemarks: '', conditions: '' };
    this.health.set(null); this.healthLoaded.set(false);
  }
  private mutate(request: Observable<ApplicationDetail>, notice: string, resolvingLrn = false): void {
    if (this.saving()) return;
    if (this.editingProfile()) { this.error.set('Save the profile form before performing review actions.'); return; }
    if ((this.dirty || (!resolvingLrn && this.resolutionDirty)) && !window.confirm('Save this action? Other unsaved edits in this review will be discarded.')) return;
    this.act(request, result => {
      this.setDetail(result); this.dirty = false; this.notice.set(notice); this.load();
      this.subscriptions.add(this.auth.refreshPermissions().subscribe({ error: e => this.showError(e) }));
    });
  }
  private act<T>(request: Observable<T>, success: (value: T) => void, prefix = ''): void {
    this.activeOperations++;
    this.saving.set(true); this.error.set(''); this.notice.set('');
    this.subscriptions.add(request.pipe(finalize(() => { this.activeOperations--; this.saving.set(this.activeOperations > 0); })).subscribe({ next: value => success(value), error: e => { this.showError(e); if (prefix) this.error.set(`${prefix} ${this.error()}`); } }));
  }
  private confirmDiscard(): boolean { return !this.saving() && (!(this.dirty || this.linkDirty || this.resolutionDirty) || window.confirm('Leave the current form / review with unsaved changes?')); }
  private showError(e: unknown): void { this.error.set(apiErrorMessage(e)); }
}
