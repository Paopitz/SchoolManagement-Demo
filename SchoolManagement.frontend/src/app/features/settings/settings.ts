import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SystemSetting } from '../../core/models/phase36.models';
import { Phase36ApiService } from '../../core/services/phase36-api.service';
import { apiErrorMessage } from '../../core/utils/api-error-message';

@Component({ selector: 'app-settings', standalone: true, imports: [FormsModule, RouterLink], templateUrl: './settings.html', styleUrl: './settings.scss' })
export class SettingsPage implements OnInit {
  private readonly api = inject(Phase36ApiService);
  readonly settings = signal<SystemSetting[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  activeTab = 'school';
  selectedKey = '';
  editValue = '';
  newKey = '';
  newValue = '';
  description = '';

  ngOnInit(): void { this.loadSettings(); }
  loadSettings(): void {
    this.loading.set(true); this.error.set('');
    this.api.getSettings().subscribe({
      next: rows => { this.settings.set(rows); this.loading.set(false); },
      error: e => { this.loading.set(false); this.showError(e); },
    });
  }
  select(item: SystemSetting): void { this.selectedKey = item.key; this.editValue = item.value; this.description = ''; }
  saveSelected(): void {
    if (!this.selectedKey) return;
    this.persist(this.selectedKey, this.editValue);
  }
  addSetting(): void {
    const key = this.newKey.trim();
    if (!key || !this.newValue.trim()) { this.error.set('Enter a setting key and value.'); return; }
    this.persist(key, this.newValue);
  }
  private persist(key: string, value: string): void {
    this.saving.set(true); this.error.set(''); this.notice.set('');
    this.api.saveSetting(key, value, this.description.trim() || undefined).subscribe({
      next: saved => {
        this.settings.update(rows => [...rows.filter(item => item.key !== saved.key), saved]);
        this.selectedKey = saved.key; this.editValue = saved.value; this.newKey = ''; this.newValue = ''; this.description = '';
        this.saving.set(false); this.notice.set('Setting saved.');
      },
      error: e => { this.saving.set(false); this.showError(e); },
    });
  }
  private showError(error: unknown): void { this.error.set(apiErrorMessage(error)); }
}
