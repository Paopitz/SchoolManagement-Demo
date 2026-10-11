import { Component, Input } from '@angular/core';
import { StudentProfile, ageAt, lrnLabel } from './enrollment-application.models';

@Component({
  selector: 'app-application-profile-review', standalone: true, styleUrl: '../student-portal/student-portal.scss',
  template: `
    <details class="profile-review-section" open><summary>Personal / contact details</summary><dl>
    <dt>Surname</dt><dd>{{ p.lastName }}</dd><dt>First name</dt><dd>{{ p.firstName }}</dd>
    <dt>Middle name</dt><dd>{{ p.middleName }}</dd><dt>Extension name</dt><dd>{{ p.extensionName }}</dd>
    <dt>LRN / status</dt><dd>{{ lrnLabel(p) }}</dd><dt>Sex</dt><dd>{{ p.sex }}</dd>
    <dt>Birthday</dt><dd>{{ p.birthDate }}</dd><dt>Age</dt><dd>{{ age(p.birthDate) ?? 'Not available' }}</dd>
    <dt>Email / Mobile</dt><dd>{{ p.email }} / {{ p.mobile }} (contact only; not SMS-verified)</dd><dt>Additional contacts</dt><dd>{{ p.contacts.join(' · ') }}</dd>
    <dt>Present address</dt><dd>{{ address(p.presentAddress) }}</dd><dt>Permanent address</dt><dd>{{ address(p.permanentAddress) }}</dd>
    <dt>Living arrangements</dt><dd>Parents: {{ p.livingWithParents ? 'Yes' : 'No' }} · Guardian: {{ p.livingWithGuardian ? 'Yes' : 'No' }} · Boarding: {{ p.boardingHouse ? 'Yes' : 'No' }}</dd>
    @if (p.boardingHouse) { <dt>Landlord / contact / address</dt><dd>{{ p.landlordName }} · {{ p.landlordContact }} · {{ address(p.landlordAddress) }}</dd> }
    <dt>4Ps</dt><dd>{{ p.fourPsBeneficiary ? p.fourPsHouseholdNumber : 'Not a beneficiary' }}</dd></dl></details>
    <details class="profile-review-section" open><summary>Family / guardian details</summary>
    @for (entry of family(); track entry.label) { <h4>{{ entry.label }}</h4><dl>
    <dt>Name / relationship</dt><dd>{{ entry.member.firstName }} {{ entry.member.middleName }} {{ entry.member.lastName }} · {{ entry.member.relationship }}</dd>
    <dt>Contacts</dt><dd>{{ entry.member.contacts.join(' · ') }}</dd><dt>Address</dt><dd>{{ address(entry.member.address) }}</dd></dl> }
    <p>ID contact: {{ p.idContact || 'Not selected' }}</p></details>
    <details class="profile-review-section" open><summary>Education / request</summary><dl><dt>Application type</dt><dd>{{ p.applicationType }}</dd><dt>Previous schooling</dt><dd>{{ p.hasPreviousSchooling ? 'Yes' : 'No' }}</dd>
    <dt>Previous school / ID</dt><dd>{{ p.previousSchoolName }} / {{ p.previousSchoolId }}</dd><dt>School address</dt><dd>{{ p.previousSchoolAddress }}</dd>
    <dt>Previous year / grade</dt><dd>{{ p.previousSchoolYear }} / {{ p.previousGradeLevel }}</dd>
    <dt>Requested year / grade IDs</dt><dd>{{ p.requestedSchoolYearId }} / {{ p.requestedGradeLevelId }}</dd>
    <dt>Grade 10 average</dt><dd>{{ p.completedGrade10 ? p.grade10GeneralAverage ?? 'Not supplied' : 'Not applicable' }} (student-declared)</dd></dl></details>
    <h3>Declaration</h3><dl><dt>Acknowledged / version</dt><dd>{{ p.declarationAcknowledged ? 'Yes' : 'No' }} / {{ p.declarationVersion }}</dd>
    <dt>Accomplished by / capacity</dt><dd>{{ p.accomplishingPersonName }} / {{ p.accomplishingCapacity }}</dd></dl>`,
})
export class ApplicationProfileReview {
  @Input({ required: true }) p!: StudentProfile;
  age = ageAt;
  lrnLabel = lrnLabel;
  address = (a: StudentProfile['presentAddress']) => [a.houseNumber, a.street, a.barangay, a.municipality].filter(Boolean).join(', ');
  family = () => [{ label: 'Mother (maiden name)', member: this.p.mother }, { label: 'Father', member: this.p.father }, { label: 'Guardian', member: this.p.guardian }];
}
