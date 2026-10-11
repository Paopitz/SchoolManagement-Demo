import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { RolePermissionsPage } from './role-permissions';

describe('RolePermissionsPage', () => {
  let page: RolePermissionsPage;
  let http: HttpTestingController;
  const auth = { hasPermission: (code: string) => code === 'enrollment.read', refreshPermissions: vi.fn(() => of([])) };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RolePermissionsPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useValue: auth }],
    });
    page = TestBed.createComponent(RolePermissionsPage).componentInstance;
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('allows existing grants to be removed but does not offer unheld new privileges', () => {
    page.roles.set([{ roleId: 4, name: 'Teacher', permissions: ['enrollment.write'] }]);
    page.roleId = 4; page.selectRole();
    expect(page.canGrant('enrollment.write')).toBe(true);
    expect(page.canGrant('roles.permissions.manage')).toBe(false);
    page.toggle('enrollment.write');
    expect(page.selected.has('enrollment.write')).toBe(false);
    page.toggle('roles.permissions.manage');
    expect(page.selected.has('roles.permissions.manage')).toBe(false);
  });

  it('sends an explicit full list and displays API failure without claiming success', () => {
    page.roleId = 4; page.selected = new Set(['enrollment.read']); page.reason = ' Revision ';
    page.save();
    const request = http.expectOne(`${environment.apiBaseUrl}/role-permissions/4`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ permissions: ['enrollment.read'], reason: 'Revision' });
    request.flush({ detail: 'Protected administrator access.' }, { status: 409, statusText: 'Conflict' });
    expect(page.error()).toBe('Protected administrator access.');
    expect(page.notice()).toBe('');
    expect(page.busy()).toBe(false);
  });
});
