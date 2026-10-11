import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { apiErrorMessage } from '../../core/utils/api-error-message';

interface Permission { code: string; description: string | null; }
interface RolePermissions { roleId: number; name: string; permissions: string[]; }

@Component({
  selector: 'app-role-permissions',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="heading"><h1>Roles & permissions</h1>
      <p>Changes apply to every account with this role. Another assigned role may still grant the same access.</p>
      <button type="button" (click)="load()" [disabled]="busy()">Refresh</button></section>
    @if (error()) { <p role="alert" class="error">{{ error() }}</p> }
    @if (notice()) { <p role="status">{{ notice() }}</p> }
    <section class="panel">
      <label for="permissionRole">Role</label>
      <select id="permissionRole" [(ngModel)]="roleId" (ngModelChange)="selectRole()" [disabled]="busy()">
        <option [ngValue]="0">Choose role</option>
        @for (role of roles(); track role.roleId) { <option [ngValue]="role.roleId">{{ role.name }}</option> }
      </select>
      @if (roleId) {
        <fieldset [disabled]="busy()"><legend>Granted permissions</legend>
          @for (permission of catalog(); track permission.code) {
            <label class="grant"><input type="checkbox" [checked]="selected.has(permission.code)"
              [disabled]="!canGrant(permission.code)" (change)="toggle(permission.code)">
              <span><strong>{{ permission.code }}</strong><small>{{ permission.description }}</small></span></label>
          }
        </fieldset>
        <p>You can grant only permissions you hold. Privileged role changes and administrator access are protected by the API.</p>
        <label for="permissionReason">Reason for change</label>
        <textarea id="permissionReason" [(ngModel)]="reason" maxlength="500" [disabled]="busy()"></textarea>
        <button type="button" (click)="save()" [disabled]="busy() || !reason.trim()">{{ busy() ? 'Saving...' : 'Save permissions' }}</button>
      }
    </section>`,
  styles: [`
    :host { display: block; } .heading, .panel { padding: 1.5rem; }
    .panel { background: white; border: 1px solid #dbe2e8; border-radius: 1rem; max-width: 65rem; }
    select, textarea { display: block; width: 100%; padding: .7rem; margin: .5rem 0 1rem; }
    fieldset { border: 0; padding: 0; } .grant { display: flex; gap: .7rem; padding: .65rem; }
    small { display: block; color: #475569; } .error { color: #b91c1c; }
    button { padding: .6rem 1rem; cursor: pointer; }
  `],
})
export class RolePermissionsPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  readonly catalog = signal<Permission[]>([]);
  readonly roles = signal<RolePermissions[]>([]);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  roleId = 0;
  reason = '';
  selected = new Set<string>();

  ngOnInit(): void { this.load(); }

  load(): void {
    this.busy.set(true); this.error.set('');
    forkJoin({
      catalog: this.http.get<Permission[]>(`${environment.apiBaseUrl}/role-permissions/catalog`),
      roles: this.http.get<RolePermissions[]>(`${environment.apiBaseUrl}/role-permissions`),
    }).subscribe({
      next: (data) => { this.catalog.set(data.catalog); this.roles.set(data.roles); this.selectRole(); this.busy.set(false); },
      error: (error: unknown) => { this.error.set(apiErrorMessage(error)); this.busy.set(false); },
    });
  }

  selectRole(): void {
    this.selected = new Set(this.roles().find(role => role.roleId === this.roleId)?.permissions ?? []);
    this.reason = '';
  }

  canGrant(code: string): boolean {
    return this.auth.hasPermission(code) || (this.roles().find(role => role.roleId === this.roleId)?.permissions.includes(code) ?? false);
  }

  toggle(code: string): void {
    if (!this.canGrant(code)) return;
    if (this.selected.has(code)) this.selected.delete(code); else this.selected.add(code);
  }

  save(): void {
    if (this.busy() || !this.roleId || !this.reason.trim()) return;
    this.busy.set(true); this.error.set(''); this.notice.set('');
    this.http.put<void>(`${environment.apiBaseUrl}/role-permissions/${this.roleId}`,
      { permissions: [...this.selected].sort(), reason: this.reason.trim() })
      .pipe(switchMap(() => this.auth.refreshPermissions())).subscribe({
        next: () => { this.notice.set('Role permissions saved. Active API requests now use the updated grants.'); this.load(); },
        error: (error: unknown) => { this.error.set(apiErrorMessage(error)); this.busy.set(false); },
      });
  }
}
