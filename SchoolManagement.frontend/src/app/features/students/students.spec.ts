import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { StudentRecord } from '../../core/models/phase3.models';
import { AuthService } from '../../core/services/auth.service';
import { Phase3ApiService } from '../../core/services/phase3-api.service';
import { StudentsPage } from './students';

describe('StudentsPage registration through enrollment', () => {
  let fixture: ComponentFixture<StudentsPage>;
  let component: StudentsPage;
  const student: StudentRecord = {
    studentId: 3, studentNumber: 'DEMO-003', lrn: '999900000003', firstName: 'DEMO',
    middleName: null, lastName: 'Approved', suffix: null, birthDate: '2019-03-03',
    status: 'Active', createdAtUtc: '2026-10-11T00:00:00Z',
  };
  const permissions = new Set<string>();
  const api = {
    getStudents: vi.fn(() => of({ items: [student], totalCount: 1 })),
    updateStudent: vi.fn(() => of(student)),
  };

  beforeEach(async () => {
    permissions.clear();
    permissions.add('students.write');
    permissions.add('enrollment.read');
    api.getStudents.mockClear();
    api.updateStudent.mockReset().mockReturnValue(of(student));
    await TestBed.configureTestingModule({
      imports: [StudentsPage],
      providers: [
        provideRouter([]),
        { provide: Phase3ApiService, useValue: api },
        { provide: AuthService, useValue: { hasPermission: (code: string) => permissions.has(code) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(StudentsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows the directory and enrollment link without a registration form', () => {
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('form')).toBeNull();
    expect(element.textContent).not.toContain('Create student');
    expect(element.textContent).toContain('registered automatically');
    expect(element.textContent).toContain('DEMO Approved');
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/enrollment-applications');
    expect(element.querySelector('.student-layout')?.classList.contains('editing')).toBe(false);
  });

  it('preserves editing and cancellation without offering standalone creation', () => {
    component.edit(student);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('form')).not.toBeNull();
    component.firstName = ' Corrected ';
    component.save();
    expect(api.updateStudent).toHaveBeenCalledWith(3, expect.objectContaining({ firstName: 'Corrected', status: 'Active' }));
    expect(component.notice()).toBe('Student record updated.');
    expect(component.editingId).toBe(0);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('form')).toBeNull();
    component.edit(student);
    component.resetForm();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('form')).toBeNull();
  });

  it('blocks save without an existing student and surfaces the enrollment guidance', () => {
    component.save();
    expect(api.updateStudent).not.toHaveBeenCalled();
    expect(component.error()).toContain('enrollment application approval');
    expect(component.saving()).toBe(false);
  });

  it('hides the enrollment shortcut and editing controls without their separate permissions', () => {
    permissions.clear();
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('a')).toBeNull();
    expect(element.querySelector('.text-link')).toBeNull();
    component.edit(student);
    component.save();
    expect(api.updateStudent).not.toHaveBeenCalled();
  });

  it('retains the edit form and displays update failures', () => {
    api.updateStudent.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 409, error: { detail: 'Student number or LRN already exists.' },
    })));
    component.edit(student);
    component.save();
    expect(component.editingId).toBe(3);
    expect(component.error()).toBe('Student number or LRN already exists.');
    expect(component.saving()).toBe(false);
  });
});
