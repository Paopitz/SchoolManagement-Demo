import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Department, GradeLevel, Room, SchoolYear, Section, SectionSubject, Strand, Subject, Track } from '../../core/models/phase2.models';
import { Phase2ApiService } from '../../core/services/phase2-api.service';
import { AuthService } from '../../core/services/auth.service';
import { apiErrorMessage } from '../../core/utils/api-error-message';
import { Phase3ApiService } from '../../core/services/phase3-api.service';
import { TeacherLookup } from '../../core/models/phase3.models';

@Component({
  selector: 'app-academic',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './academic.html',
  styleUrl: './academic.scss',
})
export class AcademicPage implements OnInit {
  private readonly api = inject(Phase2ApiService);
  private readonly auth = inject(AuthService);
  private readonly teacherApi = inject(Phase3ApiService);
  readonly teachers = signal<TeacherLookup[]>([]);
  readonly canWrite = () => this.auth.hasAnyRole(['Super Admin', 'Admin', 'Registrar']);
  readonly years = signal<SchoolYear[]>([]);
  readonly departments = signal<Department[]>([]);
  readonly grades = signal<GradeLevel[]>([]);
  readonly tracks = signal<Track[]>([]);
  readonly strands = signal<Strand[]>([]);
  readonly subjects = signal<Subject[]>([]);
  readonly rooms = signal<Room[]>([]);
  readonly sections = signal<Section[]>([]);
  readonly offerings = signal<SectionSubject[]>([]);
  readonly error = signal('');
  readonly notice = signal('');
  readonly saving = signal(false);
  activeTab = 'school-years';
  selectedSectionId = 0;
  yearCode = ''; startsOn = ''; endsOn = '';
  departmentName = '';
  gradeDepartmentId = 0; gradeCode = ''; gradeName = ''; gradeSortOrder = 0;
  trackName = '';
  strandTrackId = 0; strandCode = ''; strandName = '';
  subjectCode = ''; subjectName = '';
  roomCode = ''; roomName = ''; roomCapacity: number | null = null;
  sectionYearId = 0; sectionGradeId = 0; sectionName = ''; adviserTeacherId: number | null = null;
  sectionStrandId: number | null = null;
  offeringSubjectId = 0; offeringTeacherId: number | null = null;
  editingId = 0;
  editingKind = '';
  editingSchoolYearIsActive = false;
  editingDepartmentIsActive = true;
  editingSubjectIsActive = true;
  editingRoomIsActive = true;
  editingTrackIsActive = true;
  editingOfferingIsActive = true;

  ngOnInit(): void { this.loadAll(); }

  loadAll(): void {
    if (this.canWrite()) {
      this.teacherApi.getTeacherLookup().subscribe({
        next: (teachers) => this.teachers.set(teachers),
        error: (error) => this.showError(error),
      });
    }
    this.api.getSchoolYears().subscribe({ next: (rows) => { this.years.set(rows); this.sectionYearId = rows.find((row) => row.isActive)?.schoolYearId ?? rows[0]?.schoolYearId ?? 0; this.loadSections(); }, error: (e) => this.showError(e) });
    this.api.getDepartments().subscribe({ next: (rows) => { this.departments.set(rows); this.gradeDepartmentId ||= rows[0]?.departmentId ?? 0; }, error: (e) => this.showError(e) });
    this.api.getGradeLevels().subscribe({ next: (rows) => this.grades.set(rows), error: (e) => this.showError(e) });
    this.api.getTracks().subscribe({ next: (rows) => { this.tracks.set(rows); this.strandTrackId ||= rows[0]?.trackId ?? 0; }, error: (e) => this.showError(e) });
    this.api.getStrands().subscribe({ next: (rows) => this.strands.set(rows), error: (e) => this.showError(e) });
    this.api.getSubjects().subscribe({ next: (rows) => this.subjects.set(rows), error: (e) => this.showError(e) });
    this.api.getRooms().subscribe({ next: (rows) => this.rooms.set(rows), error: (e) => this.showError(e) });
  }

  loadSections(): void {
    this.api.getSections(this.sectionYearId || undefined).subscribe({ next: (rows) => this.sections.set(rows), error: (e) => this.showError(e) });
  }

