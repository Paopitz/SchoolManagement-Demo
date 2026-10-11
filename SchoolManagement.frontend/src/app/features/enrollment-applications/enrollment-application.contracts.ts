import { AcademicDecision, Address, ApplicationType, GradeOutcome, LrnStatus } from './enrollment-application.models';

/** Mirrors Modules/EnrollmentApplications/Contracts/ApplicationContracts.cs (camelCase). */
export interface PersonDto { firstName: string; middleName: string | null; lastName: string; relationship: string | null; contactNumbers: string[]; address: Address | null; }
export interface ProfileDto {
  lrn: string | null; lrnStatus?: LrnStatus; firstName: string; middleName: string | null; lastName: string; suffix: string | null;
  sex: string; birthDate: string; contactNumbers: string[]; livingWithParents: boolean; livingWithGuardian: boolean;
  guardianRelationship: string | null; boardingHouse: boolean; landlord: PersonDto | null; presentAddress: Address; permanentAddress: Address;
  fourPsBeneficiary: boolean; fourPsHouseholdNumber: string | null; mother: PersonDto | null; father: PersonDto | null;
  guardian: PersonDto | null; idContact: string; hasPreviousSchooling: boolean; previousGradeLevel: string | null;
  previousSchoolYear: string | null; previousSchoolName: string | null; previousSchoolAddress: string | null; previousSchoolId: string | null;
  grade10GeneralAverage: number | null; declarationAccepted: boolean; declarationVersion: string; accomplishedBy: string; capacity: string;
}
export interface HealthDto { bloodType: string; heightCm: number | null; weightKg: number | null; weighedOn: string | null; conditions: string | null; }
export interface CreateApplicationDto { email: string; schoolYearId: number; requestedGradeLevelId: number; applicationType: ApplicationType; profile: ProfileDto; }
export interface GradeDto { evidenceId: number; subjectName: string; grade: number | null; outcome: GradeOutcome; remarks: string | null; provenance: string; gradingPeriod: string | null; schoolYear: string | null; gradeLevel: string | null; }
export interface ApplicationDto {
  applicationId: string; email: string; studentId: number | null; schoolYearId: number; requestedGradeLevelId: number;
  applicationType: ApplicationType; source: string; status: string; version: number; submittedAtUtc: string; enrollmentId: number | null;
  profile: ProfileDto; academicDecision: AcademicDecision | null; academicRemarks: string | null; internalNotes: string | null;
  documents: { documentId: number; kind: 'BirthCertificate' | 'ReportCard' | 'IdPicture'; receipt: string; state: string; fileName: string | null; remarks: string | null }[];
  grades: GradeDto[];
  history: { historyId: number; action: string; beforeValue: string | null; afterValue: string | null; reason: string | null; actor: string; atUtc: string }[];
}
export interface GradeSummaryDto {
  title: string; generatedAtUtc: string; student: { firstName: string; lastName: string; lrn: string | null } | null; grades: GradeDto[];
}
