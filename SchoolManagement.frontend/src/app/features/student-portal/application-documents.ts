import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApplicationDocument, DocumentKind, PortalOptions } from '../enrollment-applications/enrollment-application.models';

@Component({
  selector: 'app-application-documents', standalone: true, imports: [FormsModule], styleUrl: './student-portal.scss',
  template: `
    <h2>Private documents</h2>
    <p>PSA / Live Birth, previous report card, and 1×1 ID picture. Received/uploaded is not the same as verified. Only authorized users can download these documents.</p>
    <p>Allowed types: {{ options.acceptedFileTypes.join(', ') }}. Maximum {{ (options.maxUploadBytes / 1024 / 1024).toFixed(1) }} MiB per file. Server checks content and school requirements.</p>
    @if (error) { <p role="alert" class="alert error">{{ error }}</p> }
    @if (canUpload) {
      <fieldset [disabled]="busy">
      <label>Document type<select name="documentKind" [(ngModel)]="kind"><option value="PSA">PSA birth certificate</option><option value="LiveBirth">Live Birth</option><option value="ReportCard">Previous report card</option><option value="IdPicture">1×1 ID picture</option></select></label>
      <label>Private file<input #fileInput type="file" [accept]="options.acceptedFileTypes.join(',')" (change)="choose($event)" /></label>
      <button type="button" class="primary" [disabled]="!file || busy" (click)="send()">{{ busy ? 'Working…' : 'Upload private document' }}</button>
      </fieldset>
    }
    @if (documents.length === 0) { <p>No documents received yet.</p> }
    @for (doc of documents; track doc.id) {
      <article class="panel"><strong>{{ doc.kind === 'PSA' ? 'PSA / Live Birth' : doc.kind }}</strong>
      <p>{{ doc.receiptMode === 'Physical' ? 'Physical receipt — not uploaded' : 'Private upload' }} · <span class="status" [class.pending]="doc.status !== 'Verified'">{{ doc.status }}</span></p>
      <p>{{ doc.remarks }}</p>
      @if (canDownload && doc.receiptMode === 'Upload') { <button type="button" [disabled]="busy" (click)="download.emit(doc)">Download {{ doc.fileName || 'document' }}</button> }
      @if (canReview) {
        <label [for]="'doc-remarks-' + doc.id">Verification / correction remarks<textarea [id]="'doc-remarks-' + doc.id" [(ngModel)]="remarks[doc.id]" [name]="'docRemarks' + doc.id" (ngModelChange)="dirtyChange.emit(true)"></textarea></label>
        <div class="actions"><button type="button" [disabled]="busy || !remarks[doc.id]?.trim()" (click)="review.emit({ document: doc, verified: true, remarks: remarks[doc.id] || '' })">Mark verified</button>
        <button type="button" [disabled]="busy || !remarks[doc.id]?.trim()" (click)="review.emit({ document: doc, verified: false, remarks: remarks[doc.id] || '' })">Require correction</button></div>
      }
      </article>
    }`,
})
export class ApplicationDocuments implements OnChanges {
  @Input({ required: true }) options!: PortalOptions;
  @Input() documents: ApplicationDocument[] = [];
  @Input() busy = false;
  @Input() canUpload = false;
  @Input() canDownload = false;
  @Input() canReview = false;
  @Output() upload = new EventEmitter<{ kind: DocumentKind; file: File }>();
  @Output() download = new EventEmitter<ApplicationDocument>();
  @Output() review = new EventEmitter<{ document: ApplicationDocument; verified: boolean; remarks: string }>();
  @Output() dirtyChange = new EventEmitter<boolean>();
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;
  kind: DocumentKind = 'PSA';
  file: File | null = null;
  error = '';
  remarks: Record<number, string> = {};
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['documents'] && !changes['documents'].firstChange) {
      this.file = null; this.remarks = {}; this.error = '';
      if (this.fileInput) this.fileInput.nativeElement.value = '';
    }
  }
  choose(event: Event): void {
    this.error = ''; this.file = null;
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size === 0 || file.size > this.options.maxUploadBytes) { this.error = 'Choose a nonempty file within the displayed size limit.'; return; }
    const extension = '.' + file.name.split('.').at(-1)?.toLowerCase();
    if (!this.options.acceptedFileTypes.some(v => v === file.type || v.toLowerCase() === extension)) { this.error = 'Choose a file of an allowed type.'; return; }
    this.file = file;
    this.dirtyChange.emit(true);
  }
  send(): void { if (this.file && !this.busy) this.upload.emit({ kind: this.kind, file: this.file }); }
}
