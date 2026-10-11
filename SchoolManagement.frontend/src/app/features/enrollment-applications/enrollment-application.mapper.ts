import { ApplicationDto, CreateApplicationDto, HealthDto, PersonDto, ProfileDto } from './enrollment-application.contracts';
import { ApplicationDetail, FamilyMember, HealthProfile, StudentProfile, emptyAddress, emptyFamily, emptyProfile } from './enrollment-application.models';

const optional = (value: string) => value.trim() || null;
const contacts = (value: string[]) => value.map(v => v.trim()).filter(Boolean);
function person(value: FamilyMember): PersonDto | null {
  if (!value.firstName && !value.lastName && !value.contacts.some(Boolean)) return null;
  return { firstName: value.firstName, lastName: value.lastName, middleName: optional(value.middleName), relationship: optional(value.relationship), contactNumbers: contacts(value.contacts), address: value.address };
}
function family(value: PersonDto | null): FamilyMember {
  return value ? { firstName: value.firstName, lastName: value.lastName, middleName: value.middleName ?? '', relationship: value.relationship ?? '', contacts: [...value.contactNumbers, '', '', ''].slice(0, 3), address: value.address ?? emptyAddress() } : emptyFamily();
}
export function toProfileDto(p: StudentProfile): ProfileDto {
  return {
    lrn: p.lrn || null, lrnStatus: p.lrnStatus ?? 'Provided', firstName: p.firstName, lastName: p.lastName, middleName: optional(p.middleName), suffix: optional(p.extensionName),
    sex: p.sex, birthDate: p.birthDate, contactNumbers: contacts([p.mobile, ...p.contacts]),
    livingWithParents: p.livingWithParents, livingWithGuardian: p.livingWithGuardian, guardianRelationship: optional(p.guardian.relationship),
    boardingHouse: p.boardingHouse,
    landlord: p.boardingHouse ? { firstName: p.landlordFirstName, lastName: p.landlordLastName, middleName: null, relationship: null, contactNumbers: contacts([p.landlordContact]), address: p.landlordAddress } : null,
    presentAddress: p.presentAddress, permanentAddress: p.permanentAddress, fourPsBeneficiary: p.fourPsBeneficiary,
    fourPsHouseholdNumber: p.fourPsBeneficiary ? optional(p.fourPsHouseholdNumber) : null,
    mother: person(p.mother), father: person(p.father), guardian: person(p.guardian), idContact: p.idContact,
    hasPreviousSchooling: p.hasPreviousSchooling, previousGradeLevel: optional(p.previousGradeLevel), previousSchoolYear: optional(p.previousSchoolYear),
    previousSchoolName: optional(p.previousSchoolName), previousSchoolAddress: optional(p.previousSchoolAddress), previousSchoolId: optional(p.previousSchoolId),
    grade10GeneralAverage: p.completedGrade10 ? p.grade10GeneralAverage : null,
    declarationAccepted: p.declarationAcknowledged, declarationVersion: p.declarationVersion, accomplishedBy: p.accomplishingPersonName, capacity: p.accomplishingCapacity,
  };
}
export function toCreateDto(p: StudentProfile): CreateApplicationDto {
  return { email: p.email, schoolYearId: p.requestedSchoolYearId!, requestedGradeLevelId: p.requestedGradeLevelId!, applicationType: p.applicationType, profile: toProfileDto(p) };
}
export function toHealthDto(p: HealthProfile): HealthDto { return { bloodType: p.bloodType, heightCm: p.heightCm, weightKg: p.weightKg, weighedOn: p.weighingDate || null, conditions: p.history || null }; }
export function fromHealthDto(p: HealthDto | null): HealthProfile | null { return p ? { bloodType: p.bloodType, heightCm: p.heightCm, weightKg: p.weightKg, weighingDate: p.weighedOn ?? '', history: p.conditions ?? '' } : null; }
export function fromApplicationDto(d: ApplicationDto): ApplicationDetail {
  const p = d.profile;
  return {
    id: d.applicationId, reference: d.applicationId, studentName: `${p.firstName} ${p.lastName}`, status: d.status, source: d.source,
    reasons: [d.history.at(-1)?.reason, d.academicRemarks, ...d.documents.filter(v => v.state !== 'Verified').map(v => `${v.kind}: ${v.state}${v.remarks ? ' — ' + v.remarks : ''}`)].filter((v): v is string => Boolean(v)),
    version: d.version, enrollmentId: d.enrollmentId,
    profile: {
      ...emptyProfile(), lrn: p.lrn ?? '', lrnStatus: p.lrnStatus ?? 'Provided', firstName: p.firstName, lastName: p.lastName, middleName: p.middleName ?? '', extensionName: p.suffix ?? '',
      sex: p.sex, birthDate: p.birthDate, email: d.email, mobile: p.contactNumbers[0] ?? '', contacts: [...p.contactNumbers.slice(1), '', ''].slice(0, 2),
      livingWithParents: p.livingWithParents, livingWithGuardian: p.livingWithGuardian, boardingHouse: p.boardingHouse,
      landlordName: p.landlord ? `${p.landlord.firstName} ${p.landlord.lastName}`.trim() : '', landlordFirstName: p.landlord?.firstName ?? '', landlordLastName: p.landlord?.lastName ?? '', landlordAddress: p.landlord?.address ?? emptyAddress(), landlordContact: p.landlord?.contactNumbers[0] ?? '',
      presentAddress: p.presentAddress, permanentAddress: p.permanentAddress, fourPsBeneficiary: p.fourPsBeneficiary, fourPsHouseholdNumber: p.fourPsHouseholdNumber ?? '',
      mother: family(p.mother), father: family(p.father), guardian: { ...family(p.guardian), relationship: p.guardianRelationship ?? p.guardian?.relationship ?? '' }, idContact: p.idContact,
      applicationType: d.applicationType, hasPreviousSchooling: p.hasPreviousSchooling, previousSchoolName: p.previousSchoolName ?? '', previousSchoolAddress: p.previousSchoolAddress ?? '',
      previousSchoolId: p.previousSchoolId ?? '', previousSchoolYear: p.previousSchoolYear ?? '', previousGradeLevel: p.previousGradeLevel ?? '',
      requestedSchoolYearId: d.schoolYearId, requestedGradeLevelId: d.requestedGradeLevelId, completedGrade10: p.grade10GeneralAverage !== null,
      grade10GeneralAverage: p.grade10GeneralAverage, declarationAcknowledged: p.declarationAccepted, declarationVersion: p.declarationVersion,
      accomplishingPersonName: p.accomplishedBy, accomplishingCapacity: p.capacity,
    },
    documents: d.documents.map(v => ({ id: v.documentId, kind: v.kind === 'BirthCertificate' ? 'PSA' : v.kind, fileName: v.fileName ?? '', receiptMode: v.receipt === 'Physical' ? 'Physical' : 'Upload', status: v.state, remarks: v.remarks ?? '' })),
    externalGrades: d.grades.map(v => ({ evidenceId: v.evidenceId, subject: v.subjectName, grade: v.grade, outcome: v.outcome, remarks: v.remarks ?? '', provenance: v.provenance })),
    academicReview: d.academicDecision ? { decision: d.academicDecision, internalRemarks: d.internalNotes ?? '', studentVisibleRemarks: d.academicRemarks ?? '', conditions: d.academicRemarks ?? '' } : null,
    history: d.history.map(v => ({ status: `${v.action}: ${v.afterValue ?? ''}`, remarks: v.reason ?? '', occurredAt: v.atUtc, actor: v.actor })),
  };
}
