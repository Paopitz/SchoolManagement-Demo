import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Room, ScheduleEntry, Section, SectionSubject } from '../../core/models/phase2.models';
import { Phase2ApiService } from '../../core/services/phase2-api.service';
import { apiErrorMessage } from '../../core/utils/api-error-message';

@Component({
  selector: 'app-schedules',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './schedules.html',
  styleUrl: './schedules.scss',
})
export class SchedulesPage implements OnInit {
  private readonly api = inject(Phase2ApiService);
  readonly sections = signal<Section[]>([]);
  readonly rooms = signal<Room[]>([]);
  readonly offerings = signal<SectionSubject[]>([]);
  readonly entries = signal<ScheduleEntry[]>([]);
  readonly error = signal('');
  readonly notice = signal('');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly editingScheduleId = signal(0);
  selectedSectionId = 0;
  sectionSubjectId = 0;
  roomId: number | null = null;
  dayOfWeek = 1;
  startTime = '';
  endTime = '';
  readonly weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  ngOnInit(): void {
    this.api.getSections().subscribe({ next: (rows) => this.sections.set(rows), error: (e) => this.showError(e) });
    this.api.getRooms().subscribe({ next: (rows) => this.rooms.set(rows.filter((room) => room.isActive)), error: (e) => this.showError(e) });
    this.loadEntries();
  }

  selectSection(): void {
    if (!this.selectedSectionId) { this.offerings.set([]); return; }
    this.api.getSectionSubjects(this.selectedSectionId).subscribe({ next: (rows) => this.offerings.set(rows.filter((row) => row.isActive)), error: (e) => this.showError(e) });
    this.loadEntries();
  }

  loadEntries(): void {
    this.loading.set(true); this.error.set('');
    this.api.getSchedules(this.selectedSectionId || undefined).subscribe({ next: (rows) => { this.entries.set(rows); this.loading.set(false); }, error: (e) => { this.loading.set(false); this.showError(e); } });
  }

  create(): void {
    this.error.set(''); this.notice.set('');
    if (!this.sectionSubjectId || !this.startTime || !this.endTime || this.endTime <= this.startTime) { this.error.set('Choose a subject and a valid time range. End time must be after start time.'); return; }
    this.saving.set(true);
    const body = { roomId: this.roomId, dayOfWeek: Number(this.dayOfWeek), startTime: this.startTime, endTime: this.endTime };
    const request = this.editingScheduleId()
      ? this.api.updateSchedule(this.editingScheduleId(), body)
      : this.api.createSchedule({ ...body, sectionSubjectId: this.sectionSubjectId });
    request.subscribe({
      next: () => { this.saving.set(false); this.notice.set(this.editingScheduleId() ? 'Schedule entry updated.' : 'Schedule entry created.'); this.editingScheduleId.set(0); this.startTime = ''; this.endTime = ''; this.loadEntries(); },
      error: (e) => { this.saving.set(false); this.showError(e); },
    });
  }

  remove(entry: ScheduleEntry): void {
    this.error.set(''); this.notice.set('');
    this.api.deleteSchedule(entry.scheduleEntryId).subscribe({ next: () => { this.notice.set('Schedule entry removed.'); this.loadEntries(); }, error: (e) => this.showError(e) });
  }

  edit(entry: ScheduleEntry): void {
    this.editingScheduleId.set(entry.scheduleEntryId);
    this.selectedSectionId = entry.sectionId;
    this.sectionSubjectId = entry.sectionSubjectId;
    this.roomId = entry.roomId;
    this.dayOfWeek = entry.dayOfWeek;
    this.startTime = entry.startTime.slice(0, 5);
    this.endTime = entry.endTime.slice(0, 5);
    this.api.getSectionSubjects(entry.sectionId).subscribe({ next: (rows) => this.offerings.set(rows.filter((row) => row.isActive)), error: (e) => this.showError(e) });
  }

  cancelEdit(): void { this.editingScheduleId.set(0); this.startTime = ''; this.endTime = ''; }

  dayName(day: number): string { return this.weekdays[day - 1] ?? 'Unknown'; }
  entriesForDay(day: number): ScheduleEntry[] {
    return this.entries().filter((entry) => entry.dayOfWeek === day).sort((left, right) => left.startTime.localeCompare(right.startTime));
  }
  private showError(error: unknown): void { this.error.set(apiErrorMessage(error)); }
}