  loadOfferings(): void {
    if (!this.selectedSectionId) { this.offerings.set([]); return; }
    this.api.getSectionSubjects(this.selectedSectionId).subscribe({ next: (rows) => this.offerings.set(rows), error: (e) => this.showError(e) });
  }

  activateYear(id: number): void { this.run(this.api.activateSchoolYear(id), 'School year activated.'); }
  addYear(): void { const body = { code: this.yearCode.trim(), startsOn: this.startsOn, endsOn: this.endsOn }; this.run(this.editingKind === 'school-year' ? this.api.updateSchoolYear(this.editingId, body) : this.api.createSchoolYear(body), this.editingKind ? 'School year updated.' : 'School year created.', () => { this.yearCode = ''; this.startsOn = ''; this.endsOn = ''; this.clearEdit(); }); }
  addDepartment(): void { const body = { name: this.departmentName.trim(), isActive: this.editingDepartmentIsActive }; this.run(this.editingKind === 'department' ? this.api.updateDepartment(this.editingId, body) : this.api.createDepartment(body), this.editingKind ? 'Department updated.' : 'Department created.', () => { this.departmentName = ''; this.clearEdit(); }); }
  addGrade(): void { const body = { code: this.gradeCode.trim(), name: this.gradeName.trim(), sortOrder: Number(this.gradeSortOrder) }; this.run(this.editingKind === 'grade' ? this.api.updateGradeLevel(this.editingId, body) : this.api.createGradeLevel({ departmentId: this.gradeDepartmentId, ...body }), this.editingKind ? 'Grade level updated.' : 'Grade level created.', () => { this.gradeCode = ''; this.gradeName = ''; this.clearEdit(); }); }
  addTrack(): void { const body = { name: this.trackName.trim(), isActive: this.editingTrackIsActive }; this.run(this.editingKind === 'track' ? this.api.updateTrack(this.editingId, body) : this.api.createTrack(body), this.editingKind ? 'Track updated.' : 'Track created.', () => { this.trackName = ''; this.clearEdit(); }); }
  addStrand(): void { const body = { code: this.strandCode.trim(), name: this.strandName.trim() }; this.run(this.editingKind === 'strand' ? this.api.updateStrand(this.editingId, body) : this.api.createStrand({ trackId: this.strandTrackId, ...body }), this.editingKind ? 'Strand updated.' : 'Strand created.', () => { this.strandCode = ''; this.strandName = ''; this.clearEdit(); }); }
  addSubject(): void { const body = { code: this.subjectCode.trim(), name: this.subjectName.trim(), isActive: this.editingSubjectIsActive }; this.run(this.editingKind === 'subject' ? this.api.updateSubject(this.editingId, body) : this.api.createSubject(body), this.editingKind ? 'Subject updated.' : 'Subject created.', () => { this.subjectCode = ''; this.subjectName = ''; this.clearEdit(); }); }
  addRoom(): void { const body = { code: this.roomCode.trim(), name: this.roomName.trim(), capacity: this.roomCapacity, isActive: this.editingRoomIsActive }; this.run(this.editingKind === 'room' ? this.api.updateRoom(this.editingId, body) : this.api.createRoom(body), this.editingKind ? 'Room updated.' : 'Room created.', () => { this.roomCode = ''; this.roomName = ''; this.roomCapacity = null; this.clearEdit(); }); }
  addSection(): void { const body = { name: this.sectionName.trim(), strandId: this.sectionStrandId, adviserTeacherId: this.adviserTeacherId }; this.run(this.editingKind === 'section' ? this.api.updateSection(this.editingId, body) : this.api.createSection({ schoolYearId: this.sectionYearId, gradeLevelId: this.sectionGradeId, ...body }), this.editingKind ? 'Section updated.' : 'Section created.', () => { this.sectionName = ''; this.adviserTeacherId = null; this.sectionStrandId = null; this.clearEdit(); }); }
  addOffering(): void { this.run(this.api.assignSectionSubject(this.selectedSectionId, { subjectId: this.offeringSubjectId, teacherId: this.offeringTeacherId }), 'Subject assigned to section.', () => { this.offeringTeacherId = null; }); }

