import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { Phase36ApiService } from '../../core/services/phase36-api.service';
import { DashboardSummary } from '../../core/models/phase36.models';
import { Phase2ApiService } from '../../core/services/phase2-api.service';
import { SchoolYear } from '../../core/models/phase2.models';
import { apiErrorMessage } from '../../core/utils/api-error-message';
import { DEMO_ACCOUNTS } from '../../core/demo/demo-data';

@Component({ selector: 'app-dashboard', standalone: true, imports: [FormsModule], templateUrl: './dashboard.html', styleUrl: './dashboard.scss' })
export class Dashboard implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly api = inject(Phase36ApiService);
  private readonly lookup = inject(Phase2ApiService);
  readonly currentUser = this.authService.currentUser;
  readonly summary = signal<DashboardSummary | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly role = signal('');
  readonly years = signal<SchoolYear[]>([]);
  from = this.monthStart();
  to = this.today();
  schoolYearId = 0;

  ngOnInit(): void {
    const roles = this.currentUser()?.roles ?? [];
    const supported = DEMO_ACCOUNTS.map(account => account.role);
    const role = supported.find(candidate => roles.includes(candidate)) ?? '';
    this.role.set(role);
    this.lookup.getSchoolYears().subscribe({ next: years => {
      this.years.set(years);
      this.schoolYearId = years.find(year => year.isActive)?.schoolYearId ?? 0;
      if (role) this.load();
    }, error: () => { if (role) this.load(); } });
  }
  load(): void {
    if (!this.role()) return;
    this.loading.set(true); this.error.set('');
    if (!this.from || !this.to || this.from > this.to) {
      this.error.set('Choose a valid dashboard date range.');
      this.loading.set(false);
      return;
    }
    this.api.getDashboard({ from: this.from, to: this.to, schoolYearId: this.schoolYearId || undefined }).subscribe({
      next: result => { this.summary.set(result); this.loading.set(false); },
      error: (error: unknown) => {
        this.error.set(apiErrorMessage(error));
        this.loading.set(false);
      },
    });
  }
  enrollmentTotal(): number { return this.summary()?.enrollment.reduce((sum, row) => sum + row.count, 0) ?? 0; }
  attendanceTotal(): number { return this.summary()?.attendance.reduce((sum, row) => sum + row.rowCount, 0) ?? 0; }
  private today(): string { return this.dateString(new Date()); }
  private monthStart(): string { const now = new Date(); return this.dateString(new Date(now.getFullYear(), now.getMonth(), 1)); }
  private dateString(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
}
