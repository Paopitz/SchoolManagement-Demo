import { TestBed } from '@angular/core/testing';
import { StudentProfile, ageAt, emptyProfile } from './enrollment-application.models';
import { ApplicationProfileReview } from './application-profile-review';

describe('ApplicationProfileReview', () => {
  it('displays each learner name part, sex, birthday and calculated age separately', async () => {
    const profile: StudentProfile = {
      ...emptyProfile(),
      lastName: 'Santos',
      firstName: 'Ana',
      middleName: 'Reyes',
      extensionName: 'Jr.',
      sex: 'F',
      birthDate: '2010-05-12',
    };
    await TestBed.configureTestingModule({ imports: [ApplicationProfileReview] }).compileComponents();
    const fixture = TestBed.createComponent(ApplicationProfileReview);
    fixture.componentRef.setInput('p', profile);
    fixture.detectChanges();

    const rows = new Map<string, string>();
    for (const term of Array.from(fixture.nativeElement.querySelectorAll('dt') as NodeListOf<HTMLElement>)) {
      rows.set(term.textContent!.trim(), term.nextElementSibling!.textContent!.trim());
    }

    expect(rows.get('Surname')).toBe('Santos');
    expect(rows.get('First name')).toBe('Ana');
    expect(rows.get('Middle name')).toBe('Reyes');
    expect(rows.get('Extension name')).toBe('Jr.');
    expect(rows.get('Sex')).toBe('F');
    expect(rows.get('Birthday')).toBe('2010-05-12');
    expect(rows.get('Age')).toBe(String(ageAt(profile.birthDate)));
  });

  it('shows the profile sections as styled, collapsible headings', async () => {
    await TestBed.configureTestingModule({ imports: [ApplicationProfileReview] }).compileComponents();
    const fixture = TestBed.createComponent(ApplicationProfileReview);
    fixture.componentRef.setInput('p', emptyProfile());
    fixture.detectChanges();

    const sections = Array.from(fixture.nativeElement.querySelectorAll('details.profile-review-section') as NodeListOf<HTMLDetailsElement>);
    expect(sections.map(section => section.querySelector('summary')?.textContent?.trim())).toEqual([
      'Personal / contact details',
      'Family / guardian details',
      'Education / request',
    ]);
    expect(sections.every(section => section.open)).toBe(true);

    sections[0].open = false;
    expect(sections[0].open).toBe(false);
    expect(sections[0].querySelector('summary')?.textContent?.trim()).toBe('Personal / contact details');
  });
});
