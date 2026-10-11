import { Component, EventEmitter, HostListener, Input, Output, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { PortalOptions, StudentProfile, ageAt, emptyProfile, portalConfigurationUnavailable, validApplicationLrn } from '../enrollment-applications/enrollment-application.models';
import { ProfileAddressFields, ProfileFamilyFields } from './profile-fields';

@Component({
  selector: 'app-student-profile-form', standalone: true,
  imports: [FormsModule, ProfileAddressFields, ProfileFamilyFields],
  templateUrl: './student-profile-form.html', styleUrl: './student-portal.scss',
})
export class StudentProfileForm {
  @Input() profile: StudentProfile = emptyProfile();
  @Input({ required: true }) options!: PortalOptions;
  @Input() saving = false;
  @Input() canEditHealth = true;
  @Input() submitLabel = 'Submit application for review';
  @Input() lockEnrollmentRequest = false;
  @Input() lockEmail = false;
  @Output() saved = new EventEmitter<StudentProfile>();
  @Output() dirtyChange = new EventEmitter<boolean>();
  readonly steps = ['Personal', 'Family', 'Education', 'Health', 'Declaration'];
  readonly step = signal(0);
  readonly error = signal('');
  dirty = false;
  sameAddress = false;
  age = () => ageAt(this.profile.birthDate);

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void { if (this.dirty) { event.preventDefault(); event.returnValue = ''; } }
  changed(): void { this.dirty = true; this.dirtyChange.emit(true); }
  markSaved(): void { this.dirty = false; this.dirtyChange.emit(false); }
  copyAddress(): void { if (this.sameAddress) this.profile.permanentAddress = { ...this.profile.presentAddress }; this.changed(); }
  applicationTypeChanged(): void {
    if (this.profile.applicationType !== 'New') this.profile.lrnStatus = 'Provided';
    this.changed();
  }
  move(form: NgForm, direction: number): void {
    if (direction > 0 && form.invalid) { form.control.markAllAsTouched(); this.error.set('Complete the required fields in this step.'); return; }
    this.error.set(''); this.step.update(value => value + direction);
    setTimeout(() => document.getElementById('profile-step-heading')?.focus());
  }
  save(form: NgForm): void {
    if (this.saving) return;
    const unavailable = portalConfigurationUnavailable(this.options);
    if (unavailable) { this.error.set(unavailable); return; }
    if (!validApplicationLrn(this.profile)) {
      this.error.set('Provided LRN must contain exactly 12 digits. Only New applicants may select Not assigned or Unknown and leave LRN blank.');
      this.step.set(0); return;
    }
    if (form.invalid || ageAt(this.profile.birthDate) === null || !this.profile.firstName.trim() || !this.profile.lastName.trim() ||
      !this.profile.email.trim() || !this.profile.mobile.trim() || !this.profile.sex || !this.profile.requestedGradeLevelId || !this.profile.requestedSchoolYearId) {
      form.control.markAllAsTouched(); this.error.set('Check personal details, a valid birth date, email/mobile, and requested year/grade before saving.'); return;
    }
    if (this.profile.boardingHouse && (!this.profile.landlordFirstName.trim() || !this.profile.landlordLastName.trim() || !this.profile.landlordContact.trim())) {
      this.error.set('Provide the landlord name and contact for a boarding-house arrangement.'); this.step.set(0); return;
    }
    if (this.profile.fourPsBeneficiary && !this.profile.fourPsHouseholdNumber.trim()) { this.error.set('Provide the 4Ps household number.'); this.step.set(0); return; }
    const hasAddress = (a: StudentProfile['presentAddress']) => Boolean(a.barangay.trim() && a.municipality.trim());
    if (!hasAddress(this.profile.presentAddress) || (!this.sameAddress && !hasAddress(this.profile.permanentAddress)) || (this.profile.boardingHouse && !hasAddress(this.profile.landlordAddress))) {
      this.error.set('Provide barangay and municipality for each applicable student / landlord address.'); this.step.set(0); return;
    }
    if (!this.profile.idContact || (this.profile.livingWithGuardian && !this.profile.guardian.relationship.trim())) { this.error.set('Select the ID contact and provide the guardian relationship when living with a guardian.'); this.step.set(1); return; }
    for (const member of [this.profile.mother, this.profile.father, this.profile.guardian]) {
      const included = member.firstName || member.lastName || member.contacts.some(Boolean) || (member === this.profile.guardian && this.profile.livingWithGuardian);
      if (included && (!member.firstName.trim() || !member.lastName.trim() || !hasAddress(member.address))) {
        this.error.set('For each provided parent / guardian, complete first name, last name, barangay, and municipality. Leave unavailable parents blank.'); this.step.set(1); return;
      }
    }
    if ((this.profile.applicationType !== 'New' && !this.profile.hasPreviousSchooling) || (this.profile.hasPreviousSchooling && (!this.profile.previousGradeLevel.trim() || !this.profile.previousSchoolYear.trim() || !this.profile.previousSchoolName.trim()))) {
      this.error.set('Returning / transferee applications require previous schooling. Provide the previous school, year, and grade when applicable.'); this.step.set(2); return;
    }
    if (this.profile.health && this.canEditHealth && (this.profile.health.heightCm !== null || this.profile.health.weightKg !== null) && !this.profile.health.weighingDate) {
      this.error.set('Provide the weighing date when health measurements are entered.'); this.step.set(3); return;
    }
    if (!this.profile.declarationAcknowledged || !this.profile.accomplishingPersonName.trim() || !this.profile.accomplishingCapacity || !this.options.declarationVersion) {
      this.error.set('Acknowledge the current declaration and provide the accomplishing person and capacity.'); return;
    }
    if (this.sameAddress) this.profile.permanentAddress = { ...this.profile.presentAddress };
    const value = structuredClone(this.profile);
    value.declarationVersion = this.options.declarationVersion;
    if (!value.completedGrade10) value.grade10GeneralAverage = null;
    if (!value.boardingHouse) { value.landlordName = ''; value.landlordContact = ''; }
    if (!value.fourPsBeneficiary) value.fourPsHouseholdNumber = '';
    if (!this.canEditHealth) value.health = null;
    this.error.set(''); this.saved.emit(value);
  }
  toggleHealth(enabled: boolean): void {
    this.profile.health = enabled ? { bloodType: 'Unknown', heightCm: null, weightKg: null, weighingDate: '', history: '' } : null;
    this.changed();
  }
}
