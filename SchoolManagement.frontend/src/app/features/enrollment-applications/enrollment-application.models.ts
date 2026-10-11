/** UI contracts. Transport mapping lives in enrollment-application-api.service.ts. */
export type ApplicationType = 'New' | 'Returning' | 'Transferee';
export type LrnStatus = 'Provided' | 'NotAssigned' | 'Unknown';
export type AcademicDecision = 'NeedsFurtherReview' | 'Eligible' | 'EligibleWithConditions' | 'NotEligible' | 'NotApplicable';
export interface Address { houseNumber: string; street: string; barangay: string; municipality: string; }
export interface FamilyMember { lastName: string; firstName: string; middleName: string; relationship: string; contacts: string[]; address: Address; }
export interface HealthProfile { bloodType: string; heightCm: number | null; weightKg: number | null; weighingDate: string; history: string; }
export interface StudentProfile {
  lrn: string; lrnStatus: LrnStatus; lastName: string; firstName: string; middleName: string; extensionName: string;
  sex: string; birthDate: string; email: string; mobile: string; contacts: string[];
  livingWithParents: boolean; livingWithGuardian: boolean; boardingHouse: boolean;
  landlordName: string; landlordFirstName: string; landlordLastName: string; landlordAddress: Address; landlordContact: string;
  presentAddress: Address; permanentAddress: Address; fourPsBeneficiary: boolean; fourPsHouseholdNumber: string;
  mother: FamilyMember; father: FamilyMember; guardian: FamilyMember; idContact: string;
  applicationType: ApplicationType; hasPreviousSchooling: boolean; previousSchoolName: string; previousSchoolAddress: string; previousSchoolId: string;
  previousSchoolYear: string; previousGradeLevel: string; requestedSchoolYearId: number | null;
  requestedGradeLevelId: number | null; completedGrade10: boolean; grade10GeneralAverage: number | null;
  health: HealthProfile | null;
  declarationAcknowledged: boolean; accomplishingPersonName: string; accomplishingCapacity: string; declarationVersion: string;
}
export type DocumentKind = 'PSA' | 'LiveBirth' | 'ReportCard' | 'IdPicture';
export interface ApplicationDocument {
  id: number; kind: DocumentKind; fileName: string; receiptMode: 'Upload' | 'Physical';
  status: string; remarks: string;
}
export type GradeOutcome = 'Passed' | 'Failed' | 'Incomplete' | 'Unknown' | 'Unreviewed';
export interface ExternalGrade { evidenceId: number; subject: string; grade: number | null; outcome: GradeOutcome; remarks: string; provenance: string; }
export interface AcademicReview { decision: AcademicDecision; internalRemarks: string; studentVisibleRemarks: string; conditions: string; }
export interface ApplicationHistory { status: string; remarks: string; occurredAt: string; actor: string; }
export interface ApplicationSummary { id: string; reference: string; studentName: string; status: string; source: string; reasons: string[]; }
export interface ApplicationDetail extends ApplicationSummary {
  profile: StudentProfile; documents: ApplicationDocument[]; externalGrades: ExternalGrade[];
  academicReview: AcademicReview | null; history: ApplicationHistory[]; version: number;
  enrollmentId: number | null;
}
export interface ApplicationPage { items: ApplicationSummary[]; totalCount: number; page: number; pageSize: number; }
export interface PortalOptions {
  schoolYears: { id: number; name: string }[]; gradeLevels: { id: number; name: string }[];
  declarationText: string; declarationVersion: string; privacyNotice: string;
  acceptedFileTypes: string[]; maxUploadBytes: number;
}
/** Readiness only, not a substitute for server validation or approved policy. */
export function portalConfigurationUnavailable(options: PortalOptions): string {
  if (!options.declarationText?.trim() || !options.declarationVersion?.trim() || !options.privacyNotice?.trim())
    return 'School-approved declaration and privacy notice are not configured. Contact the school before creating or correcting an application.';
  if (!options.schoolYears?.length || !options.gradeLevels?.length)
    return 'No application school years or grade levels are configured. Contact the school.';
  if (!options.acceptedFileTypes?.length || !(options.maxUploadBytes > 0))
    return 'Document upload settings are unavailable. Contact the school.';
  return '';
}
export interface SectionOption { id: number; name: string; }
export interface OwnGradeSummary {
  title: string; studentName: string; lrn: string; generatedAt: string;
  grades: { subject: string; grade: number | null; schoolYear: string; gradeLevel: string; gradingPeriod: string; remarks: string }[];
}
export interface OfficialHistory { enrollmentId: number; schoolYear: string; gradeLevel: string; section: string; status: string; enrolledAtUtc: string | null; }
export function emptyAddress(): Address { return { houseNumber: '', street: '', barangay: '', municipality: '' }; }
export function emptyFamily(): FamilyMember { return { lastName: '', firstName: '', middleName: '', relationship: '', contacts: ['', '', ''], address: emptyAddress() }; }
export function emptyProfile(): StudentProfile {
  return {
    lrn: '', lrnStatus: 'NotAssigned', lastName: '', firstName: '', middleName: '', extensionName: '', sex: '', birthDate: '', email: '', mobile: '', contacts: ['', ''],
    livingWithParents: false, livingWithGuardian: false, boardingHouse: false, landlordName: '', landlordFirstName: '', landlordLastName: '', landlordAddress: emptyAddress(), landlordContact: '',
    presentAddress: emptyAddress(), permanentAddress: emptyAddress(), fourPsBeneficiary: false, fourPsHouseholdNumber: '',
    mother: emptyFamily(), father: emptyFamily(), guardian: emptyFamily(), idContact: '',
    applicationType: 'New', hasPreviousSchooling: false, previousSchoolName: '', previousSchoolAddress: '', previousSchoolId: '', previousSchoolYear: '', previousGradeLevel: '',
    requestedSchoolYearId: null, requestedGradeLevelId: null, completedGrade10: false, grade10GeneralAverage: null, health: null,
    declarationAcknowledged: false, accomplishingPersonName: '', accomplishingCapacity: '', declarationVersion: '',
  };
}
export function hasResolvedLrn(profile: StudentProfile): boolean {
  return profile.lrnStatus === 'Provided' && /^\d{12}$/.test(profile.lrn);
}
export function validApplicationLrn(profile: StudentProfile): boolean {
  return hasResolvedLrn(profile) || (profile.applicationType === 'New' &&
    ['NotAssigned', 'Unknown'].includes(profile.lrnStatus) && !profile.lrn);
}
export function lrnLabel(profile: StudentProfile): string {
  return hasResolvedLrn(profile) ? `LRN: ${profile.lrn} · Provided` : `Pending LRN · ${profile.lrnStatus}`;
}
export function ageAt(birthDate: string, today = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const [year, month, day] = birthDate.split('-').map(Number);
  const birth = new Date(year, month - 1, day);
  if (birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day || birth > today) return null;
  return today.getFullYear() - year - (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day) ? 1 : 0);
}
