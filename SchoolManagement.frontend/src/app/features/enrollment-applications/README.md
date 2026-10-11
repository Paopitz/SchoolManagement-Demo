# Enrollment application frontend integration

New standalone route exports:

- `../student-portal/student-portal`: `StudentPortalPage`, public `/student-portal`.
- `./enrollment-applications`: `EnrollmentApplicationsPage`, staff `/enrollment-applications`.

Parent owns routing, menus, staff permissions/interceptor and existing enrollment UI.
No existing integration files are changed by this feature.

## Required configuration provider

Both routes now provide `ENROLLMENT_PORTAL_OPTIONS_LOADER` using the concrete
`enrollmentPortalOptionsProvider` from
`../student-portal/student-portal-options.service.ts`. The provider calls the
anonymous `GET /api/student-portal/options` through `HttpBackend`, with neither
staff nor portal identity headers. Its `Observable<PortalOptions>` loads
approved public school configuration (not staff-protected lookups): `schoolYears[{id,name}]`,
`gradeLevels[{id,name}]`, `declarationText`, `declarationVersion`, `privacyNotice`,
`acceptedFileTypes` (MIME types or extensions), `maxUploadBytes`.

The backend must deploy that public endpoint with the exact shape above.
Missing approved declaration text/version/privacy notice, missing lookups or
upload settings explicitly disable creation and profile corrections, not
existing tracking, review, identity verification or own-grade access.
Do not substitute guessed legal text, years, grades or limits. Test configuration
is isolated to specs and is never used as a production fallback.

## Unsaved changes

The routes now attach `studentPortalUnsavedChangesGuard` from
`../student-portal/student-portal-unsaved.guard.ts` to the portal route and
`enrollmentApplicationUnsavedChangesGuard` from
`enrollment-application-unsaved.guard.ts` to the staff route via `canDeactivate`.
Only those two route definitions and their necessary imports were integrated.
These guards are data-loss protection, not authorization. Browser unload is
also guarded. Selection/reuse/logout and actions that replace unsaved review
data require confirmation. Saving failures retain form values.

## API/security

Contracts/mapping mirror `SchoolManagement.Api/Modules/EnrollmentApplications`
v1 camelCase DTOs: application UUID, numeric expected version, and exact review,
status, approval, physical receipt and email-link operations.

Portal HTTP uses `HttpBackend` to bypass all staff JWT/refresh interceptors.
Opaque `X-Portal-Session` is held only in memory, never storage/URLs. Staff HTTP
uses ordinary `HttpClient`, never a portal-session header. Health is fetched and
saved separately, never included in ordinary profile/detail DTOs. Backend
authorization, manual decisions and policy checks are authoritative.

The staff linkage panel requires an existing numeric student ID, independently
verified email, reason, and both identity/email-ownership acknowledgments.
Manual application creation uses the full reusable profile form and matching
existing LRN/email; the backend performs linkage, not a client-side merge.

## Deliberate v1 limits

- Creating the profile creates `PendingReview`; there is no draft/final-submit
  API. The UI does not claim locally saved drafts. Private documents follow.
- Correction API changes profile only, not requested year/grade/type/email.
  These controls are locked on existing applications. Changed requests need
  school-guided withdrawal/reapplication.
- Health is optional. Omitting health during correction leaves the server's
  existing health record unchanged; there is no health-delete endpoint.
- PSA and Live Birth map to the same `BirthCertificate` document slot.
- LRN is not a credential. Existing grades are scoped to the staff-linked
  verified email; no LRN-only lookup exists. Unlinked students see instructions.
- Portal lists are server-bounded to 100; staff uses 25-item pages and next-page
  availability from returned page length (API has no total count).
- Grade printing is browser printing of own finalized summary only, not an
  official report card, with no guessed school header or signatures.
- Malware scanning, SMTP, private-storage deployment and approved school
  declaration/policies remain backend/deployment responsibilities.

## Verification

From `SchoolManagement.frontend`:

```text
npx.cmd ngc -p tsconfig.app.json --noEmit
npx.cmd ng test --watch=false --include="src/app/features/student-portal/*.spec.ts" --include="src/app/features/enrollment-applications/*.spec.ts"
```

Tests cover scoped transport, rejected OTP, private upload errors, DTO mapping,
age/address/applicability, labeled fields, missing permissions/revocation,
manual email linkage, failed/incomplete evidence, conditional exception
permissions, conflict/validation preservation, health partial failure,
pending status, and own-summary printing.