  edit(kind: string, item: SchoolYear | Department | GradeLevel | Track | Strand | Subject | Room | Section): void {
    this.editingKind = kind;
    this.editingId = kind === 'school-year' ? (item as SchoolYear).schoolYearId
      : kind === 'department' ? (item as Department).departmentId
      : kind === 'grade' ? (item as GradeLevel).gradeLevelId
      : kind === 'track' ? (item as Track).trackId
      : kind === 'strand' ? (item as Strand).strandId
      : kind === 'subject' ? (item as Subject).subjectId
      : kind === 'room' ? (item as Room).roomId
      : (item as Section).sectionId;
    if (kind === 'school-year') { const row = item as SchoolYear; this.yearCode = row.code; this.startsOn = row.startsOn; this.endsOn = row.endsOn; this.editingSchoolYearIsActive = row.isActive; this.activeTab = 'school-years'; }
    if (kind === 'department') { const row = item as Department; this.departmentName = row.name; this.editingDepartmentIsActive = row.isActive; this.activeTab = 'departments'; }
    if (kind === 'grade') { const row = item as GradeLevel; this.gradeDepartmentId = row.departmentId; this.gradeCode = row.code; this.gradeName = row.name; this.gradeSortOrder = row.sortOrder; this.activeTab = 'departments'; }
    if (kind === 'track') { const row = item as Track; this.trackName = row.name; this.editingTrackIsActive = row.isActive; this.activeTab = 'tracks'; }
    if (kind === 'strand') { const row = item as Strand; this.strandTrackId = row.trackId; this.strandCode = row.code; this.strandName = row.name; this.activeTab = 'tracks'; }
    if (kind === 'subject') { const row = item as Subject; this.subjectCode = row.code; this.subjectName = row.name; this.editingSubjectIsActive = row.isActive; this.activeTab = 'subjects'; }
    if (kind === 'room') { const row = item as Room; this.roomCode = row.code; this.roomName = row.name; this.roomCapacity = row.capacity; this.editingRoomIsActive = row.isActive; this.activeTab = 'rooms'; }
    if (kind === 'section') { const row = item as Section; this.sectionYearId = row.schoolYearId; this.sectionGradeId = row.gradeLevelId; this.sectionStrandId = row.strandId; this.sectionName = row.name; this.adviserTeacherId = row.adviserTeacherId; this.activeTab = 'sections'; }
  }

  editOffering(item: SectionSubject): void { this.editingId = item.sectionSubjectId; this.editingKind = 'offering'; this.offeringTeacherId = item.teacherId; this.editingOfferingIsActive = item.isActive; }
  saveOffering(): void { this.run(this.api.updateSectionSubject(this.selectedSectionId, this.editingId, { teacherId: this.offeringTeacherId, isActive: this.editingOfferingIsActive }), 'Subject offering updated.', () => this.clearEdit()); }
  cancelEdit(): void { this.clearEdit(); this.yearCode = ''; this.startsOn = ''; this.endsOn = ''; this.departmentName = ''; this.gradeCode = ''; this.gradeName = ''; this.trackName = ''; this.strandCode = ''; this.strandName = ''; this.subjectCode = ''; this.subjectName = ''; this.roomCode = ''; this.roomName = ''; this.roomCapacity = null; this.sectionName = ''; this.adviserTeacherId = null; this.sectionStrandId = null; }

  gradesForDepartment(departmentId: number): number { return this.grades().filter((grade) => grade.departmentId === departmentId).length; }
  strandsForTrack(trackId: number): number { return this.strands().filter((strand) => strand.trackId === trackId).length; }

  private clearEdit(): void { this.editingId = 0; this.editingKind = ''; }

  private run<T>(request: import('rxjs').Observable<T>, message: string, reset?: () => void): void {
    this.error.set(''); this.notice.set(''); this.saving.set(true);
    request.subscribe({ next: () => { this.saving.set(false); this.notice.set(message); reset?.(); this.loadAll(); if (this.selectedSectionId) this.loadOfferings(); }, error: (e: unknown) => { this.saving.set(false); this.showError(e); } });
  }

  private showError(error: unknown): void { this.error.set(apiErrorMessage(error)); }

  teacherChoices(selectedId: number | null): TeacherLookup[] {
    return this.teachers().filter((teacher) => teacher.isActive || teacher.teacherId === selectedId);
  }
}