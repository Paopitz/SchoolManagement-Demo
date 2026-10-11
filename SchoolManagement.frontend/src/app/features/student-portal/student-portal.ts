import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription, finalize } from 'rxjs';
import { apiErrorMessage } from '../../core/utils/api-error-message';
import { ENROLLMENT_PORTAL_OPTIONS_LOADER } from '../enrollment-applications/enrollment-application-api.service';
import { ApplicationDetail, ApplicationDocument, DocumentKind, OfficialHistory, OwnGradeSummary, PortalOptions, StudentProfile, emptyProfile, portalConfigurationUnavailable, lrnLabel } from '../enrollment-applications/enrollment-application.models';
import { ApplicationDocuments } from './application-documents';
import { downloadPrivateDocument } from './private-document-download';
import { StudentPortalApiService } from './student-portal-api.service';
import { StudentProfileForm } from './student-profile-form';

@Component({
  selector: 'app-student-portal', standalone: true, imports: [FormsModule, StudentProfileForm, ApplicationDocuments],
  templateUrl: './student-portal.html', styleUrl: './student-portal.scss',
})
export class StudentPortalPage implements OnInit, OnDestroy {
  readonly api = inject(StudentPortalApiService);
  private readonly loadOptions = inject(ENROLLMENT_PORTAL_OPTIONS_LOADER, { optional: true });
  private readonly subscriptions = new Subscription();
  @ViewChild(StudentProfileForm) form?: StudentProfileForm;
  readonly options = signal<PortalOptions | null>(null);
  readonly applications = signal<ApplicationDetail[]>([]);
  readonly selected = signal<ApplicationDetail | null>(null);
  readonly grades = signal<OwnGradeSummary | null>(null);
  readonly history = signal<OfficialHistory[]>([]);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly codeRequested = signal(false);
  readonly linked = signal(false);
  readonly editing = signal(false);
  readonly cooldown = signal(0);
  configurationUnavailable = () => this.options() ? portalConfigurationUnavailable(this.options()!) : 'School application configuration is unavailable. Contact the school.';
  profile = emptyProfile();
  email = ''; code = ''; reason = ''; dirty = false;
  readonly lrnLabel = lrnLabel;
  private cooldownTimer?: ReturnType<typeof setInterval>;
  private expiryTimer?: ReturnType<typeof setTimeout>;
  private generation = 0;
  private activeOperations = 0;
  private ownerEmail = '';
  ngOnInit(): void {
    if (this.loadOptions) this.subscriptions.add(this.loadOptions().subscribe({ next: options => this.options.set(options), error: e => this.showError(e) }));
    else this.error.set('School application configuration is unavailable. Contact the school; no application can be submitted until it is configured.');
  }
  ngOnDestroy(): void { this.subscriptions.unsubscribe(); clearInterval(this.cooldownTimer); clearTimeout(this.expiryTimer); this.api.clearSession(); }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void { if (this.dirty) { event.preventDefault(); event.returnValue = ''; } }
  canLeave(): boolean { return this.confirmDiscard(); }
  requestCode(): void {
    if (this.busy() || this.cooldown() || !this.email.trim()) return;
    this.run(this.api.requestCode(this.email.trim()), response => {
      this.codeRequested.set(true); this.notice.set(response.message); this.cooldown.set(60);
      clearInterval(this.cooldownTimer); this.cooldownTimer = setInterval(() => { this.cooldown.update(n => Math.max(0, n - 1)); if (!this.cooldown()) clearInterval(this.cooldownTimer); }, 1000);
    });
  }
  verify(): void {
    if (this.busy() || !this.code.trim()) return;
    if (this.ownerEmail && this.ownerEmail.toLowerCase() !== this.email.trim().toLowerCase()) {
      if (!this.confirmDiscard()) return;
      this.clearPrivateState();
    }
    this.run(this.api.verifyCode(this.email.trim(), this.code.trim()), () => {
      this.ownerEmail = this.email.trim();
      this.code = ''; this.notice.set('DEMO access simulated. No real email or identity was verified.');
      clearTimeout(this.expiryTimer);
      this.expiryTimer = setTimeout(() => this.expireSession(), Math.max(0, Date.parse(this.api.expiresAt()) - Date.now()));
      this.refreshOwn();
      const generation = this.generation;
      this.subscriptions.add(this.api.me().subscribe({ next: account => { if (generation === this.generation) this.linked.set(account.studentId !== null); }, error: e => { if (generation === this.generation) this.showError(e); } }));
    });
  }
  refreshOwn(): void {
    const generation = this.generation;
    this.subscriptions.add(this.api.applications().subscribe({ next: items => { if (generation === this.generation) this.applications.set(items); }, error: e => { if (generation === this.generation) this.showError(e); } }));
    this.subscriptions.add(this.api.enrollments().subscribe({ next: items => { if (generation === this.generation) this.history.set(items); }, error: e => { if (generation === this.generation) this.showError(e); } }));
  }
  startNew(reuse = false): void {
    if (!this.confirmDiscard()) return;
    if (this.configurationUnavailable()) { this.error.set(this.configurationUnavailable()); return; }
    this.profile = reuse && this.selected() ? structuredClone(this.selected()!.profile) : emptyProfile();
    this.profile.email = this.api.email();
    this.profile.declarationAcknowledged = false; this.profile.declarationVersion = '';
    this.selected.set(null); this.editing.set(true); this.dirty = false;
  }
  open(detail: ApplicationDetail): void {
    if (!this.confirmDiscard()) return;
    this.run(this.api.get(detail.id), result => { this.selected.set(result); this.editing.set(false); this.dirty = false; });
  }
  correct(): void {
    const detail = this.selected(); if (!detail || !this.editable(detail) || !this.confirmDiscard()) return;
    if (this.configurationUnavailable()) { this.error.set(this.configurationUnavailable()); return; }
    this.profile = structuredClone(detail.profile); this.editing.set(true); this.dirty = false;
    this.run(this.api.health(detail.id), health => { this.profile.health = health; });
  }
  editable = (detail: ApplicationDetail) => ['PendingReview', 'NeedsCorrection'].includes(detail.status);
  saveProfile(profile: StudentProfile): void {
    if (this.busy() || !this.api.authenticated()) return;
    // Email ownership is established by the portal session, not by editable profile text.
    profile.email = this.api.email();
    const detail = this.selected();
    this.run(detail ? this.api.update(detail, profile) : this.api.create(profile), result => {
      this.selected.set(result);
      if (profile.health) {
        this.run(this.api.saveHealth(result.id, profile.health), () => this.profileSaved(result), 'Profile saved, but health information could not be saved. Your entered health details remain in the form. Retry.');
      } else this.profileSaved(result);
    });
  }
  private profileSaved(detail: ApplicationDetail): void {
    this.form?.markSaved(); this.dirty = false; this.editing.set(false);
    this.notice.set(`Application ${detail.reference} received for review. Provide documents below. This is not official enrollment.`);
    this.refreshOwn();
  }
  upload(event: { kind: DocumentKind; file: File }): void {
    const detail = this.selected(); if (!detail || !this.editable(detail) || this.busy()) return;
    this.run(this.api.upload(detail.id, event.kind, event.file), result => { this.selected.set(result); this.dirty = false; this.notice.set('Private document uploaded. Staff verification is still required.'); this.refreshOwn(); });
  }
  download(doc: ApplicationDocument): void {
    const detail = this.selected(); if (detail) this.run(this.api.download(detail.id, doc.id), blob => downloadPrivateDocument(blob, doc.fileName));
  }
  withdraw(): void {
    const detail = this.selected(); if (!detail || !this.reason.trim() || !this.confirmDiscard()) return;
    this.run(this.api.withdraw(detail, this.reason.trim()), result => { this.selected.set(result); this.editing.set(false); this.dirty = false; this.reason = ''; this.notice.set('Application withdrawn. History is retained.'); this.refreshOwn(); });
  }
  loadGrades(): void { this.run(this.api.grades(), result => this.grades.set(result)); }
  printGrades(): void { if (this.grades()?.grades.length) window.print(); }
  logout(): void {
    if (!this.confirmDiscard()) return;
    this.run(this.api.logout(), () => this.clearPrivateState());
  }
  private expireSession(): void { this.generation++; this.api.clearSession(); this.grades.set(null); this.applications.set([]); this.history.set([]); this.linked.set(false); this.error.set('Your portal session expired. Verify your email again. Unsaved form information remains in this page.'); }
  private clearPrivateState(): void { this.generation++; this.api.clearSession(); this.selected.set(null); this.applications.set([]); this.grades.set(null); this.history.set([]); this.profile = emptyProfile(); this.editing.set(false); this.dirty = false; this.linked.set(false); this.ownerEmail = ''; }
  private confirmDiscard(): boolean { if (this.busy()) return false; return !this.dirty || window.confirm('Discard unsaved profile / document changes?'); }
  private run<T>(request: Observable<T>, success: (value: T) => void, failurePrefix = ''): void {
    const generation = this.generation;
    this.activeOperations++;
    this.busy.set(true); this.error.set(''); this.notice.set('');
    this.subscriptions.add(request.pipe(finalize(() => { this.activeOperations--; this.busy.set(this.activeOperations > 0); })).subscribe({ next: value => { if (generation === this.generation) success(value); }, error: e => { if (generation !== this.generation) return; this.showError(e); if (failurePrefix) this.error.set(`${failurePrefix} ${this.error()}`); } }));
  }
  private showError(error: unknown): void { if (error instanceof HttpErrorResponse && error.status === 401) this.expireSession(); else this.error.set(apiErrorMessage(error)); }
}
