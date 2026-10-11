import { TestBed } from '@angular/core/testing';
import { NgForm } from '@angular/forms';
import { vi } from 'vitest';
import { PortalOptions, ageAt, emptyProfile } from '../enrollment-applications/enrollment-application.models';
import { toProfileDto } from '../enrollment-applications/enrollment-application.mapper';
import { StudentProfileForm } from './student-profile-form';
import { ApplicationDocuments } from './application-documents';

const options: PortalOptions = { schoolYears: [{ id: 9, name: 'Configured year' }], gradeLevels: [{ id: 3, name: 'Configured grade' }], declarationText: 'Approved declaration', declarationVersion: 'approved-2', privacyNotice: 'School notice', maxUploadBytes: 10, acceptedFileTypes: ['application/pdf'] };
describe('StudentProfileForm', () => {
  it('computes age on birthday boundaries and rejects impossible or future dates', () => {
    expect(ageAt('2010-10-12', new Date(2026, 9, 11))).toBe(15);
    expect(ageAt('2010-10-11', new Date(2026, 9, 11))).toBe(16);
    expect(ageAt('2025-02-30')).toBeNull();
    expect(ageAt('2099-01-01')).toBeNull();
  });
  it('copies addresses without aliasing and preserves PSA spelling and optional unknown health', () => {
    const component = new StudentProfileForm(); const p = emptyProfile(); component.profile = p; component.options = options;
    Object.assign(p, { lrn: '001234567890', lrnStatus: 'Provided', firstName: 'Ana-María', lastName: "D'Ávila", birthDate: '2010-01-01', sex: 'F', email: 'family@example.test', mobile: '09171234567', requestedSchoolYearId: 9, requestedGradeLevelId: 3, idContact: 'Guardian', declarationAcknowledged: true, accomplishingPersonName: 'Ana-María', accomplishingCapacity: 'Student' });
    p.presentAddress.barangay = 'Central'; p.presentAddress.municipality = 'Town';
    component.sameAddress = true; component.copyAddress();
    expect(p.permanentAddress).not.toBe(p.presentAddress);
    component.toggleHealth(true); expect(p.health?.bloodType).toBe('Unknown');
    p.completedGrade10 = false; p.grade10GeneralAverage = 80;
    const emit = vi.spyOn(component.saved, 'emit');
    component.save({ invalid: false } as NgForm);
    expect(emit).toHaveBeenCalled();
    const saved = emit.mock.calls[0][0]!;
    expect(saved.firstName).toBe('Ana-María'); expect(saved.lastName).toBe("D'Ávila");
    expect(saved.grade10GeneralAverage).toBeNull(); expect(saved.declarationVersion).toBe('approved-2');
    expect(toProfileDto(saved).contactNumbers).toEqual(['09171234567']);
  });
  it('keeps unsaved changes when conditional boarding-house details are incomplete', () => {
    const c = new StudentProfileForm(); c.options = options; c.profile.boardingHouse = true; c.changed();
    const event = { preventDefault: vi.fn(), returnValue: '' } as unknown as BeforeUnloadEvent;
    c.beforeUnload(event); expect(event.preventDefault).toHaveBeenCalled(); expect(c.dirty).toBe(true);
  });
  for (const status of ['NotAssigned', 'Unknown'] as const) {
    it(`submits a New application with ${status} and no LRN`, () => {
      const c = new StudentProfileForm(); c.options = options;
      Object.assign(c.profile, { lrnStatus: status, firstName: 'Test', lastName: 'Applicant', birthDate: '2010-01-01', sex: 'F', email: 'family@example.test', mobile: '123', requestedSchoolYearId: 9, requestedGradeLevelId: 3, idContact: 'Guardian', declarationAcknowledged: true, accomplishingPersonName: 'Test', accomplishingCapacity: 'Student' });
      c.profile.presentAddress = { houseNumber: '', street: '', barangay: 'Central', municipality: 'Town' };
      c.sameAddress = true;
      const emit = vi.spyOn(c.saved, 'emit'); c.save({ invalid: false } as NgForm);
      expect(emit).toHaveBeenCalled();
      expect(toProfileDto(emit.mock.calls[0][0]!).lrn).toBeNull();
      expect(toProfileDto(emit.mock.calls[0][0]!).lrnStatus).toBe(status);
    });
  }
  for (const type of ['Returning', 'Transferee'] as const) {
    it(`requires Provided and 12 digits for ${type}`, () => {
      const c = new StudentProfileForm(); c.options = options; c.profile.applicationType = type;
      const emit = vi.spyOn(c.saved, 'emit');
      c.save({ invalid: false } as NgForm);
      expect(emit).not.toHaveBeenCalled(); expect(c.error()).toContain('Only New');
      c.applicationTypeChanged(); expect(c.profile.lrnStatus).toBe('Provided');
      c.profile.lrn = '123'; c.save({ invalid: false } as NgForm);
      expect(emit).not.toHaveBeenCalled(); expect(c.error()).toContain('12 digits');
    });
  }
  it('locks submitted LRN and status during profile corrections', async () => {
    await TestBed.configureTestingModule({ imports: [StudentProfileForm] }).compileComponents();
    const fixture = TestBed.createComponent(StudentProfileForm);
    fixture.componentRef.setInput('options', options); fixture.componentRef.setInput('lockEnrollmentRequest', true);
    fixture.detectChanges(); await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector<HTMLInputElement>('[name=lrn]')!.readOnly).toBe(true);
    expect(root.querySelector<HTMLSelectElement>('[name=lrnStatus]')!.disabled).toBe(true);
    expect(root.querySelector<HTMLSelectElement>('[name=applicationType]')!.disabled).toBe(true);
    expect(root.textContent).toContain('cannot be changed');
  });
  it('never accepts a declaration when approved school legal text is unavailable', () => {
    const c = new StudentProfileForm();
    c.options = { ...options, declarationText: '', privacyNotice: '' };
    const emit = vi.spyOn(c.saved, 'emit');
    c.save({ invalid: false } as NgForm);
    expect(emit).not.toHaveBeenCalled();
    expect(c.error()).toContain('not configured');
  });
  it('renders labeled personal fields and keyboard-operable step controls', async () => {
    await TestBed.configureTestingModule({ imports: [StudentProfileForm] }).compileComponents();
    const fixture = TestBed.createComponent(StudentProfileForm);
    fixture.componentRef.setInput('options', options); fixture.detectChanges(); await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    for (const input of Array.from(root.querySelectorAll('input,select,textarea'))) expect(input.closest('label')).not.toBeNull();
    expect(root.querySelector('nav')?.getAttribute('aria-label')).toBe('Profile steps');
    const next = Array.from(root.querySelectorAll('button')).find(b => b.textContent?.includes('Next'))!;
    next.click(); fixture.detectChanges();
    expect(root.querySelector('[role=alert]')?.textContent).toContain('required fields');
    expect(fixture.componentInstance.step()).toBe(0);
  });
});
describe('ApplicationDocuments', () => {
  it('rejects oversized and disallowed files before upload', () => {
    const c = new ApplicationDocuments(); c.options = options;
    c.choose({ target: { files: [new File(['more than ten bytes'], 'large.pdf', { type: 'application/pdf' })] } } as unknown as Event);
    expect(c.file).toBeNull(); expect(c.error).toContain('size limit');
    c.choose({ target: { files: [new File(['x'], 'script.html', { type: 'text/html' })] } } as unknown as Event);
    expect(c.file).toBeNull(); expect(c.error).toContain('allowed type');
  });
});
