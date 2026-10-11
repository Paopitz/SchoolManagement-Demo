import type { CanDeactivateFn } from '@angular/router';
import type { EnrollmentApplicationsPage } from './enrollment-applications';

/** Attach to the parent's /enrollment-applications route, not as an authorization control. */
export const enrollmentApplicationUnsavedChangesGuard: CanDeactivateFn<EnrollmentApplicationsPage> = page => page.canLeave();
