import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Phase2ApiService } from '../../core/services/phase2-api.service';
import { Phase36ApiService } from '../../core/services/phase36-api.service';
import { AuthService } from '../../core/services/auth.service';
import { GradingPage } from './grading';

describe('GradingPage template weights', () => {
  let fixture: ComponentFixture<GradingPage>;
  let component: GradingPage;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GradingPage],
      providers: [
        { provide: Phase36ApiService, useValue: {
          getGradingTemplates: () => of([]),
          getGradingPeriods: () => of([]),
        } },
        { provide: Phase2ApiService, useValue: {
          getSchoolYears: () => of([]),
          getGradeLevels: () => of([]),
        } },
        { provide: AuthService, useValue: { hasAnyRole: () => true } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(GradingPage);
    component = fixture.componentInstance;
    component.activeTab = 'setup';
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('updates the displayed total and button after editing weights through the form', async () => {
    const host: HTMLElement = fixture.nativeElement;
    const button = host.querySelector<HTMLButtonElement>('button.primary')!;
    expect(button.disabled).toBe(true);
    component.addComponent();
    component.addComponent();
    fixture.detectChanges();
    await fixture.whenStable();

    const weights = [30, 50, 20];
    for (const [index, value] of weights.entries()) {
      const input = host.querySelector<HTMLInputElement>(`#component-weight-${index}`)!;
      input.value = String(value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.totalWeight()).toBe(100);
    expect(host.querySelector('.weight-total')?.textContent).toContain('100%');
    expect(button.disabled).toBe(false);

    const input = host.querySelector<HTMLInputElement>('#component-weight-2')!;
    input.value = '10';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.totalWeight()).toBe(90);
    expect(button.disabled).toBe(true);
  });

  it('recalculates after adding, removing, and resetting components, and disables while saving', () => {
    expect(component.totalWeight()).toBe(0);
    component.components[0].weightPercent = 100;
    expect(component.totalWeight()).toBe(100);
    component.addComponent();
    component.components[1].weightPercent = 20;
    expect(component.totalWeight()).toBe(120);
    component.removeComponent(1);
    expect(component.totalWeight()).toBe(100);
    component.saving.set(true);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector<HTMLButtonElement>('button.primary')?.disabled).toBe(true);
    component.components = [{ name: '', weightPercent: 0 }];
    expect(component.totalWeight()).toBe(0);
  });

  it('updates the selected enrollment when choosing another student without changing the list', () => {
    component.enrollments.set([
      { enrollmentId: 1, studentNumber: 'S1', studentName: 'First Student',
        subjects: [{ sectionSubjectId: 10, subjectCode: 'MATH', subjectName: 'Math' }] },
      { enrollmentId: 2, studentNumber: 'S2', studentName: 'Second Student',
        subjects: [{ sectionSubjectId: 20, subjectCode: 'ENG', subjectName: 'English' }] },
    ]);
    component.enrollmentId = 1;
    expect(component.selectedEnrollment()?.subjects[0].sectionSubjectId).toBe(10);
    component.enrollmentId = 2;
    component.onEnrollmentChanged();
    expect(component.selectedEnrollment()?.subjects[0].sectionSubjectId).toBe(20);
    expect(component.sectionSubjectId).toBe(0);
  });
});

describe('GradingPage Teacher scope', () => {
  it('uses scoped grading lookups, not school-wide enrollment or section endpoints', async () => {
    const period = { gradingPeriodId: 5, schoolYearId: 1, gradeLevelId: 2, gradingTemplateId: 3 };
    const api = {
      getGradingTemplates: vi.fn(() => of([])),
      getGradingPeriods: vi.fn(() => of([period])),
      getGradingTemplateComponents: vi.fn(() => of([])),
      getGradingSections: vi.fn(() => of([{ sectionId: 7, sectionName: 'A', gradeLevelName: 'Grade 1' }])),
      getGradingEntries: vi.fn(() => of([{ enrollmentId: 8, studentNumber: 'S8', studentName: 'Student Eight',
        subjects: [{ sectionSubjectId: 9, subjectCode: 'MATH', subjectName: 'Math' }] }])),
      getGrades: vi.fn(() => of([])),
    };
    const lookups = {
      getSchoolYears: vi.fn(), getGradeLevels: vi.fn(), getSections: vi.fn(), getEnrollments: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [GradingPage],
      providers: [
        { provide: Phase36ApiService, useValue: api },
        { provide: Phase2ApiService, useValue: lookups },
        { provide: AuthService, useValue: { hasAnyRole: () => false } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(GradingPage);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(api.getGradingSections).toHaveBeenCalledWith(5);
    component.sectionId = 7;
    component.sectionChanged();
    expect(api.getGradingEntries).toHaveBeenCalledWith(5, 7, 1);
    expect(component.enrollments()[0].subjects).toHaveLength(1);
    for (const lookup of Object.values(lookups)) expect(lookup).not.toHaveBeenCalled();
  });
});
