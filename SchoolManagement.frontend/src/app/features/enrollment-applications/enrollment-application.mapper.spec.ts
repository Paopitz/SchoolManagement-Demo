import { ApplicationDto } from './enrollment-application.contracts';
import { fromApplicationDto, toProfileDto } from './enrollment-application.mapper';
import { emptyProfile, hasResolvedLrn, validApplicationLrn } from './enrollment-application.models';

function dto(): ApplicationDto {
  return {
    applicationId: 'test-id', email: 'family@example.test', studentId: null, schoolYearId: 9,
    requestedGradeLevelId: 3, applicationType: 'New', source: 'Online', status: 'PendingReview',
    version: 1, submittedAtUtc: '', enrollmentId: null, profile: toProfileDto(emptyProfile()),
    academicDecision: null, academicRemarks: null, internalNotes: null, documents: [], grades: [], history: [],
  };
}
describe('LRN wire mapping and backwards defaults', () => {
  it('defaults older responses without status to Provided and preserves leading zeroes', () => {
    const wire = dto(); delete wire.profile.lrnStatus; wire.profile.lrn = '001234567890';
    const detail = fromApplicationDto(wire);
    expect(detail.profile.lrnStatus).toBe('Provided');
    expect(hasResolvedLrn(detail.profile)).toBe(true);
    expect(toProfileDto(detail.profile).lrn).toBe('001234567890');
  });
  it('maps nullable LRN without inventing digits or converting pending status', () => {
    const wire = dto(); wire.profile.lrn = null; wire.profile.lrnStatus = 'Unknown';
    const detail = fromApplicationDto(wire);
    expect(detail.profile.lrn).toBe(''); expect(detail.profile.lrnStatus).toBe('Unknown');
    expect(toProfileDto(detail.profile).lrn).toBeNull();
    expect(toProfileDto(detail.profile).lrnStatus).toBe('Unknown');
    expect(hasResolvedLrn(detail.profile)).toBe(false);
  });
  it('keeps an older null LRN unresolved while defaulting the missing status', () => {
    const wire = dto(); wire.profile.lrn = null; delete wire.profile.lrnStatus;
    const p = fromApplicationDto(wire).profile;
    expect(p.lrnStatus).toBe('Provided'); expect(p.lrn).toBe('');
    expect(hasResolvedLrn(p)).toBe(false); expect(validApplicationLrn(p)).toBe(false);
  });
  it('allows missing LRN only for New with an explicit unavailable status', () => {
    const p = emptyProfile(); expect(p.lrnStatus).toBe('NotAssigned');
    expect(validApplicationLrn(p)).toBe(true);
    p.lrnStatus = 'Unknown'; expect(validApplicationLrn(p)).toBe(true);
    p.applicationType = 'Returning'; expect(validApplicationLrn(p)).toBe(false);
    p.applicationType = 'Transferee'; expect(validApplicationLrn(p)).toBe(false);
    p.lrnStatus = 'Provided';
    for (const lrn of ['', '12345678901', '1234567890123', 'abcdefghijkl']) {
      p.lrn = lrn; expect(validApplicationLrn(p)).toBe(false);
    }
    p.lrn = '001234567890'; expect(validApplicationLrn(p)).toBe(true);
  });
});
