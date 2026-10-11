import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Address, FamilyMember } from '../enrollment-applications/enrollment-application.models';

@Component({
  selector: 'app-profile-address', standalone: true, imports: [FormsModule],
  template: `
    <fieldset><legend>{{ title }}</legend><div class="fields">
      <label>House number<input [name]="prefix + 'House'" [(ngModel)]="address.houseNumber" [disabled]="readonly" /></label>
      <label>Street<input [name]="prefix + 'Street'" [(ngModel)]="address.street" [disabled]="readonly" /></label>
      <label>Barangay (required for provided address)<input [name]="prefix + 'Barangay'" [(ngModel)]="address.barangay" [disabled]="readonly" /></label>
      <label>Municipality / City (required for provided address)<input [name]="prefix + 'Municipality'" [(ngModel)]="address.municipality" [disabled]="readonly" /></label>
    </div></fieldset>`,
  styleUrl: './student-portal.scss',
})
export class ProfileAddressFields {
  @Input({ required: true }) address!: Address;
  @Input() title = 'Address';
  @Input() prefix = '';
  @Input() readonly = false;
}

@Component({
  selector: 'app-profile-family', standalone: true, imports: [FormsModule, ProfileAddressFields],
  template: `
    <fieldset><legend>{{ title }}</legend><p>Complete available details. Guardian-only arrangements are supported.</p><div class="fields">
      <label>{{ title === 'Mother' ? 'Maiden last name' : 'Last name' }}<input [name]="prefix + 'Last'" [(ngModel)]="member.lastName" /></label>
      <label>First name<input [name]="prefix + 'First'" [(ngModel)]="member.firstName" /></label>
      <label>Middle name<input [name]="prefix + 'Middle'" [(ngModel)]="member.middleName" /></label>
      @if (title === 'Guardian') { <label>Relationship<input [name]="prefix + 'Relationship'" [(ngModel)]="member.relationship" /></label> }
      @for (contact of member.contacts; track $index; let i = $index) {
        <label>Contact {{ i + 1 }}<input type="tel" [name]="prefix + 'Contact' + i" [(ngModel)]="member.contacts[i]" /></label>
      }
    </div><app-profile-address [address]="member.address" [prefix]="prefix" title="Present address" /></fieldset>`,
  styleUrl: './student-portal.scss',
})
export class ProfileFamilyFields {
  @Input({ required: true }) member!: FamilyMember;
  @Input() title = '';
  @Input() prefix = '';
}
