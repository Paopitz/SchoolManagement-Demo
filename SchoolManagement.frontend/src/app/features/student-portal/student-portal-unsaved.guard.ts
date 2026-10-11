import type { CanDeactivateFn } from '@angular/router';
import type { StudentPortalPage } from './student-portal';

/** Attach to the parent's public /student-portal route. */
export const studentPortalUnsavedChangesGuard: CanDeactivateFn<StudentPortalPage> = page => page.canLeave();
